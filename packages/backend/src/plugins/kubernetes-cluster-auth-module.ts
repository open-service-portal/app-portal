/**
 * Backend Module: Kubernetes Cluster-Auth Integration
 *
 * This module registers our custom 'clusterAuth' authentication provider
 * with the kubernetes-backend plugin, allowing it to use tokens from
 * the cluster-auth plugin database.
 *
 * Architecture:
 *   1. User authenticates via oidc-authenticator daemon
 *   2. Tokens stored in cluster_tokens table (cluster-auth plugin)
 *   3. This module provides those tokens to kubernetes-backend
 *   4. Kubernetes API calls use user's OIDC token (not service account)
 *   5. User sees only resources they have RBAC permissions for
 */

import {
  coreServices,
  createBackendModule,
} from '@backstage/backend-plugin-api';
import { kubernetesAuthStrategyExtensionPoint } from '@backstage/plugin-kubernetes-node';
import { ClusterAuthStore } from './cluster-auth-store';
import { createClusterAuthProvider } from './kubernetes-auth-provider';

export const kubernetesClusterAuthModule = createBackendModule({
  pluginId: 'kubernetes',
  moduleId: 'cluster-auth-strategy',
  register(reg) {
    reg.registerInit({
      deps: {
        logger: coreServices.logger,
        database: coreServices.database,
        kubernetesAuthStrategy: kubernetesAuthStrategyExtensionPoint,
      },
      async init({ logger, database, kubernetesAuthStrategy }) {
        logger.info('Initializing Kubernetes cluster-auth authentication strategy');

        // Initialize the cluster auth store
        const clusterAuthStore = await ClusterAuthStore.create(database, logger);

        // Create our custom auth provider
        const clusterAuthProvider = createClusterAuthProvider({
          clusterAuthStore,
          logger,
        });

        // Register it with the kubernetes plugin as 'clusterAuth'
        kubernetesAuthStrategy.addAuthStrategy('clusterAuth', clusterAuthProvider);

        logger.info('✅ Kubernetes cluster-auth strategy registered successfully');
        logger.info('   Usage: Set authProvider: "clusterAuth" in kubernetes cluster config');
      },
    });
  },
});

export default kubernetesClusterAuthModule;
