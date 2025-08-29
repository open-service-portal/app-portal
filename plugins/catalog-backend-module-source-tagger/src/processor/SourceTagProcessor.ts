import { 
  CatalogProcessor, 
  CatalogProcessorEmit,
  processingResult
} from '@backstage/plugin-catalog-node';
import { Entity } from '@backstage/catalog-model';
import { LocationSpec } from '@backstage/plugin-catalog-common';
import { LoggerService } from '@backstage/backend-plugin-api';

/**
 * A processor that automatically adds source tags to entities based on their import location.
 * 
 * This processor adds tags like:
 * - source:github-discovered - for templates discovered via GitHub discovery
 * - source:github-url - for direct GitHub URLs
 * - org:<orgname> - organization tags based on GitHub URL
 * 
 * Note: The kubernetes-ingestor plugin already adds source:kubernetes-ingestor
 */
export class SourceTagProcessor implements CatalogProcessor {
  constructor(private readonly logger: LoggerService) {}

  getProcessorName(): string {
    return 'SourceTagProcessor';
  }

  async preProcessEntity(
    entity: Entity,
    location: LocationSpec,
    emit: CatalogProcessorEmit,
  ): Promise<Entity> {
    // Only process Templates for now (can be extended to other kinds)
    if (entity.kind !== 'Template') {
      return entity;
    }

    // Start with existing tags or empty array
    const existingTags = entity.metadata.tags || [];
    const tags = new Set(existingTags);
    
    // Check if this comes from GitHub discovery
    // GitHub discovery sets type as 'url' but we can detect it by checking for template.yaml pattern
    const isGithubDiscovery = location.type === 'url' && 
                              location.target?.includes('github.com') && 
                              location.target?.includes('/template.yaml');
    
    if (isGithubDiscovery) {
      tags.add('source:github-discovered');
      tags.add('auto-discovered');
    } 
    // Check if this is a direct GitHub URL (not from discovery)
    else if (location.type === 'url' && location.target?.includes('github.com')) {
      tags.add('source:github-url');
    }
    
    // Extract organization from GitHub URLs
    const githubMatch = location.target?.match(/github\.com\/([^\/]+)/);
    if (githubMatch) {
      const org = githubMatch[1];
      tags.add(`org:${org}`);
      
      // Add specific tags for known organizations
      if (org === 'open-service-portal') {
        tags.add('official');
      }
    }

    // Add discovery timestamp as annotation (not tag)
    // Only add source-location if it's a URL (not for kubernetes origins)
    const annotations: Record<string, string> = {
      ...entity.metadata.annotations,
      'backstage.io/discovered-at': new Date().toISOString(),
    };
    
    // Only set source-location for URL-based locations
    if (location.type === 'url' && location.target) {
      annotations['backstage.io/source-location'] = location.target;
    }

    // Log the tagging for debugging (only in debug mode)
    if (tags.size > existingTags.length) {
      const newTags = Array.from(tags).filter(t => !existingTags.includes(t));
      this.logger.debug(`Added tags to ${entity.kind}:${entity.metadata.name}: ${newTags.join(', ')}`);
    }

    // Return entity with updated metadata
    return {
      ...entity,
      metadata: {
        ...entity.metadata,
        tags: Array.from(tags),
        annotations,
      },
    };
  }

  // Optional: Post-process to validate tags
  async postProcessEntity(
    entity: Entity,
    location: LocationSpec,
    emit: CatalogProcessorEmit,
  ): Promise<Entity> {
    // Remove duplicate tags if any
    if (entity.metadata.tags) {
      entity.metadata.tags = [...new Set(entity.metadata.tags)];
    }
    return entity;
  }
}