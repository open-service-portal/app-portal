/**
 * Integration tests for the complete XRD transformation pipeline
 */

import { XRDTransformer } from '../XRDTransformer';
import { CrossplaneDetector } from '../CrossplaneDetector';
import { ParameterExtractor } from '../ParameterExtractor';
import { StepGeneratorV1 } from '../StepGeneratorV1';
import { StepGeneratorV2 } from '../StepGeneratorV2';
import { TemplateBuilder } from '../TemplateBuilder';
import { XRD, BackstageTemplate } from '../../src/types';

describe('XRD Transformation Pipeline Integration', () => {
  let transformer: XRDTransformer;

  beforeEach(() => {
    transformer = new XRDTransformer();
  });

  describe('Crossplane v2 Namespaced XRD', () => {
    const v2NamespacedXRD: XRD = {
      apiVersion: 'apiextensions.crossplane.io/v2',
      kind: 'CompositeResourceDefinition',
      metadata: {
        name: 'databases.platform.io',
        annotations: {
          'backstage.io/title': 'Database Instance',
          'backstage.io/description': 'Managed database provisioning',
          'backstage.io/icon': 'database',
          'openportal.dev/docs-url': 'https://docs.platform.io/databases'
        },
        labels: {
          'openportal.dev/tags': 'database,managed,postgresql'
        }
      },
      spec: {
        group: 'platform.io',
        names: {
          kind: 'Database',
          plural: 'databases',
          singular: 'database'
        },
        scope: 'Namespaced',
        versions: [
          {
            name: 'v1alpha1',
            served: true,
            referenceable: true,
            schema: {
              openAPIV3Schema: {
                type: 'object',
                properties: {
                  spec: {
                    type: 'object',
                    required: ['engine', 'size'],
                    properties: {
                      engine: {
                        type: 'string',
                        description: 'Database engine',
                        enum: ['postgresql', 'mysql', 'mariadb'],
                        default: 'postgresql'
                      },
                      size: {
                        type: 'string',
                        description: 'Instance size',
                        enum: ['small', 'medium', 'large'],
                        default: 'small'
                      },
                      version: {
                        type: 'string',
                        description: 'Database version',
                        pattern: '^[0-9]+\\.[0-9]+$'
                      },
                      storage: {
                        type: 'integer',
                        description: 'Storage in GB',
                        minimum: 10,
                        maximum: 1000,
                        default: 20
                      }
                    }
                  }
                }
              }
            }
          }
        ]
      }
    };

    it('should transform v2 namespaced XRD to template', () => {
      const templates = transformer.transform(v2NamespacedXRD);

      expect(templates).toHaveLength(1);
      const template = templates[0];

      // Check metadata
      expect(template.metadata.name).toBe('databases-template');
      expect(template.metadata.title).toBe('Database Instance');
      expect(template.metadata.description).toBe('Managed database provisioning');
      expect(template.metadata.tags).toContain('database');
      expect(template.metadata.tags).toContain('crossplane-v2');
      expect(template.metadata.tags).toContain('namespaced');

      // Check annotations
      expect(template.metadata.annotations['crossplane.io/xrd']).toBe('databases.platform.io');
      expect(template.metadata.annotations['backstage.io/icon']).toBe('database');

      // Check links
      expect(template.metadata.links).toContainEqual({
        url: 'https://docs.platform.io/databases',
        title: 'Documentation',
        icon: 'docs'
      });

      // Check parameters
      const params = template.spec.parameters;
      expect(params).toHaveLength(2); // Metadata + Configuration

      // Metadata section should include namespace
      const metadataSection = params[0];
      expect(metadataSection.title).toBe('Resource Metadata');
      expect(metadataSection.properties.namespace).toBeDefined();
      expect(metadataSection.required).toContain('xrName');
      expect(metadataSection.required).toContain('owner');

      // Configuration section from OpenAPI
      const configSection = params[1];
      expect(configSection.title).toBe('Resource Configuration');
      expect(configSection.properties.engine).toBeDefined();
      expect(configSection.properties.engine.enum).toEqual(['postgresql', 'mysql', 'mariadb']);
      expect(configSection.properties.size).toBeDefined();
      expect(configSection.properties.storage.minimum).toBe(10);
      expect(configSection.properties.storage.maximum).toBe(1000);
      expect(configSection.required).toEqual(['engine', 'size']);

      // Check steps - should use v2 generator
      const steps = template.spec.steps;
      expect(steps.length).toBeGreaterThan(0);
      const createStep = steps.find(s => s.id === 'create-xr');
      expect(createStep).toBeDefined();
      expect(createStep?.name).toBe('Create Database XR');
      expect(createStep?.action).toBe('kubernetes:apply');
      
      // Verify manifest structure
      const manifest = createStep?.input.manifest;
      expect(manifest.apiVersion).toBe('platform.io/v1alpha1');
      expect(manifest.kind).toBe('Database');
      expect(manifest.metadata.namespace).toBe('${{ parameters.namespace }}');
      expect(manifest.spec.compositionSelector).toBeDefined();
    });

    it('should handle preview mode correctly', () => {
      const preview = transformer.preview(v2NamespacedXRD);

      expect(preview.crossplaneVersion.version).toBe('v2');
      expect(preview.crossplaneVersion.scope).toBe('Namespaced');
      expect(preview.resourceKind).toBe('Database');
      expect(preview.templateCount).toBe(1);
      expect(preview.requiresNamespace).toBe(true);
      expect(preview.multiCluster).toBe(false);
      expect(preview.versions).toHaveLength(1);
      expect(preview.versions[0]).toEqual({
        name: 'v1alpha1',
        served: true,
        deprecated: false,
        hasSchema: true
      });
    });
  });

  describe('Crossplane v1 with Claims', () => {
    const v1ClaimXRD: XRD = {
      apiVersion: 'apiextensions.crossplane.io/v1',
      kind: 'CompositeResourceDefinition',
      metadata: {
        name: 'clusters.platform.io',
        annotations: {
          'backstage.io/title': 'Kubernetes Cluster'
        }
      },
      spec: {
        group: 'platform.io',
        names: {
          kind: 'Cluster',
          plural: 'clusters',
          singular: 'cluster'
        },
        claimNames: {
          kind: 'ClusterClaim',
          plural: 'clusterclaims'
        },
        versions: [
          {
            name: 'v1beta1',
            served: true,
            referenceable: true,
            schema: {
              openAPIV3Schema: {
                type: 'object',
                properties: {
                  spec: {
                    type: 'object',
                    required: ['provider'],
                    properties: {
                      provider: {
                        type: 'string',
                        description: 'Cloud provider',
                        enum: ['aws', 'gcp', 'azure']
                      },
                      nodeCount: {
                        type: 'integer',
                        description: 'Number of nodes',
                        minimum: 1,
                        maximum: 100,
                        default: 3
                      }
                    }
                  }
                }
              }
            }
          }
        ]
      }
    };

    it('should transform v1 XRD with claims to template', () => {
      const templates = transformer.transform(v1ClaimXRD);

      expect(templates).toHaveLength(1);
      const template = templates[0];

      // Should use claim in metadata
      expect(template.metadata.title).toContain('ClusterClaim');
      expect(template.metadata.tags).toContain('crossplane-v1');

      // Should always include namespace for claims
      const metadataSection = template.spec.parameters[0];
      expect(metadataSection.properties.namespace).toBeDefined();

      // Should use v1 step generator
      const createStep = template.spec.steps.find(s => s.id === 'create-claim');
      expect(createStep).toBeDefined();
      expect(createStep?.name).toBe('Create ClusterClaim');
      
      const manifest = createStep?.input.manifest;
      expect(manifest.kind).toBe('ClusterClaim');
      expect(manifest.metadata.namespace).toBe('${{ parameters.namespace }}');
      expect(manifest.spec.compositionRef).toBeDefined(); // v1 uses refs
    });
  });

  describe('Crossplane v2 Cluster-scoped XRD', () => {
    const v2ClusterXRD: XRD = {
      apiVersion: 'apiextensions.crossplane.io/v2',
      kind: 'CompositeResourceDefinition',
      metadata: {
        name: 'globalconfigs.platform.io'
      },
      spec: {
        group: 'platform.io',
        names: {
          kind: 'GlobalConfig',
          plural: 'globalconfigs',
          singular: 'globalconfig'
        },
        scope: 'Cluster',
        versions: [
          {
            name: 'v1',
            served: true,
            referenceable: true,
            schema: {
              openAPIV3Schema: {
                type: 'object',
                properties: {
                  spec: {
                    type: 'object',
                    properties: {
                      region: {
                        type: 'string',
                        description: 'Deployment region'
                      }
                    }
                  }
                }
              }
            }
          }
        ]
      }
    };

    it('should transform v2 cluster-scoped XRD to template', () => {
      const templates = transformer.transform(v2ClusterXRD);

      expect(templates).toHaveLength(1);
      const template = templates[0];

      expect(template.metadata.tags).toContain('cluster');

      // Should NOT include namespace for cluster-scoped
      const metadataSection = template.spec.parameters[0];
      expect(metadataSection.properties.namespace).toBeUndefined();

      // Verify manifest has no namespace
      const createStep = template.spec.steps.find(s => s.id === 'create-xr');
      const manifest = createStep?.input.manifest;
      expect(manifest.metadata.namespace).toBeUndefined();
    });
  });

  describe('Multi-cluster support', () => {
    const multiClusterXRD: XRD = {
      apiVersion: 'apiextensions.crossplane.io/v2',
      kind: 'CompositeResourceDefinition',
      metadata: {
        name: 'apps.platform.io'
      },
      spec: {
        group: 'platform.io',
        names: {
          kind: 'App',
          plural: 'apps',
          singular: 'app'
        },
        scope: 'Namespaced',
        versions: [
          {
            name: 'v1',
            served: true,
            referenceable: true,
            schema: {
              openAPIV3Schema: {
                type: 'object',
                properties: {
                  spec: {
                    type: 'object',
                    properties: {
                      replicas: {
                        type: 'integer',
                        default: 1
                      }
                    }
                  }
                }
              }
            }
          }
        ]
      },
      clusters: [
        { name: 'dev', url: 'https://dev.k8s.local' },
        { name: 'staging', url: 'https://staging.k8s.local' },
        { name: 'prod', url: 'https://prod.k8s.local' }
      ]
    };

    it('should add cluster parameter when multiple clusters exist', () => {
      const templates = transformer.transform(multiClusterXRD);
      const template = templates[0];

      // Should have cluster parameter
      const metadataSection = template.spec.parameters[0];
      expect(metadataSection.properties.cluster).toBeDefined();
      expect(metadataSection.properties.cluster.enum).toEqual(['dev', 'staging', 'prod']);

      // Step should include cluster
      const createStep = template.spec.steps.find(s => s.id === 'create-xr');
      expect(createStep?.input.cluster).toBe('${{ parameters.cluster }}');
    });
  });

  describe('Publishing configuration', () => {
    const transformerWithPublishing = new XRDTransformer({
      stepGeneratorConfig: {
        includePublishing: true,
        publishPhase: {
          git: {
            repoUrl: 'github.com?owner=org&repo=catalog-orders',
            targetBranch: 'main',
            createPR: true
          },
          flux: {
            kustomization: 'catalog-orders',
            namespace: 'flux-system'
          }
        }
      }
    });

    const xrd: XRD = {
      apiVersion: 'apiextensions.crossplane.io/v2',
      kind: 'CompositeResourceDefinition',
      metadata: {
        name: 'services.platform.io'
      },
      spec: {
        group: 'platform.io',
        names: {
          kind: 'Service',
          plural: 'services',
          singular: 'service'
        },
        scope: 'Namespaced',
        versions: [
          {
            name: 'v1',
            served: true,
            referenceable: true,
            schema: {
              openAPIV3Schema: {
                type: 'object',
                properties: {
                  spec: {
                    type: 'object',
                    properties: {
                      port: {
                        type: 'integer',
                        default: 8080
                      }
                    }
                  }
                }
              }
            }
          }
        ]
      }
    };

    it('should include publishing steps when configured', () => {
      const templates = transformerWithPublishing.transform(xrd);
      const template = templates[0];

      // Should have git publish step
      const gitStep = template.spec.steps.find(s => s.id === 'publish-git');
      expect(gitStep).toBeDefined();
      expect(gitStep?.name).toContain('Publish');
      expect(gitStep?.input.repoUrl).toBe('${{ parameters.repoUrl }}');

      // Should have flux reconcile step
      const fluxStep = template.spec.steps.find(s => s.id === 'reconcile-flux');
      expect(fluxStep).toBeDefined();
      expect(fluxStep?.input.kustomization).toBe('catalog-orders');

      // Output should have PR link
      expect(template.spec.output?.links).toContainEqual({
        title: 'View Pull Request',
        url: '${{ steps["publish-git"].output.pullRequestUrl }}'
      });
    });
  });

  describe('Validation', () => {
    it('should validate correct XRD as valid', () => {
      const xrd: XRD = {
        apiVersion: 'apiextensions.crossplane.io/v2',
        kind: 'CompositeResourceDefinition',
        metadata: {
          name: 'valid.platform.io'
        },
        spec: {
          group: 'platform.io',
          names: {
            kind: 'Valid',
            plural: 'valids',
            singular: 'valid'
          },
          scope: 'Namespaced',
          versions: [
            {
              name: 'v1',
              served: true,
              referenceable: true,
              schema: {
                openAPIV3Schema: {
                  type: 'object',
                  properties: {
                    spec: {
                      type: 'object',
                      properties: {}
                    }
                  }
                }
              }
            }
          ]
        }
      };

      const validation = transformer.canTransform(xrd);
      expect(validation.valid).toBe(true);
      expect(validation.reasons).toHaveLength(0);
    });

    it('should validate XRD without served versions as invalid', () => {
      const xrd: XRD = {
        apiVersion: 'apiextensions.crossplane.io/v2',
        kind: 'CompositeResourceDefinition',
        metadata: {
          name: 'invalid.platform.io'
        },
        spec: {
          group: 'platform.io',
          names: {
            kind: 'Invalid',
            plural: 'invalids',
            singular: 'invalid'
          },
          scope: 'Namespaced',
          versions: [
            {
              name: 'v1',
              served: false,
              referenceable: false
            }
          ]
        }
      };

      const validation = transformer.canTransform(xrd);
      expect(validation.valid).toBe(false);
      expect(validation.reasons).toContain('No served versions found');
    });

    it('should validate XRD without schema as invalid', () => {
      const xrd: XRD = {
        apiVersion: 'apiextensions.crossplane.io/v2',
        kind: 'CompositeResourceDefinition',
        metadata: {
          name: 'noschema.platform.io'
        },
        spec: {
          group: 'platform.io',
          names: {
            kind: 'NoSchema',
            plural: 'noschemas',
            singular: 'noschema'
          },
          scope: 'Namespaced',
          versions: [
            {
              name: 'v1',
              served: true,
              referenceable: true
            }
          ]
        }
      };

      const validation = transformer.canTransform(xrd);
      expect(validation.valid).toBe(false);
      expect(validation.reasons).toContain('Version v1 is missing OpenAPI schema');
    });
  });

  describe('Complex nested schemas', () => {
    const complexXRD: XRD = {
      apiVersion: 'apiextensions.crossplane.io/v2',
      kind: 'CompositeResourceDefinition',
      metadata: {
        name: 'applications.platform.io'
      },
      spec: {
        group: 'platform.io',
        names: {
          kind: 'Application',
          plural: 'applications',
          singular: 'application'
        },
        scope: 'Namespaced',
        versions: [
          {
            name: 'v1',
            served: true,
            referenceable: true,
            schema: {
              openAPIV3Schema: {
                type: 'object',
                properties: {
                  spec: {
                    type: 'object',
                    properties: {
                      database: {
                        type: 'object',
                        description: 'Database configuration',
                        properties: {
                          engine: {
                            type: 'string',
                            enum: ['postgresql', 'mysql']
                          },
                          connection: {
                            type: 'object',
                            properties: {
                              host: {
                                type: 'string'
                              },
                              port: {
                                type: 'integer',
                                minimum: 1,
                                maximum: 65535
                              }
                            }
                          }
                        }
                      },
                      networking: {
                        type: 'object',
                        properties: {
                          ingress: {
                            type: 'object',
                            properties: {
                              enabled: {
                                type: 'boolean',
                                default: true
                              },
                              hosts: {
                                type: 'array',
                                items: {
                                  type: 'string'
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        ]
      }
    };

    it('should handle complex nested schemas', () => {
      const templates = transformer.transform(complexXRD);
      const template = templates[0];

      const configSection = template.spec.parameters[1];
      
      // Should have flattened nested properties
      expect(configSection.properties['database_engine']).toBeDefined();
      expect(configSection.properties['database_connection_host']).toBeDefined();
      expect(configSection.properties['database_connection_port']).toBeDefined();
      expect(configSection.properties['networking_ingress_enabled']).toBeDefined();
      
      // Check array handling
      expect(configSection.properties['networking_ingress_hosts']).toBeDefined();
      expect(configSection.properties['networking_ingress_hosts'].type).toBe('array');
    });
  });
});