import { XRDTransformer } from '../../src/transformers/XRDTransformer';
import { XRD, BackstageTemplate, BackstageApiEntity } from '../../src/types';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

describe('XRD Transformation Integration Tests', () => {
  let transformer: XRDTransformer;

  beforeEach(() => {
    const config = {
      extractorConfig: {
        includePublishing: true,
        publishPhase: {
          git: {
            repoUrl: 'github.com?owner=test-org&repo=test-repo',
            targetBranch: 'main',
          },
        },
      },
      stepGeneratorConfig: {
        includeFetch: true,
        includeRegister: false,
        includePublishing: true,
      },
      templateBuilderConfig: {
        templateType: 'crossplane-resource',
        owner: 'platform-team',
        additionalTags: ['test'],
        kubernetesUIEnabled: true,
        publishingEnabled: true,
        annotationPrefix: 'test.io',
      },
    };
    
    transformer = new XRDTransformer(config);
  });

  describe('Full transformation pipeline', () => {
    it('should transform a Crossplane v2 XRD to Template and API entities', () => {
      const xrd: XRD = {
        apiVersion: 'apiextensions.crossplane.io/v1',
        kind: 'CompositeResourceDefinition',
        metadata: {
          name: 'databases.platform.io',
          annotations: {
            'crossplane.io/description': 'Database provisioning resource',
            'crossplane.io/version': 'v2.0',
          },
          labels: {
            'crossplane.io/scope': 'Namespaced',
          },
        },
        spec: {
          group: 'platform.io',
          names: {
            kind: 'Database',
            plural: 'databases',
            singular: 'database',
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
                      properties: {
                        engine: {
                          type: 'string',
                          description: 'Database engine',
                          enum: ['mysql', 'postgres', 'mongodb'],
                          default: 'postgres',
                        },
                        version: {
                          type: 'string',
                          description: 'Engine version',
                          pattern: '^[0-9]+\\.[0-9]+$',
                        },
                        size: {
                          type: 'string',
                          description: 'Database size',
                          enum: ['small', 'medium', 'large'],
                          default: 'small',
                        },
                        backup: {
                          type: 'object',
                          description: 'Backup configuration',
                          properties: {
                            enabled: {
                              type: 'boolean',
                              default: true,
                            },
                            schedule: {
                              type: 'string',
                              pattern: '^(@(daily|weekly|monthly)|[0-9*/ ]+)$',
                              default: '@daily',
                            },
                          },
                        },
                      },
                      required: ['engine', 'version'],
                    },
                  },
                },
              },
            },
          ],
        },
        clusterName: 'test-cluster',
      };

      const entities = transformer.transform(xrd);
      
      // Should generate both Template and API entities
      expect(entities).toHaveLength(2);
      
      const template = entities.find(e => e.kind === 'Template') as BackstageTemplate;
      const api = entities.find(e => e.kind === 'API') as BackstageApiEntity;
      
      expect(template).toBeDefined();
      expect(api).toBeDefined();

      // Validate Template structure
      expect(template.apiVersion).toBe('scaffolder.backstage.io/v1beta3');
      expect(template.metadata.name).toBe('databases-platform-io-v1alpha1');
      expect(template.metadata.title).toBe('Database');
      expect(template.metadata.description).toBe('Database provisioning resource');
      expect(template.metadata.tags).toContain('crossplane');
      expect(template.metadata.tags).toContain('crossplane-v2');
      expect(template.metadata.tags).toContain('namespaced');
      expect(template.metadata.tags).toContain('test');

      // Check parameters
      expect(template.spec.parameters).toBeDefined();
      expect(template.spec.parameters.length).toBeGreaterThan(0);
      
      // Find the resource configuration parameter section
      const resourceConfig = template.spec.parameters.find(
        p => p.title === 'Resource Configuration'
      );
      expect(resourceConfig).toBeDefined();
      expect(resourceConfig.properties.engine).toEqual({
        title: 'Engine',
        type: 'string',
        description: 'Database engine',
        enum: ['mysql', 'postgres', 'mongodb'],
        default: 'postgres',
      });
      expect(resourceConfig.properties.version).toEqual({
        title: 'Version',
        type: 'string',
        description: 'Engine version',
        pattern: '^[0-9]+\\.[0-9]+$',
      });
      expect(resourceConfig.required).toContain('engine');
      expect(resourceConfig.required).toContain('version');

      // Check steps
      expect(template.spec.steps).toBeDefined();
      expect(template.spec.steps.length).toBeGreaterThan(0);
      
      // Should have fetch and create-xr steps for v2
      const fetchStep = template.spec.steps.find(s => s.id === 'fetch');
      const createStep = template.spec.steps.find(s => s.id === 'create-xr');
      
      expect(fetchStep).toBeDefined();
      expect(createStep).toBeDefined();
      expect(createStep.action).toBe('kubernetes:apply');

      // Validate API entity structure
      expect(api.apiVersion).toBe('backstage.io/v1alpha1');
      expect(api.metadata.name).toBe('databases-platform-io');
      expect(api.metadata.title).toBe('Database API');
      expect(api.metadata.description).toBe('Database provisioning resource');
      expect(api.spec.type).toBe('openapi');
      expect(api.spec.lifecycle).toBe('production');
      expect(api.spec.definition).toBeDefined();
      
      // Parse and validate OpenAPI spec
      const openApiSpec = JSON.parse(api.spec.definition);
      expect(openApiSpec.openapi).toBe('3.0.0');
      expect(openApiSpec.info.title).toBe('Database API');
      expect(openApiSpec.paths).toBeDefined();
      expect(openApiSpec.components.schemas.Database).toBeDefined();
    });

    it('should handle Crossplane v1 with claims', () => {
      const xrd: XRD = {
        apiVersion: 'apiextensions.crossplane.io/v1',
        kind: 'CompositeResourceDefinition',
        metadata: {
          name: 'xpostgresqlinstances.database.example.org',
          labels: {
            'crossplane.io/version': 'v1',
          },
        },
        spec: {
          group: 'database.example.org',
          names: {
            kind: 'XPostgreSQLInstance',
            plural: 'xpostgresqlinstances',
          },
          scope: 'Cluster',
          claimNames: {
            kind: 'PostgreSQLInstance',
            plural: 'postgresqlinstances',
          },
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
                      properties: {
                        storageGB: {
                          type: 'integer',
                          minimum: 10,
                          maximum: 1000,
                          default: 20,
                        },
                      },
                      required: ['storageGB'],
                    },
                  },
                },
              },
            },
          ],
        },
        clusterName: 'test-cluster',
      };

      const entities = transformer.transform(xrd);
      
      expect(entities).toHaveLength(2);
      
      const template = entities.find(e => e.kind === 'Template') as BackstageTemplate;
      
      // V1 should have claim-related metadata
      expect(template.metadata.tags).toContain('crossplane-v1');
      expect(template.metadata.tags).toContain('cluster-scoped');
      expect(template.metadata.annotations['crossplane.io/claim-kind']).toBe('PostgreSQLInstance');
      
      // V1 should have create-claim step
      const createClaimStep = template.spec.steps.find(s => s.id === 'create-claim');
      expect(createClaimStep).toBeDefined();
      expect(createClaimStep.action).toBe('kubernetes:apply');
    });

    it('should handle complex nested schemas', () => {
      const xrd: XRD = {
        apiVersion: 'apiextensions.crossplane.io/v1',
        kind: 'CompositeResourceDefinition',
        metadata: {
          name: 'applications.platform.io',
        },
        spec: {
          group: 'platform.io',
          names: {
            kind: 'Application',
            plural: 'applications',
          },
          scope: 'Namespaced',
          versions: [
            {
              name: 'v1beta1',
              served: true,
              schema: {
                openAPIV3Schema: {
                  type: 'object',
                  properties: {
                    spec: {
                      type: 'object',
                      properties: {
                        components: {
                          type: 'array',
                          description: 'Application components',
                          items: {
                            type: 'object',
                            properties: {
                              name: {
                                type: 'string',
                                minLength: 1,
                              },
                              type: {
                                type: 'string',
                                enum: ['frontend', 'backend', 'database'],
                              },
                              replicas: {
                                type: 'integer',
                                minimum: 1,
                                maximum: 10,
                              },
                            },
                            required: ['name', 'type'],
                          },
                        },
                        networking: {
                          type: 'object',
                          properties: {
                            ingress: {
                              type: 'object',
                              properties: {
                                enabled: {
                                  type: 'boolean',
                                  default: false,
                                },
                                hostname: {
                                  type: 'string',
                                  pattern: '^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$',
                                },
                                tls: {
                                  type: 'boolean',
                                  default: true,
                                },
                              },
                            },
                          },
                        },
                      },
                      required: ['components'],
                    },
                  },
                },
              },
            },
          ],
        },
        clusterName: 'test-cluster',
      };

      const entities = transformer.transform(xrd);
      const template = entities.find(e => e.kind === 'Template') as BackstageTemplate;
      
      // Complex schemas should be properly extracted
      const resourceConfig = template.spec.parameters.find(
        p => p.title === 'Resource Configuration'
      );
      
      // Arrays and nested objects should be handled
      expect(resourceConfig.properties.components).toBeDefined();
      expect(resourceConfig.properties.networking).toBeDefined();
      
      // Required fields should be preserved
      expect(resourceConfig.required).toContain('components');
    });

    it('should handle GitOps publishing configuration', () => {
      const xrd: XRD = {
        apiVersion: 'apiextensions.crossplane.io/v1',
        kind: 'CompositeResourceDefinition',
        metadata: {
          name: 'gitops.platform.io',
          annotations: {
            'test.io/publish-phase': JSON.stringify({
              gitRepo: 'github.com?owner=my-org&repo=my-repo',
              gitBranch: 'develop',
              createPr: true,
            }),
          },
        },
        spec: {
          group: 'platform.io',
          names: {
            kind: 'GitOps',
            plural: 'gitops',
          },
          scope: 'Cluster',
          versions: [
            {
              name: 'v1',
              served: true,
              schema: {
                openAPIV3Schema: {
                  type: 'object',
                  properties: {
                    spec: {
                      type: 'object',
                      properties: {
                        enabled: { type: 'boolean' },
                      },
                    },
                  },
                },
              },
            },
          ],
        },
        clusterName: 'test-cluster',
      };

      const entities = transformer.transform(xrd);
      const template = entities.find(e => e.kind === 'Template') as BackstageTemplate;
      
      // Should have publishing configuration parameter
      const publishingParam = template.spec.parameters.find(
        p => p.title === 'Publishing Configuration'
      );
      expect(publishingParam).toBeDefined();
      expect(publishingParam.properties.repoUrl.default).toBe('github.com?owner=my-org&repo=my-repo');
      expect(publishingParam.properties.gitBranch.default).toBe('develop');
      expect(publishingParam.properties.createPr.default).toBe(true);
      
      // Should have publish step
      const publishStep = template.spec.steps.find(s => s.id === 'publish-git');
      expect(publishStep).toBeDefined();
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle XRD without schema', () => {
      const xrd: XRD = {
        apiVersion: 'apiextensions.crossplane.io/v1',
        kind: 'CompositeResourceDefinition',
        metadata: {
          name: 'minimal.io',
        },
        spec: {
          group: 'minimal.io',
          names: {
            kind: 'Minimal',
            plural: 'minimals',
          },
          scope: 'Cluster',
          versions: [
            {
              name: 'v1',
              served: true,
              // No schema
            },
          ],
        },
        clusterName: 'test-cluster',
      };

      const entities = transformer.transform(xrd);
      
      // Should still generate entities
      expect(entities).toHaveLength(2);
      
      const template = entities.find(e => e.kind === 'Template') as BackstageTemplate;
      // Should have basic parameters even without schema
      expect(template.spec.parameters).toBeDefined();
      expect(template.spec.parameters.length).toBeGreaterThan(0);
    });

    it('should handle multiple versions', () => {
      const xrd: XRD = {
        apiVersion: 'apiextensions.crossplane.io/v1',
        kind: 'CompositeResourceDefinition',
        metadata: {
          name: 'multiversion.io',
        },
        spec: {
          group: 'multiversion.io',
          names: {
            kind: 'MultiVersion',
            plural: 'multiversions',
          },
          scope: 'Cluster',
          versions: [
            {
              name: 'v1alpha1',
              served: false,
              deprecated: true,
              schema: {
                openAPIV3Schema: {
                  type: 'object',
                  properties: {
                    spec: {
                      type: 'object',
                      properties: {
                        oldField: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
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
                      properties: {
                        newField: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
            {
              name: 'v1',
              served: true,
              referenceable: true,
              storage: true,
              schema: {
                openAPIV3Schema: {
                  type: 'object',
                  properties: {
                    spec: {
                      type: 'object',
                      properties: {
                        stableField: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          ],
        },
        clusterName: 'test-cluster',
      };

      const entities = transformer.transform(xrd);
      
      // Should generate entities for each served version
      // v1alpha1 is not served, so we expect 4 entities total (2 for v1beta1, 2 for v1)
      expect(entities.length).toBeGreaterThanOrEqual(4);
      
      // Check that deprecated version is not included
      const templates = entities.filter(e => e.kind === 'Template');
      const deprecatedTemplate = templates.find(t => 
        t.metadata.name.includes('v1alpha1')
      );
      expect(deprecatedTemplate).toBeUndefined();
    });
  });
});