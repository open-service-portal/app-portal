import {
  coreServices,
  createBackendModule,
} from '@backstage/backend-plugin-api';
import {
  catalogServiceRef,
  catalogProcessingExtensionPoint,
} from '@backstage/plugin-catalog-node/alpha';
import { XRDTemplateEntityProvider } from './provider/XRDTemplateEntityProvider';

export const catalogModuleCrossplaneIngestor = createBackendModule({
  pluginId: 'catalog',
  moduleId: 'crossplane-ingestor',
  register(reg) {
    reg.registerInit({
      deps: {
        catalog: catalogProcessingExtensionPoint,
        logger: coreServices.logger,
        config: coreServices.rootConfig,
        discovery: coreServices.discovery,
        catalogApi: catalogServiceRef,
        permissions: coreServices.permissions,
        auth: coreServices.auth,
        httpAuth: coreServices.httpAuth,
        scheduler: coreServices.scheduler,
      },
      async init({
        catalog,
        logger,
        config,
        catalogApi,
        permissions,
        discovery,
        httpAuth,
        auth,
        scheduler,
      }) {
        // Check if this plugin should run based on selector
        const ingestorSelector = config.getOptionalString('ingestorSelector') ?? 'kubernetes-ingestor';
        if (ingestorSelector !== 'crossplane-ingestor') {
          logger.info(`Crossplane Ingestor skipped - using ${ingestorSelector}`);
          return;
        }

        const taskRunner = scheduler.createScheduledTaskRunner({
          frequency: {
            seconds: config.getOptionalNumber(
              'kubernetesIngestor.crossplane.xrds.taskRunner.frequency',
            ) ?? 600,
          },
          timeout: {
            seconds: config.getOptionalNumber(
              'kubernetesIngestor.crossplane.xrds.taskRunner.timeout',
            ) ?? 600,
          },
        });

        logger.info('Initializing Crossplane Ingestor (refactored version with 87% code reduction)');

        const xrdTemplateEntityProvider = new XRDTemplateEntityProvider(
          taskRunner,
          logger,
          config,
          catalogApi,
          discovery,
          permissions,
          auth,
          httpAuth,
        );

        await catalog.addEntityProvider(xrdTemplateEntityProvider);
      },
    });
  },
});
