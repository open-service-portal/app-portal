/**
 * Cluster Auth Debug Router
 *
 * Provides debug endpoints to verify:
 * - User's cluster tokens
 * - Token validation
 * - Direct cluster access test
 * - Kubernetes API interception logging
 */

import { Router } from 'express';
import express from 'express';
import { Logger } from 'winston';
import { HttpAuthService } from '@backstage/backend-plugin-api';
import { ClusterAuthStore } from './cluster-auth-store';
import fetch from 'node-fetch';
import * as https from 'https';

export interface ClusterAuthDebugOptions {
  logger: Logger;
  httpAuth: HttpAuthService;
  clusterAuthStore: ClusterAuthStore;
}

interface KubernetesApiRequest {
  timestamp: string;
  user: string;
  method: string;
  url: string;
  tokenPreview: string; // First 20 chars of token
  responseStatus?: number;
  error?: string;
}

// In-memory storage for recent API requests (last 100)
const recentApiRequests: KubernetesApiRequest[] = [];
const MAX_REQUESTS = 100;

/**
 * Log a Kubernetes API request for debugging
 * Call this from your kubernetes-auth-provider
 */
export function logKubernetesApiRequest(request: KubernetesApiRequest) {
  recentApiRequests.unshift(request);
  if (recentApiRequests.length > MAX_REQUESTS) {
    recentApiRequests.pop();
  }
}

/**
 * Helper function to extract user entity ref from request
 */
async function getUserEntityRef(
  req: express.Request,
  httpAuth: HttpAuthService,
): Promise<string> {
  try {
    const credentials = await httpAuth.credentials(req);
    const principal = credentials.principal as any;

    if (principal.type === 'user') {
      return principal.userEntityRef;
    }

    throw new Error(`Unsupported principal type: ${principal.type}`);
  } catch (error) {
    throw new Error('User not authenticated');
  }
}

/**
 * Test cluster access with user's token
 */
