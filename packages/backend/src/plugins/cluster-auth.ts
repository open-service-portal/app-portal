/**
 * Cluster Authentication Plugin
 *
 * Receives OIDC tokens from the oidc-authenticator daemon and stores them
 * for Kubernetes cluster access. This is separate from Backstage user auth.
 *
 * **Key Insight:** The oidc-authenticator daemon handles the entire OAuth/PKCE flow,
 * so this backend doesn't need OAuth libraries. It just validates, stores, and
 * retrieves tokens. MUCH simpler than traditional OAuth backend!
 *
 * Architecture:
 *   User → Backstage Frontend → Click "Authenticate with Cluster" button
 *   → Opens localhost:8000 (oidc-authenticator daemon)
 *   → User logs in with OIDC provider (daemon handles OAuth/PKCE)
 *   → Daemon sends tokens to this endpoint: POST /api/cluster-auth/tokens
 *   → Backend validates and stores tokens in database
 *   → Kubernetes plugin retrieves tokens for API calls
 */

import { Router } from 'express';
import { Logger } from 'winston';
import { Knex } from 'knex';
import { ClusterAuthValidator } from './cluster-auth-validator';
import { ClusterAuthStore } from './cluster-auth-store';

export interface ClusterAuthOptions {
  logger: Logger;
  database: Knex;
  issuer?: string;  // OIDC issuer URL (from config)
  verifySignature?: boolean;  // Whether to verify JWT signatures
}

export interface OIDCTokens {
  access_token: string;
  id_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

/**
 * Creates a router for cluster authentication
 */
export function createRouter(options: ClusterAuthOptions): Router {
  const { logger, database } = options;
  const router = Router();

  // Initialize token store
  const tokenStore = new ClusterAuthStore({
    database,
    logger,
  });

  // Initialize token validator (if issuer provided)
  let tokenValidator: ClusterAuthValidator | undefined;
  if (options.issuer) {
    tokenValidator = new ClusterAuthValidator({
      issuer: options.issuer,
      verifySignature: options.verifySignature ?? false, // Default to false for now
      logger,
    });
  }

  /**
   * POST /api/cluster-auth/tokens
   *
   * Receives OIDC tokens from oidc-authenticator daemon
   *
   * Since the daemon handles OAuth/PKCE, we just need to:
   * 1. Validate the tokens (JWT signature + claims)
   * 2. Extract user identity
   * 3. Store in database
   */
  router.post('/tokens', async (req, res) => {
    try {
      const tokens: OIDCTokens = req.body;

      // Validate token structure
      if (!tokens.access_token || !tokens.id_token) {
        logger.warn('Invalid token payload received');
        return res.status(400).json({
          error: 'Invalid token payload',
          message: 'access_token and id_token are required',
        });
      }

      logger.info('Received OIDC tokens from authenticator daemon', {
        tokenType: tokens.token_type,
        expiresIn: tokens.expires_in,
        scope: tokens.scope,
      });

      // Validate id_token and extract user identity
      let userEmail: string | undefined;
      let issuer: string | undefined;

      if (tokenValidator) {
        const validation = await tokenValidator.validateIdToken(tokens.id_token);

        if (!validation.valid) {
          logger.warn('Token validation failed', { error: validation.error });
          return res.status(401).json({
            error: 'Invalid token',
            message: validation.error || 'Token validation failed',
          });
        }

        userEmail = validation.userIdentity?.email;
        // Extract issuer from id_token
        const jwt = require('jsonwebtoken');
        const decoded = jwt.decode(tokens.id_token) as any;
        issuer = decoded?.iss;

        logger.info('Token validated', {
          email: userEmail,
          sub: validation.userIdentity?.sub,
        });
      } else {
        // Fallback: decode without validation (not recommended for production!)
        logger.warn('Token validation skipped (no issuer configured)');
        const jwt = require('jsonwebtoken');
        const decoded = jwt.decode(tokens.id_token) as any;
        userEmail = decoded?.email;
        issuer = decoded?.iss;
      }

      if (!userEmail) {
        return res.status(400).json({
          error: 'Missing user email',
          message: 'Could not extract email from id_token',
        });
      }

      // Convert email to user entity ref
      // Format: user:default/email (where @ and . are replaced with -)
      const username = userEmail.split('@')[0].replace(/\./g, '-');
      const userEntityRef = `user:default/${username}`;

      // Calculate expiration
      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

      // Store tokens in database
      await tokenStore.saveTokens({
        userEntityRef,
        accessToken: tokens.access_token,
        idToken: tokens.id_token,
        refreshToken: tokens.refresh_token,
        issuer: issuer || 'unknown',
        expiresAt,
      });

      logger.info('Cluster tokens stored successfully', {
        user: userEntityRef,
        expiresAt: expiresAt.toISOString(),
      });

      // Send success response back to daemon
      res.json({
        status: 'ok',
        message: 'Tokens received and stored successfully',
        user: userEntityRef,
      });
    } catch (error) {
      logger.error('Failed to process cluster authentication tokens', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to process tokens',
      });
    }
  });

