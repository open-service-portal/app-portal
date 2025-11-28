import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { createRouter } from './service/router';
import { KubernetesClient } from './service/KubernetesClient';
import { ClusterConfig } from './types';

/**
 * Crossplane backend plugin
 *
 * Provides API endpoints for querying Crossplane XR instances from Kubernetes clusters.
 *
 * @public
 */
export const crossplanePlugin = createBackendPlugin({
  pluginId: 'crossplane-backend',
  register(env) {
    env.registerInit({
      deps: {
        logger: coreServices.logger,
        config: coreServices.rootConfig,
        httpRouter: coreServices.httpRouter,
      },
      async init({ logger, config, httpRouter }) {
        logger.info('Initializing Crossplane backend plugin');

        // Read Kubernetes cluster configuration
        const kubernetesConfig = config.getOptionalConfig('kubernetes');
        if (!kubernetesConfig) {
          logger.warn('No kubernetes configuration found in app-config.yaml');
          logger.warn('Crossplane backend will not be able to query any clusters');
        }

        const clusters: ClusterConfig[] = [];

        // Parse cluster locator methods
        const clusterLocatorMethods = kubernetesConfig?.getOptionalConfigArray(
          'clusterLocatorMethods',
        );

        if (clusterLocatorMethods) {
          for (const locatorMethod of clusterLocatorMethods) {
            const type = locatorMethod.getString('type');

            if (type === 'config') {
              const clusterConfigs = locatorMethod.getOptionalConfigArray('clusters');
              if (clusterConfigs) {
                for (const clusterConfig of clusterConfigs) {
                  clusters.push({
                    name: clusterConfig.getString('name'),
                    url: clusterConfig.getString('url'),
                    authProvider: clusterConfig.getString('authProvider'),
                    serviceAccountToken: clusterConfig.getOptionalString(
                      'serviceAccountToken',
                    ),
                    skipTLSVerify: clusterConfig.getOptionalBoolean('skipTLSVerify'),
                  });
                }
              }
            }
          }
        }

        if (clusters.length === 0) {
          logger.warn('No Kubernetes clusters configured');
          logger.warn(
            'Add cluster configuration to kubernetes.clusterLocatorMethods in app-config.yaml',
          );
        } else {
          logger.info(`Configured ${clusters.length} Kubernetes cluster(s)`);
        }

        // Initialize Kubernetes client
        const kubernetesClient = new KubernetesClient(logger, clusters);

        // Read auth configuration
        const allowUnauthenticated = config.getOptionalBoolean(
          'crossplane.allowUnauthenticated',
        ) ?? false;

        // Add auth policies BEFORE registering router
        // Default: require authentication (user-cookie)
        // Override: set crossplane.allowUnauthenticated: true in app-config.yaml
        httpRouter.addAuthPolicy({
          path: '/',
          allow: allowUnauthenticated ? 'unauthenticated' : 'user-cookie',
        });

        // Create router
        const router = await createRouter({
          logger,
          kubernetesClient,
        });

        // Register router
        httpRouter.use(router);

        logger.info(
          `Crossplane backend plugin initialized (auth: ${allowUnauthenticated ? 'unauthenticated' : 'authenticated'})`,
        );
      },
    });
  },
});
