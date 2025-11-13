import { CatalogProcessor, CatalogProcessorEmit, CatalogProcessorCache } from '@backstage/plugin-catalog-node';
import { Entity, LocationSpec } from '@backstage/catalog-model';
import { LoggerService } from '@backstage/backend-plugin-api';

/**
 * Catalog processor that ensures all location-related annotations have 'url:' prefix.
 *
 * The GitHub provider sometimes sets location annotations without the 'url:' prefix,
 * which causes the Scaffolder backend to fail when executing templates.
 *
 * This processor fixes the following annotations:
 * - backstage.io/managed-by-location
 * - backstage.io/managed-by-origin-location
 * - backstage.io/source-location
 * - backstage.io/view-url
 * - backstage.io/edit-url
 */
export class LocationAnnotationFixer implements CatalogProcessor {
  constructor(private readonly logger: LoggerService) {}

  getProcessorName(): string {
    return 'LocationAnnotationFixer';
  }

  private fixAnnotations(entity: Entity): Entity {
    const annotations = entity.metadata.annotations;

    if (!annotations) {
      return entity;
    }

    // List of annotations that should have 'url:' prefix
    const locationAnnotations = [
      'backstage.io/managed-by-location',
      'backstage.io/managed-by-origin-location',
      'backstage.io/source-location',
      'backstage.io/view-url',
      'backstage.io/edit-url',
    ];

    let fixed = false;

    for (const key of locationAnnotations) {
      const value = annotations[key];

      if (value && typeof value === 'string') {
        // Check if it's a URL without 'url:' prefix
        if (value.match(/^https?:\/\//) && !value.startsWith('url:')) {
          annotations[key] = `url:${value}`;
          fixed = true;

          this.logger.debug(
            `Fixed annotation '${key}' for entity '${entity.metadata.name}': added 'url:' prefix`
          );
        }
      }
    }

    if (fixed) {
      this.logger.info(
        `Fixed location annotations for entity '${entity.kind}:${entity.metadata.namespace}/${entity.metadata.name}'`
      );
    }

    return entity;
  }

  async preProcessEntity(
    entity: Entity,
    _location: LocationSpec,
    _emit: CatalogProcessorEmit,
    _originLocation: LocationSpec,
    _cache: CatalogProcessorCache,
  ): Promise<Entity> {
    return this.fixAnnotations(entity);
  }

  async postProcessEntity(
    entity: Entity,
    _location: LocationSpec,
    _emit: CatalogProcessorEmit,
    _cache: CatalogProcessorCache,
  ): Promise<Entity> {
    return this.fixAnnotations(entity);
  }
}
