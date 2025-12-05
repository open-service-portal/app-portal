import {
  coreServices,
  createBackendModule,
} from '@backstage/backend-plugin-api';
import { createRouter } from './router';

/**
 * EntraID User Search Backend Module
 *
 * Provides API endpoint at /api/entra-id/users/search for searching
 * Microsoft Entra ID (Azure AD) users via Graph API.
 *
 * Configuration required in app-config.yaml:
 * ```yaml
 * entraId:
 *   tenantId: ${ENTRA_TENANT_ID}
 *   clientId: ${ENTRA_CLIENT_ID}
 *   clientSecret: ${ENTRA_CLIENT_SECRET}
 * ```
 *
 * Required permissions in Azure AD App Registration:
 * - User.Read.All (Application permission)
 *
 * @public
 */
export const entraIdUserSearchModule = createBackendModule({
  pluginId: 'app',
  moduleId: 'entra-id-user-search',
  register(reg) {
    reg.registerInit({
      deps: {
        logger: coreServices.logger,
        config: coreServices.rootConfig,
        rootHttpRouter: coreServices.rootHttpRouter,
      },
      async init({ logger, config, rootHttpRouter }) {
        // Check if EntraID is configured
        const tenantId = config.getOptionalString('entraId.tenantId');
        const clientId = config.getOptionalString('entraId.clientId');
        const clientSecret = config.getOptionalString('entraId.clientSecret');

        if (!tenantId || !clientId || !clientSecret) {
          logger.info('EntraID configuration not found, skipping EntraID User Search module');
          logger.info('To enable, add the following to your app-config.yaml:');
          logger.info('entraId:');
          logger.info('  tenantId: ${ENTRA_TENANT_ID}');
          logger.info('  clientId: ${ENTRA_CLIENT_ID}');
          logger.info('  clientSecret: ${ENTRA_CLIENT_SECRET}');
          return;
        }

        logger.info('Initializing EntraID User Search module');

        const router = await createRouter({
          logger,
          config,
        });

        // Use rootHttpRouter for custom path registration
        // Direct registration at /api/entra-id/users
        rootHttpRouter.use('/api/entra-id/users', router);

        logger.info('EntraID User Search module initialized at /api/entra-id/users');
      },
    });
  },
});

export default entraIdUserSearchModule;
