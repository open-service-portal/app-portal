/**
 * Custom Kubernetes Auth Provider for Cluster-Auth Tokens
 *
 * This provider integrates with the cluster-auth plugin to retrieve
 * user-specific OIDC tokens for Kubernetes API authentication.
 *
 * It acts as a drop-in replacement for the standard 'oidc' auth provider,
 * but fetches tokens from our custom storage instead of the standard
 * Backstage OIDC flow.
 *
 * Usage in app-config.yaml:
 *   kubernetes:
 *     clusterLocatorMethods:
 *       - type: config
 *         clusters:
 *           - name: openportal
 *             url: https://...
 *             authProvider: 'clusterAuth'  # ← Use this custom provider
 *             skipTLSVerify: false
 *             caData: ${K8S_CA_DATA}
 */

import {
  KubernetesAuthProvider,
  KubernetesAuthProvidersConfig,
} from '@backstage/plugin-kubernetes-node';
import { ClusterAuthStore } from './cluster-auth-store';
import { Logger } from 'winston';
import { logKubernetesApiRequest } from './cluster-auth-debug';

export interface ClusterAuthProviderConfig {
  clusterAuthStore: ClusterAuthStore;
  logger: Logger;
}

/**
 * Kubernetes auth provider that uses tokens from cluster-auth plugin
 */
export class ClusterAuthKubernetesProvider implements KubernetesAuthProvider {
  private readonly store: ClusterAuthStore;
  private readonly logger: Logger;

  constructor(config: ClusterAuthProviderConfig) {
    this.store = config.clusterAuthStore;
    this.logger = config.logger;
  }

  /**
   * Decorate Kubernetes client configuration with user's access token
   *
   * This is called by the kubernetes-backend plugin before making API calls
   */
  async decorateClusterDetailsWithAuth(
    clusterDetails: any,
    requestContext: { credentials: any },
  ): Promise<any> {
    const { credentials } = requestContext;

    // Extract user entity ref from Backstage credentials
    const userEntityRef = this.extractUserEntityRef(credentials);

    if (!userEntityRef) {
      this.logger.warn('No user entity ref found in request context');
      throw new Error(
        'User authentication required. Please log in to Backstage.',
      );
    }

    this.logger.debug('Fetching cluster auth token for user', { userEntityRef });

    // Fetch user's cluster tokens from database
    const tokens = await this.store.getTokens(userEntityRef);

    if (!tokens) {
      this.logger.warn('No cluster tokens found for user', { userEntityRef });
      throw new Error(
        'No cluster authentication found. Please authenticate at Settings → Auth Providers → Kubernetes Cluster.',
      );
    }

    // Check if token is expired
    if (tokens.expiresAt.getTime() < Date.now()) {
      this.logger.warn('Cluster token expired for user', {
        userEntityRef,
        expiresAt: tokens.expiresAt.toISOString(),
      });
      throw new Error(
        'Cluster authentication expired. Please re-authenticate at Settings → Auth Providers.',
      );
    }

    this.logger.debug('Using cluster auth token for Kubernetes API', {
      userEntityRef,
      expiresAt: tokens.expiresAt.toISOString(),
    });

    // Log this request for debugging
    logKubernetesApiRequest({
      timestamp: new Date().toISOString(),
      user: userEntityRef,
      method: 'KUBERNETES_AUTH',
      url: clusterDetails.url || clusterDetails.name,
      tokenPreview: `${tokens.accessToken.substring(0, 15)}...${tokens.accessToken.substring(tokens.accessToken.length - 10)}`,
    });

    // Return cluster details with user's access token
    // This mimics the structure returned by other auth providers
    return {
      ...clusterDetails,
      serviceAccountToken: undefined, // Remove service account token if present
      user: {
        token: tokens.accessToken, // User's OIDC access token
      },
    };
  }

  /**
   * Validate cluster configuration
   *
   * This method is called during initialization to validate the cluster config.
   * Note: Backstage calls this with auth metadata, not the full cluster config.
   * Returns an empty array if valid, or an array of Error objects if invalid.
   */
  validateCluster(authMetadata: any): Error[] {
    // No validation needed for clusterAuth - tokens are validated at request time
    // Just ensure this is being called for the correct auth provider
    const authProvider = authMetadata?.['kubernetes.io/auth-provider'];

    this.logger.debug('validateCluster called', {
      authProvider,
    });

    // Return empty array to indicate successful validation
    return [];
  }

  /**
   * Present authentication metadata
   *
   * This method is called to provide auth metadata in API responses.
   * For clusterAuth, we don't expose any auth metadata in the API.
   */
  presentAuthMetadata(_authMetadata: any): any {
    return {};
  }

  /**
   * Get credential for proxying requests
   *
   * This method is called by the kubernetes-backend plugin when proxying
   * requests to the Kubernetes API (e.g., for pod logs, exec, etc.)
   *
   * This provider only handles user OIDC tokens.
   * Background tasks should use a separate cluster with serviceAccount auth.
   */
  async getCredential(
    clusterDetails: any,
    requestContext: { credentials: any },
  ): Promise<{ type: string; token?: string } | undefined> {
    const { credentials } = requestContext;

    // Extract user entity ref from Backstage credentials
    const userEntityRef = this.extractUserEntityRef(credentials);

    if (!userEntityRef) {
      this.logger.debug('No user context - skipping clusterAuth (use separate cluster with serviceAccount for background tasks)');
      // Return undefined - this cluster is not for background tasks
      return undefined;
    }

    this.logger.debug('Getting credential for proxy request', {
      userEntityRef,
      cluster: clusterDetails.name || clusterDetails.url,
    });

    // Fetch user's cluster tokens from database
    const tokens = await this.store.getTokens(userEntityRef);

    if (!tokens) {
      this.logger.warn('No cluster tokens found for user in getCredential', { userEntityRef });
      throw new Error(
        'No cluster authentication found. Please authenticate at Settings → Auth Providers → Kubernetes Cluster.',
      );
    }

    // Check if token is expired
    if (tokens.expiresAt.getTime() < Date.now()) {
      this.logger.warn('Cluster token expired for user in getCredential', {
        userEntityRef,
        expiresAt: tokens.expiresAt.toISOString(),
      });
      throw new Error(
        'Cluster authentication expired. Please re-authenticate at Settings → Auth Providers.',
      );
    }

    this.logger.debug('Returning credential for proxy request', {
      userEntityRef,
      expiresAt: tokens.expiresAt.toISOString(),
    });

    // Return credential in the format expected by kubernetes-backend
    return {
      type: 'bearer',
      token: tokens.accessToken,
    };
  }

  /**
   * Extract user entity ref from Backstage credentials
   */
  private extractUserEntityRef(credentials: any): string | undefined {
    try {
      // Backstage credentials structure (New Backend System)
      if (credentials?.principal?.type === 'user') {
        return credentials.principal.userEntityRef;
      }

      // Fallback: try to extract from different credential structures
      if (credentials?.userEntityRef) {
        return credentials.userEntityRef;
      }

      return undefined;
    } catch (error) {
      this.logger.error('Failed to extract user entity ref', error);
      return undefined;
    }
  }
}

/**
 * Factory function to create the custom auth provider
 *
 * This is called by the kubernetes-backend plugin when it sees
 * authProvider: 'clusterAuth' in the configuration
 */
export function createClusterAuthProvider(
  config: ClusterAuthProviderConfig,
): KubernetesAuthProvider {
  return new ClusterAuthKubernetesProvider(config);
}
