/**
 * Cluster Authentication Backend Module
 *
 * Registers the cluster authentication router for receiving OIDC tokens
 * from the oidc-authenticator daemon.
 *
 * Uses Backstage's New Backend System with dependency injection for
 * database access and configuration.
 */

import { createBackendModule } from '@backstage/backend-plugin-api';
import { loggerToWinstonLogger } from '@backstage/backend-common';
import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { CatalogClient } from '@backstage/catalog-client';
import { createRouter } from './cluster-auth';

/**
 * Cluster authentication plugin for the new backend system
 *
 * Provides endpoints for receiving and managing cluster OIDC tokens.
 * Much simpler than traditional OAuth since oidc-authenticator daemon
 * handles the OAuth/PKCE flow!
 */
export const clusterAuthPlugin = createBackendPlugin({
  pluginId: 'cluster-auth',
  register(env) {
    env.registerInit({
      deps: {
        logger: coreServices.logger,
        http: coreServices.httpRouter,
        database: coreServices.database,
        config: coreServices.rootConfig,
        httpAuth: coreServices.httpAuth,
        discovery: coreServices.discovery,
        auth: coreServices.auth,
      },
      async init({ logger, http, database, config, httpAuth, discovery, auth }) {
        const winstonLogger = loggerToWinstonLogger(logger);

        // Get optional config for token validation
        const issuer = config.getOptionalString('clusterAuth.issuer');
        const verifySignature = config.getOptionalBoolean('clusterAuth.verifySignature') ?? false;

        if (issuer) {
          logger.info('Cluster auth configured with OIDC issuer', { issuer });
        } else {
          logger.warn('Cluster auth: No issuer configured, token validation will be limited');
        }

        // Create catalog client with service-to-service authentication
        // This allows the cluster-auth plugin to query the catalog without user credentials
        const { token } = await auth.getPluginRequestToken({
          onBehalfOf: await auth.getOwnServiceCredentials(),
          targetPluginId: 'catalog',
        });

        const catalogApi = new CatalogClient({
          discoveryApi: discovery,
          fetchApi: {
            fetch: async (url: string, init?: RequestInit) => {
              return fetch(url, {
                ...init,
                headers: {
                  ...init?.headers,
                  Authorization: `Bearer ${token}`,
                },
              });
            },
          },
        });

        // Pass DatabaseService, httpAuth, and catalogApi directly, following Backstage pattern
        // The router will call database.getClient() when needed
        const router = await createRouter({
          logger: winstonLogger,
          database,
          httpAuth,
          catalogApi,
          issuer,
          verifySignature,
        });

        // Configure auth policies for endpoints
        // POST /tokens - NOW REQUIRES authentication (user must be logged in via GitHub)
        //                The oidc-authenticator daemon will receive and forward the user's
        //                Backstage session cookie/token
        // GET /user-emails - Public debug endpoint for checking email mappings
        // Must be called BEFORE http.use(router)
        http.addAuthPolicy({
          path: '/user-emails',
          allow: 'unauthenticated',
        });

        http.use(router);

        logger.info('Cluster authentication plugin initialized');
      },
    });
  },
});

// Export as default for the new backend system
export default clusterAuthPlugin;