async function testClusterAccess(
  clusterUrl: string,
  token: string,
  skipTLSVerify: boolean,
  logger: Logger,
): Promise<{
  success: boolean;
  username?: string;
  groups?: string[];
  authenticated?: boolean;
  error?: string;
  statusCode?: number;
}> {
  try {
    logger.info(`Testing cluster access to: ${clusterUrl}`, {
      skipTLSVerify,
      tokenPreview: `${token.substring(0, 20)}...`,
    });

    // Create HTTPS agent with TLS verification settings
    const httpsAgent = new https.Agent({
      rejectUnauthorized: !skipTLSVerify,
    });

    // Test 1: Get API versions (always works if token is valid)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000); // 3 second timeout

    const apiResponse = await fetch(`${clusterUrl}/api`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      agent: httpsAgent,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!apiResponse.ok) {
      // Try to get more details from the response body
      let errorDetails = '';
      try {
        const responseText = await apiResponse.text();
        errorDetails = responseText ? ` - Details: ${responseText.substring(0, 500)}` : '';
      } catch (e) {
        // Ignore if can't read body
      }

      logger.warn(`Cluster API test failed`, {
        status: apiResponse.status,
        statusText: apiResponse.statusText,
        clusterUrl,
      });

      return {
        success: false,
        error: `API server returned ${apiResponse.status}: ${apiResponse.statusText}${errorDetails}`,
        statusCode: apiResponse.status,
      };
    }

    // Test 2: TokenReview API (shows who Kubernetes sees)
    const controller2 = new AbortController();
    const timeout2 = setTimeout(() => controller2.abort(), 3000);

    const tokenReviewResponse = await fetch(`${clusterUrl}/apis/authentication.k8s.io/v1/tokenreviews`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        apiVersion: 'authentication.k8s.io/v1',
        kind: 'TokenReview',
        spec: {
          token: token,
        },
      }),
      agent: httpsAgent,
      signal: controller2.signal,
    });
    clearTimeout(timeout2);

    if (!tokenReviewResponse.ok) {
      return {
        success: false,
        error: `TokenReview failed: ${tokenReviewResponse.status}`,
        statusCode: tokenReviewResponse.status,
      };
    }

    const tokenReviewData: any = await tokenReviewResponse.json();
    const status = tokenReviewData.status || {};

    logger.info(`TokenReview result`, {
      authenticated: status.authenticated,
      username: status.user?.username,
      groups: status.user?.groups,
    });

    return {
      success: true,
      authenticated: status.authenticated,
      username: status.user?.username,
      groups: status.user?.groups || [],
    };
  } catch (error: any) {
    logger.error('Cluster access test failed', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Create debug router
 */
export async function createDebugRouter(
  options: ClusterAuthDebugOptions,
): Promise<Router> {
  const { logger, httpAuth, clusterAuthStore } = options;
  const router = Router();

  router.use(express.json());

  /**
   * GET /api/cluster-auth/debug/user-info
   *
   * Show current user's cluster authentication details
   */
  router.get('/user-info', async (req, res) => {
    try {
      const userEntityRef = await getUserEntityRef(req, httpAuth);

      const tokens = await clusterAuthStore.getTokens(userEntityRef);

      if (!tokens) {
        return res.json({
          user: userEntityRef,
          authenticated: false,
          message: 'No cluster tokens found. Please authenticate first.',
        });
      }

      // Check expiration
      const isExpired = tokens.expiresAt.getTime() < Date.now();
      const timeUntilExpiry = tokens.expiresAt.getTime() - Date.now();
      const hoursUntilExpiry = Math.floor(timeUntilExpiry / (1000 * 60 * 60));

      res.json({
        user: userEntityRef,
        authenticated: true,
        tokenInfo: {
          issuer: tokens.issuer,
          expiresAt: tokens.expiresAt.toISOString(),
          isExpired,
          hoursUntilExpiry,
          createdAt: tokens.createdAt?.toISOString(),
          updatedAt: tokens.updatedAt?.toISOString(),
          hasRefreshToken: !!tokens.refreshToken,
        },
        tokenPreviews: {
          accessToken: tokens.accessToken,  // Full access token for debugging
          idToken: tokens.idToken,  // Full ID token for debugging
        },
      });
    } catch (error: any) {
      logger.error('Failed to get user info', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/cluster-auth/debug/test-cluster
   *
   * Test cluster access with user's token
   */
  router.post('/test-cluster', async (req, res) => {
    try {
      const userEntityRef = await getUserEntityRef(req, httpAuth);
      const { clusterUrl, skipTLSVerify } = req.body;

      if (!clusterUrl) {
        return res.status(400).json({
          error: 'Missing clusterUrl in request body',
        });
      }

      const tokens = await clusterAuthStore.getTokens(userEntityRef);

      if (!tokens) {
        return res.status(401).json({
          error: 'No cluster tokens found',
          message: 'Please authenticate first at /cluster-auth',
        });
      }

      // Check if expired
      if (tokens.expiresAt.getTime() < Date.now()) {
        return res.status(401).json({
          error: 'Token expired',
          message: 'Please re-authenticate',
        });
      }

      // Test cluster access
      // IMPORTANT: Use ID token (signed JWT), not access token (encrypted JWE)
      const result = await testClusterAccess(
        clusterUrl,
        tokens.idToken,
        skipTLSVerify || false,
        logger,
      );

      res.json({
        user: userEntityRef,
        cluster: clusterUrl,
        testResult: result,
      });
    } catch (error: any) {
      logger.error('Failed to test cluster access', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/cluster-auth/debug/api-requests
   *
   * Show recent Kubernetes API requests made with user tokens
   */
  router.get('/api-requests', async (req, res) => {
    try {
      const userEntityRef = await getUserEntityRef(req, httpAuth);

      // Filter requests for this user
      const userRequests = recentApiRequests.filter(
        r => r.user === userEntityRef,
      );

      res.json({
        user: userEntityRef,
        totalRequests: userRequests.length,
        requests: userRequests.slice(0, 50), // Return last 50
      });
    } catch (error: any) {
      logger.error('Failed to get API requests', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/cluster-auth/debug/all-api-requests
   *
   * Show all recent Kubernetes API requests (all users)
   * Useful for debugging/monitoring
   */
  router.get('/all-api-requests', async (req, res) => {
    try {
      // Optional: Require admin permission
      // const userEntityRef = await getUserEntityRef(req, httpAuth);
      // if (!isAdmin(userEntityRef)) { return 403; }

      res.json({
        totalRequests: recentApiRequests.length,
        requests: recentApiRequests.slice(0, 100),
      });
    } catch (error: any) {
      logger.error('Failed to get all API requests', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * DELETE /api/cluster-auth/debug/api-requests
   *
   * Clear API request history
   */
  router.delete('/api-requests', async (req, res) => {
    try {
      recentApiRequests.length = 0;
      res.json({ status: 'ok', message: 'API request history cleared' });
    } catch (error: any) {
      logger.error('Failed to clear API requests', error);
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}
