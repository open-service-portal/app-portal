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
import express from 'express';
import { Logger } from 'winston';
import { DatabaseService, HttpAuthService } from '@backstage/backend-plugin-api';
import { ClusterAuthValidator } from './cluster-auth-validator';
import { ClusterAuthStore } from './cluster-auth-store';
import { stringifyEntityRef } from '@backstage/catalog-model';
import { CatalogApi } from '@backstage/catalog-client';

export interface ClusterAuthOptions {
  logger: Logger;
  database: DatabaseService;
  httpAuth: HttpAuthService;
  catalogApi: CatalogApi;
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
 * Helper function to resolve user entity ref from email by looking up in catalog
 * This matches the behavior of emailMatchingUserEntityProfileEmail resolver
 */
async function resolveUserEntityRefFromEmail(
  email: string,
  catalogApi: CatalogApi,
  logger: Logger,
): Promise<string> {
  try {
    logger.info(`🔍 Looking up user in catalog by email: ${email}`);

    // Query catalog for user with matching email
    const { items } = await catalogApi.getEntities({
      filter: {
        kind: 'User',
        'spec.profile.email': email,
      },
    });

    logger.info(`📊 Found ${items.length} user(s) with email ${email}`);

    if (items.length === 0) {
      // Log helpful debugging info
      logger.error(`❌ No user found in catalog with email: ${email}`);
      logger.error(`   💡 Tip: Check that your user entity in the catalog has this email in spec.profile.email`);
      logger.error(`   💡 GitHub users: Your email must be public in GitHub settings or added to catalog manually`);
      throw new Error(`No user found in catalog with email: ${email}`);
    }

    if (items.length > 1) {
      logger.warn(`⚠️  Multiple users found with email ${email}:`);
      items.forEach((item, idx) => {
        logger.warn(`   ${idx + 1}. ${stringifyEntityRef(item)}`);
      });
      logger.warn(`   Using first match: ${stringifyEntityRef(items[0])}`);
    }

    const userEntity = items[0];
    const userEntityRef = stringifyEntityRef(userEntity);

    logger.info(`✅ Resolved email ${email} → ${userEntityRef}`);

    return userEntityRef;
  } catch (error) {
    logger.error(`Failed to resolve user from email ${email}`, error);
    throw new Error(`Could not find user in catalog with email: ${email}`);
  }
}

/**
 * Creates a router for cluster authentication
 */
export async function createRouter(options: ClusterAuthOptions): Promise<Router> {
  const { logger, database, httpAuth, catalogApi } = options;
  const router = Router();

  // Add JSON body parser middleware
  router.use(express.json());

  // Initialize token store (following Backstage pattern)
  const tokenStore = await ClusterAuthStore.create(database, logger);

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
   * Helper function to extract user entity ref from Backstage auth context
   */
  async function getUserEntityRef(req: express.Request): Promise<string> {
    try {
      const credentials = await httpAuth.credentials(req);
      const principal = credentials.principal;

      // If it's a user principal, return the userEntityRef directly
      if (principal.type === 'user') {
        return principal.userEntityRef;
      }

      // If it's a service principal or other type, throw error
      throw new Error(`Unsupported principal type: ${principal.type}`);
    } catch (error) {
      logger.warn('Failed to extract user from auth context', { error });
      throw new Error('User not authenticated or invalid credentials');
    }
  }

  /**
   * POST /api/cluster-auth/tokens
   *
   * Receives OIDC tokens from oidc-authenticator daemon
   *
   * NEW APPROACH:
   * - User must be logged into Backstage (via GitHub)
   * - Cluster tokens are stored under the current Backstage user
   * - No email matching needed - use the active Backstage session
   * - Guest users are rejected
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

      // Get the current Backstage user from the session
      // This requires the frontend to pass authentication when triggering the daemon
      let userEntityRef: string;
      try {
        userEntityRef = await getUserEntityRef(req);
        logger.info(`🔐 Cluster authentication for Backstage user: ${userEntityRef}`);
      } catch (error) {
        logger.error('No Backstage session found - user must be logged in first');
        return res.status(401).json({
          error: 'Not authenticated',
          message: 'You must be logged into Backstage (via GitHub) before authenticating with the cluster',
        });
      }

      // Reject guest users
      if (userEntityRef === 'user:default/guest') {
        logger.warn('Cluster authentication rejected for guest user');
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Guest users cannot authenticate with clusters. Please log in with GitHub.',
        });
      }

      // Validate id_token for security (optional but recommended)
      let issuer: string | undefined;
      let userEmail: string | undefined;

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

        logger.info('Cluster token validated', {
          backstageUser: userEntityRef,
          clusterEmail: userEmail,
          issuer,
        });
      } else {
        // Fallback: decode without validation (not recommended for production!)
        logger.warn('Token validation skipped (no issuer configured)');
        const jwt = require('jsonwebtoken');
        const decoded = jwt.decode(tokens.id_token) as any;
        userEmail = decoded?.email;
        issuer = decoded?.iss;

        logger.info('Cluster token received (unvalidated)', {
          backstageUser: userEntityRef,
          clusterEmail: userEmail,
        });
      }

      // Calculate expiration
      // If expires_in is provided, use it; otherwise extract from id_token exp claim
      let expiresAt: Date;
      if (tokens.expires_in) {
        expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
      } else {
        // Extract expiration from id_token
        const jwt = require('jsonwebtoken');
        const decoded = jwt.decode(tokens.id_token) as any;
        if (decoded?.exp) {
          expiresAt = new Date(decoded.exp * 1000);
        } else {
          // Default to 1 hour if no expiration found
          logger.warn('No expiration found in tokens, defaulting to 1 hour');
          expiresAt = new Date(Date.now() + 3600 * 1000);
        }
      }

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

      // Note: We don't issue a Backstage session token here because:
      // 1. The frontend already has its own Backstage session (via Guest or GitHub auth)
      // 2. These cluster tokens are only for Kubernetes API access, not Backstage auth
      // 3. The user's Backstage identity is separate from their cluster identity

      logger.info('Cluster authentication completed successfully', { user: userEntityRef });

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
   * Requires Backstage authentication
   */
  router.get('/status', async (req, res) => {
    try {
      const userEntityRef = await getUserEntityRef(req);

      const hasValid = await tokenStore.hasValidTokens(userEntityRef);
      const tokens = await tokenStore.getTokens(userEntityRef);

      res.json({
        authenticated: hasValid,
        expiresAt: tokens?.expiresAt?.toISOString(),
        user: userEntityRef,
      });
    } catch (error) {
      logger.error('Failed to check cluster auth status', error);

      // If authentication failed, return 401
      if (error instanceof Error && error.message.includes('not authenticated')) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: error.message,
        });
      }

      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * GET /api/cluster-auth/token
   *
   * Get current access token for cluster authentication
   * Used by Kubernetes plugin to authenticate requests
   * Requires Backstage authentication
   */
  router.get('/token', async (req, res) => {
    try {
      const userEntityRef = await getUserEntityRef(req);

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

      // If authentication failed, return 401
      if (error instanceof Error && error.message.includes('not authenticated')) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: error.message,
        });
      }

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
   * GET /api/cluster-auth/user-emails
   *
   * Public debug endpoint showing all user/email mappings in catalog
   * Does NOT require authentication - useful for debugging email matching
   */
  router.get('/user-emails', async (req, res) => {
    try {
      // Look up all users in catalog
      const { items } = await catalogApi.getEntities({
        filter: {
          kind: 'User',
        },
      });

      const userMappings = items.map(item => ({
        entityRef: stringifyEntityRef(item),
        name: item.metadata.name,
        email: item.spec?.profile?.email || 'Not set',
        displayName: item.spec?.profile?.displayName || item.metadata.name,
      }));

      res.json({
        message: 'For cluster authentication to work, the email in your OIDC token must match spec.profile.email in your user entity',
        tip: 'If you have multiple GitHub emails, ensure the one in your catalog matches your OIDC token email',
        totalUsers: userMappings.length,
        users: userMappings,
      });
    } catch (error) {
      logger.error('Failed to get user email mappings', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * GET /api/cluster-auth/debug
   *
   * Debug endpoint to show current user's email and entity ref mapping
   * Requires Backstage authentication
   */
  router.get('/debug', async (req, res) => {
    try {
      const userEntityRef = await getUserEntityRef(req);

      // Look up user entity in catalog
      const { items } = await catalogApi.getEntities({
        filter: {
          kind: 'User',
        },
      });

      // Find the current user
      const currentUser = items.find(
        item => stringifyEntityRef(item) === userEntityRef,
      );

      res.json({
        currentUserEntityRef: userEntityRef,
        userEmail: currentUser?.spec?.profile?.email || 'Not set',
        emailMatchingInfo: {
          message:
            'For cluster authentication to work, the email in your OIDC token must match spec.profile.email in your user entity',
          currentEmail: currentUser?.spec?.profile?.email || 'Not set',
          entityRef: userEntityRef,
          tip: 'If you have multiple GitHub emails, make sure the one in your catalog user entity matches the primary email in your OIDC token',
        },
        allUsers: items.map(item => ({
          entityRef: stringifyEntityRef(item),
          email: item.spec?.profile?.email || 'Not set',
        })),
      });
    } catch (error) {
      logger.error('Failed to get debug info', error);

      // If authentication failed, return 401
      if (error instanceof Error && error.message.includes('not authenticated')) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: error.message,
        });
      }

      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * DELETE /api/cluster-auth/tokens
   *
   * Delete cluster tokens for current user (logout)
   * Requires Backstage authentication
   */
  router.delete('/tokens', async (req, res) => {
    try {
      const userEntityRef = await getUserEntityRef(req);

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

      // If authentication failed, return 401
      if (error instanceof Error && error.message.includes('not authenticated')) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: error.message,
        });
      }

      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}
