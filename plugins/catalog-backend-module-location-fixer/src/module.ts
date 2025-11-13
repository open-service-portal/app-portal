import {
  createBackendModule,
  coreServices,
} from '@backstage/backend-plugin-api';
import { catalogProcessingExtensionPoint } from '@backstage/plugin-catalog-node/alpha';
import { LocationAnnotationFixer } from './processor/LocationAnnotationFixer';

/**
 * Catalog module that fixes location annotations to include 'url:' prefix.
 *
 * This module registers a processor that ensures all location-related annotations
 * have the required 'url:' prefix, which is needed by the Scaffolder backend.
 */
export const catalogModuleLocationFixer = createBackendModule({
  pluginId: 'catalog',
  moduleId: 'location-fixer',
  register(env) {
    env.registerInit({
      deps: {
        catalog: catalogProcessingExtensionPoint,
        logger: coreServices.logger,
      },
      async init({ catalog, logger }) {
        // Register our custom processor
        catalog.addProcessor(new LocationAnnotationFixer(logger));

        logger.info('LocationAnnotationFixer registered - will fix location annotations with url: prefix');
      },
    });
  },
});
