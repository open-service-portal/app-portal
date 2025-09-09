/**
 * Extracts parameters from XRD for Backstage template generation
 */

import { 
  XRD, 
  XRDVersion, 
  ParameterSection, 
  ParameterProperty, 
  ExtractorConfig,
  CrossplaneVersion,
  OpenAPIV3Schema
} from '../types';
import { CrossplaneDetector } from './CrossplaneDetector';

export class ParameterExtractor {
  constructor(
    private readonly detector: CrossplaneDetector,
    private readonly config: ExtractorConfig = {}
  ) {}

  /**
   * Extracts all parameter sections from an XRD version
   */
  extract(xrd: XRD, version: XRDVersion): ParameterSection[] {
    const crossplaneVersion = this.detector.detect(xrd);
    const sections: ParameterSection[] = [];

    // Add metadata section
    sections.push(this.extractMetadataSection(xrd, crossplaneVersion));

    // Add resource configuration section from OpenAPI schema
    const resourceSection = this.extractResourceSection(version, crossplaneVersion);
    if (resourceSection) {
      sections.push(resourceSection);
    }

    // Add publishing section if configured
    if (this.config.includePublishing) {
      sections.push(this.extractPublishingSection());
    }

    return sections;
  }

  /**
   * Creates the metadata parameter section
   */
  private extractMetadataSection(xrd: XRD, _version: CrossplaneVersion): ParameterSection {
    const properties: Record<string, ParameterProperty> = {
      xrName: {
        title: 'Name',
        type: 'string',
        description: `Name for the ${this.detector.getResourceKind(xrd)} resource`,
        pattern: '^[a-z0-9]([-a-z0-9]*[a-z0-9])?$',
        maxLength: 63
      },
      owner: {
        title: 'Owner',
        type: 'string',
        description: 'Owner of the resource (user or team)',
        default: 'platform-team'
      }
    };

    // Add namespace parameter if needed
    if (this.detector.needsNamespaceParameter(xrd)) {
      properties.namespace = {
        title: 'Namespace',
        type: 'string',
        description: 'Kubernetes namespace for the resource',
        default: 'default',
        pattern: '^[a-z0-9]([-a-z0-9]*[a-z0-9])?$'
      };
    }

    // Add cluster selection if multiple clusters
    if (xrd.clusters && xrd.clusters.length > 1) {
      properties.cluster = {
        title: 'Cluster',
        type: 'string',
        description: 'Target cluster for deployment',
        enum: xrd.clusters,
        enumNames: xrd.clusters
      };
    }

    return {
      title: 'Resource Metadata',
      required: ['xrName', 'owner'],
      properties
    };
  }

  /**
   * Extracts resource configuration from OpenAPI schema
   */
  private extractResourceSection(version: XRDVersion, _crossplaneVersion: CrossplaneVersion): ParameterSection | null {
    if (!version.schema?.openAPIV3Schema) {
      return null;
    }

    const schema = version.schema.openAPIV3Schema;
    const specSchema = schema.properties?.spec;

    if (!specSchema || !specSchema.properties) {
      return null;
    }

    const properties = this.extractPropertiesFromSchema(specSchema);

    if (Object.keys(properties).length === 0) {
      return null;
    }

    return {
      title: 'Resource Configuration',
      description: 'Configure the resource specifications',
      required: specSchema.required || [],
      properties
    };
  }

  /**
   * Recursively extracts properties from OpenAPI schema
   */
  private extractPropertiesFromSchema(schema: OpenAPIV3Schema): Record<string, ParameterProperty> {
    const properties: Record<string, ParameterProperty> = {};

    if (!schema.properties) {
      return properties;
    }

    for (const [key, value] of Object.entries(schema.properties)) {
      const prop = value as OpenAPIV3Schema;
      
      // Skip complex nested objects for now
      if (prop.type === 'object' && prop.properties) {
        // Could recursively handle nested objects here
        continue;
      }

      // Skip arrays of objects
      if (prop.type === 'array' && prop.items?.type === 'object') {
        continue;
      }

      const parameter: ParameterProperty = {
        title: this.humanizeFieldName(key),
        type: this.mapSchemaType(prop.type || 'string'),
        description: prop.description || ''
      };

      // Add constraints
      if (prop.default !== undefined) {
        parameter.default = this.config.convertDefaultValuesToPlaceholders
          ? `\${{ parameters.${key} | default("${prop.default}") }}`
          : prop.default;
      }

      if (prop.enum) {
        parameter.enum = prop.enum;
        parameter.enumNames = prop.enum.map(String);
      }

      if (prop.pattern) {
        parameter.pattern = prop.pattern;
      }

      if (prop.type === 'string') {
        if (typeof prop.minLength === 'number') {
          parameter.minLength = prop.minLength;
        }
        if (typeof prop.maxLength === 'number') {
          parameter.maxLength = prop.maxLength;
        }
      }

      if (prop.type === 'number' || prop.type === 'integer') {
        if (typeof prop.minimum === 'number') {
          parameter.minimum = prop.minimum;
        }
        if (typeof prop.maximum === 'number') {
          parameter.maximum = prop.maximum;
        }
      }

      properties[key] = parameter;
    }

    return properties;
  }

  /**
   * Creates the publishing parameter section
   */
  private extractPublishingSection(): ParameterSection {
    const publishConfig = this.config.publishPhase || {};
    
    return {
      title: 'Publishing Configuration',
      properties: {
        pushToGit: {
          title: 'Push to Git',
          type: 'boolean',
          description: 'Push the generated manifest to a Git repository',
          default: true
        },
        repoUrl: {
          title: 'Repository Location',
          type: 'string',
          default: publishConfig.git?.repoUrl || 'github.com?owner=open-service-portal&repo=catalog-orders',
          description: 'Repository for the resource instance'
        },
        gitBranch: {
          title: 'Git Branch',
          type: 'string',
          default: publishConfig.git?.targetBranch || 'main',
          description: 'Branch to commit to'
        },
        createPr: {
          title: 'Create Pull Request',
          type: 'boolean',
          default: true,
          description: 'Create a PR instead of direct commit'
        }
      }
    };
  }

  /**
   * Converts field names to human-readable titles
   */
  private humanizeFieldName(fieldName: string): string {
    return fieldName
      .replace(/([A-Z])/g, ' $1')
      .replace(/[_-]/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase())
      .trim();
  }

  /**
   * Maps OpenAPI schema types to Backstage parameter types
   */
  private mapSchemaType(schemaType: string): ParameterProperty['type'] {
    switch (schemaType) {
      case 'integer':
      case 'number':
        return 'number';
      case 'boolean':
        return 'boolean';
      case 'array':
        return 'array';
      case 'object':
        return 'object';
      default:
        return 'string';
    }
  }
}