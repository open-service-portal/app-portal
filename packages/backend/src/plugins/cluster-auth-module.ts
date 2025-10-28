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
      },
      async init({ logger, http, database, config }) {
        const winstonLogger = loggerToWinstonLogger(logger);

        // Get database client (Knex)
        const { client } = await database.getClient();

        // Get optional config for token validation
        const issuer = config.getOptionalString('clusterAuth.issuer');
        const verifySignature = config.getOptionalBoolean('clusterAuth.verifySignature') ?? false;

        if (issuer) {
          logger.info('Cluster auth configured with OIDC issuer', { issuer });
        } else {
          logger.warn('Cluster auth: No issuer configured, token validation will be limited');
        }

        const router = createRouter({
          logger: winstonLogger,
          database: client,
          issuer,
          verifySignature,
        });

        http.use(router);

        logger.info('Cluster authentication plugin initialized');
      },
    });
  },
});
