/**
 * Builds Backstage API entities from XRDs
 */

import { XRD, XRDVersion, BackstageApiEntity } from '../types';

export class ApiEntityBuilder {
  constructor(
    private readonly config: {
      owner?: string;
      system?: string;
      additionalTags?: string[];
    } = {}
  ) {}

  /**
   * Builds a Backstage API entity from an XRD
   */
  build(xrd: XRD, version: XRDVersion): BackstageApiEntity {
    const apiEntity: BackstageApiEntity = {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'API',
      metadata: this.buildMetadata(xrd, version),
      spec: this.buildSpec(xrd, version)
    };

    return apiEntity;
  }

  /**
   * Builds API entity metadata
   */
  private buildMetadata(xrd: XRD, version: XRDVersion): {
    name: string;
    title: string;
    description: string;
    tags: string[];
    annotations: Record<string, string>;
  } {
    const xrKind = xrd.spec.names.kind;
    const claimKind = xrd.spec.claimNames?.kind;
    const resourceKind = claimKind || xrKind;
    const xrdAnnotations = xrd.metadata.annotations || {};

    const metadata = {
      name: xrd.metadata.name.replace(/\./g, '-'),
      title: `${resourceKind} API`,
      description: xrdAnnotations['backstage.io/description'] || 
                  xrdAnnotations['openportal.dev/description'] || 
                  `Crossplane API for ${resourceKind} resources`,
      tags: this.extractTags(xrd),
      annotations: {} as Record<string, string>
    };

    // Add XRD reference
    metadata.annotations['crossplane.io/xrd'] = xrd.metadata.name;
    metadata.annotations['crossplane.io/api-version'] = xrd.apiVersion.includes('v2') ? 'v2' : 'v1';
    metadata.annotations['crossplane.io/scope'] = xrd.spec.scope || 'Cluster';

    // Add source location if available
    if (xrdAnnotations['backstage.io/source-location']) {
      metadata.annotations['backstage.io/source-location'] = xrdAnnotations['backstage.io/source-location'];
    }

    return metadata;
  }

  /**
   * Extracts tags for the API entity
   */
  private extractTags(xrd: XRD): string[] {
    const tags: Set<string> = new Set();
    
    // Add default tags
    tags.add('crossplane');
    tags.add('kubernetes');
    tags.add('api');
    
    // Add version tag
    const apiVersion = xrd.apiVersion.split('/')[1];
    tags.add(`crossplane-${apiVersion}`);

    // Extract from labels
    const labels = xrd.metadata.labels || {};
    if (labels['openportal.dev/tags']) {
      labels['openportal.dev/tags'].split(',').forEach(tag => tags.add(tag.trim()));
    }

    // Add configured tags
    if (this.config.additionalTags) {
      this.config.additionalTags.forEach(tag => tags.add(tag));
    }

    return [...tags];
  }

  /**
   * Builds API entity spec with OpenAPI definition
   */
  private buildSpec(xrd: XRD, version: XRDVersion): {
    type: string;
    lifecycle: string;
    owner: string;
    system?: string;
    definition: string;
  } {
    return {
      type: 'openapi',
      lifecycle: 'production',
      owner: this.config.owner || 'platform-team',
      system: this.config.system || 'crossplane',
      definition: this.generateOpenApiSpec(xrd, version)
    };
  }

  /**
   * Generates OpenAPI specification from XRD
   */
  private generateOpenApiSpec(xrd: XRD, version: XRDVersion): string {
    const group = xrd.spec.group;
    const versionName = version.name;
    const plural = xrd.spec.names.plural;
    const kind = xrd.spec.names.kind;
    const isNamespaced = xrd.spec.scope === 'Namespaced';

    const openapi = {
      openapi: '3.0.0',
      info: {
        title: `${kind} API`,
        version: versionName,
        description: `API for managing ${kind} resources through Crossplane`
      },
      paths: this.generatePaths(group, versionName, plural, isNamespaced),
      components: {
        schemas: this.generateSchemas(xrd, version)
      }
    };

    return JSON.stringify(openapi, null, 2);
  }

  /**
   * Generates OpenAPI paths
   */
  private generatePaths(group: string, version: string, plural: string, isNamespaced: boolean): any {
    const basePath = `/apis/${group}/${version}`;
    const paths: any = {};

    if (isNamespaced) {
      // Namespaced resources
      paths[`${basePath}/namespaces/{namespace}/${plural}`] = {
        get: {
          summary: `List ${plural} in a namespace`,
          parameters: [
            {
              name: 'namespace',
              in: 'path',
              required: true,
              schema: { type: 'string' }
            }
          ],
          responses: {
            '200': {
              description: `List of ${plural}`,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      items: {
                        type: 'array',
                        items: { '$ref': '#/components/schemas/Resource' }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        post: {
          summary: `Create a resource in a namespace`,
          parameters: [
            {
              name: 'namespace',
              in: 'path',
              required: true,
              schema: { type: 'string' }
            }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { '$ref': '#/components/schemas/Resource' }
              }
            }
          },
          responses: {
            '201': { description: 'Resource created successfully' }
          }
        }
      };
    } else {
      // Cluster-scoped resources
      paths[`${basePath}/${plural}`] = {
        get: {
          summary: `List all ${plural}`,
          description: `Returns a list of all ${plural} resources in the cluster`,
          responses: {
            '200': {
              description: `List of ${plural}`,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      items: {
                        type: 'array',
                        items: { '$ref': '#/components/schemas/Resource' }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        post: {
          summary: `Create a resource`,
          description: `Creates a new resource`,
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { '$ref': '#/components/schemas/Resource' }
              }
            }
          },
          responses: {
            '201': { description: 'Resource created successfully' }
          }
        }
      };
    }

    return paths;
  }

  /**
   * Generates OpenAPI schemas from XRD
   */
  private generateSchemas(xrd: XRD, version: XRDVersion): any {
    const schemas: any = {
      Resource: {
        type: 'object',
        required: ['apiVersion', 'kind', 'metadata', 'spec'],
        properties: {
          apiVersion: {
            type: 'string',
            enum: [`${xrd.spec.group}/${version.name}`],
            description: 'API version of the resource'
          },
          kind: {
            type: 'string',
            enum: [xrd.spec.names.kind],
            description: 'Kind of the resource'
          },
          metadata: {
            type: 'object',
            required: ['name'],
            properties: {
              name: {
                type: 'string',
                pattern: '^[a-z0-9]([-a-z0-9]*[a-z0-9])?$',
                maxLength: 63,
                description: 'Name of the resource'
              }
            }
          },
          spec: version.schema?.openAPIV3Schema?.properties?.spec || {
            type: 'object',
            description: 'Resource specification'
          },
          status: {
            type: 'object',
            description: 'Resource status',
            properties: {
              conditions: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    type: { type: 'string' },
                    status: { type: 'string', enum: ['True', 'False', 'Unknown'] },
                    reason: { type: 'string' },
                    message: { type: 'string' }
                  }
                }
              }
            }
          }
        }
      }
    };

    return schemas;
  }
}