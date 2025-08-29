import { 
  createBackendModule,
  coreServices,
} from '@backstage/backend-plugin-api';
import { catalogProcessingExtensionPoint } from '@backstage/plugin-catalog-node/alpha';
import { SourceTagProcessor } from './processor/SourceTagProcessor';

/**
 * Catalog module that adds automatic source tagging to entities.
 * 
 * This module registers a processor that automatically adds tags based on 
 * where entities are imported from (GitHub, Kubernetes, etc.)
 */
export const catalogModuleSourceTagger = createBackendModule({
  pluginId: 'catalog',
  moduleId: 'source-tagger',
  register(env) {
    env.registerInit({
      deps: {
        catalog: catalogProcessingExtensionPoint,
        logger: coreServices.logger,
        config: coreServices.rootConfig,
      },
      async init({ catalog, logger, config }) {
        // Check if module is enabled (optional configuration)
        const isEnabled = config.getOptionalBoolean('catalog.processors.sourceTagger.enabled') ?? true;
        
        if (!isEnabled) {
          logger.info('SourceTagProcessor is disabled via configuration');
          return;
        }
        
        // Register our custom processor
        catalog.addProcessor(new SourceTagProcessor(logger));
        
        logger.info('SourceTagProcessor registered - will auto-tag entities based on import source');
      },
    });
  },
});