  /**
   * GET /api/cluster-auth/status
   *
   * Check if current user has authenticated cluster tokens
   *
   * TODO: Get current user from Backstage auth context
   * For now, requires ?user=user:default/john query parameter
   */
  router.get('/status', async (req, res) => {
    try {
      // TODO: Get user from Backstage auth context
      // For now, accept user from query parameter (INSECURE - for testing only!)
      const userEntityRef = req.query.user as string;

      if (!userEntityRef) {
        return res.json({
          authenticated: false,
          message: 'No user specified',
        });
      }

      const hasValid = await tokenStore.hasValidTokens(userEntityRef);
      const tokens = await tokenStore.getTokens(userEntityRef);

      res.json({
        authenticated: hasValid,
        expiresAt: tokens?.expiresAt?.toISOString(),
        user: userEntityRef,
      });
    } catch (error) {
      logger.error('Failed to check cluster auth status', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * GET /api/cluster-auth/token
   *
   * Get current access token for cluster authentication
   * Used by Kubernetes plugin to authenticate requests
   *
   * TODO: Get current user from Backstage auth context
   * For now, requires ?user=user:default/john query parameter
   */
  router.get('/token', async (req, res) => {
    try {
      // TODO: Get user from Backstage auth context
      // For now, accept user from query parameter (INSECURE - for testing only!)
      const userEntityRef = req.query.user as string;

      if (!userEntityRef) {
        return res.status(401).json({
          error: 'Not authenticated',
          message: 'No user specified',
        });
      }

      const tokens = await tokenStore.getTokens(userEntityRef);

      if (!tokens) {
        return res.status(401).json({
          error: 'Not authenticated',
          message: 'No cluster tokens found. Please authenticate first.',
        });
      }

      // Check if token is expired
      if (tokens.expiresAt.getTime() < Date.now()) {
        // TODO: Attempt to refresh token if refresh_token available
        return res.status(401).json({
          error: 'Token expired',
          message: 'Cluster token has expired. Please re-authenticate.',
        });
      }

      // Return access token
      res.json({
        access_token: tokens.accessToken,
        token_type: 'Bearer',
        expires_at: tokens.expiresAt.toISOString(),
      });
    } catch (error) {
      logger.error('Failed to retrieve cluster token', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * GET /api/cluster-auth/stats
   *
   * Get statistics about stored tokens (for monitoring/debugging)
   */
  router.get('/stats', async (req, res) => {
    try {
      const stats = await tokenStore.getStats();
      res.json(stats);
    } catch (error) {
      logger.error('Failed to get token stats', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * DELETE /api/cluster-auth/tokens
   *
   * Delete cluster tokens for current user (logout)
   *
   * TODO: Get current user from Backstage auth context
   */
  router.delete('/tokens', async (req, res) => {
    try {
      const userEntityRef = req.query.user as string;

      if (!userEntityRef) {
        return res.status(400).json({
          error: 'Bad request',
          message: 'User not specified',
        });
      }

      const deleted = await tokenStore.deleteTokens(userEntityRef);

      if (deleted) {
        logger.info('Cluster tokens deleted', { user: userEntityRef });
        res.json({
          status: 'ok',
          message: 'Tokens deleted successfully',
        });
      } else {
        res.status(404).json({
          error: 'Not found',
          message: 'No tokens found for user',
        });
      }
    } catch (error) {
      logger.error('Failed to delete cluster tokens', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}
