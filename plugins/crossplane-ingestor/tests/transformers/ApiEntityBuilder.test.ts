import { ApiEntityBuilder } from '../../src/transformers/ApiEntityBuilder';
import { XRD, XRDVersion, BackstageApiEntity } from '../../src/types';

describe('ApiEntityBuilder', () => {
  let builder: ApiEntityBuilder;

  beforeEach(() => {
    builder = new ApiEntityBuilder();
  });

  describe('build', () => {
    it('should build a valid API entity from XRD', () => {
      const xrd: XRD = {
        apiVersion: 'apiextensions.crossplane.io/v1',
        kind: 'CompositeResourceDefinition',
        metadata: {
          name: 'tests.example.com',
          annotations: {
            'crossplane.io/description': 'Test XRD for API generation',
          },
        },
        spec: {
          group: 'example.com',
          names: {
            kind: 'Test',
            plural: 'tests',
            singular: 'test',
          },
          scope: 'Namespaced',
          versions: [],
        },
        clusterName: 'test-cluster',
      };

      const version: XRDVersion = {
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
                  name: {
                    type: 'string',
                    description: 'Name of the resource',
                  },
                  replicas: {
                    type: 'integer',
                    minimum: 1,
                    maximum: 10,
                    default: 3,
                  },
                },
                required: ['name'],
              },
            },
          },
        },
      };

      const apiEntity = builder.build(xrd, version);

      expect(apiEntity).toBeDefined();
      expect(apiEntity.apiVersion).toBe('backstage.io/v1alpha1');
      expect(apiEntity.kind).toBe('API');
      expect(apiEntity.metadata.name).toBe('tests-example-com');
      expect(apiEntity.metadata.title).toBe('Test API');
      expect(apiEntity.metadata.description).toBe('Test XRD for API generation');
      expect(apiEntity.spec.type).toBe('openapi');
      expect(apiEntity.spec.lifecycle).toBe('production');
      expect(apiEntity.spec.owner).toBe('platform-team');
    });

    it('should generate valid OpenAPI definition', () => {
      const xrd: XRD = {
        metadata: {
          name: 'databases.storage.io',
        },
        spec: {
          group: 'storage.io',
          names: {
            kind: 'Database',
            plural: 'databases',
          },
          scope: 'Cluster',
          versions: [],
        },
      } as any;

      const version: XRDVersion = {
        name: 'v1beta1',
        served: true,
        schema: {
          openAPIV3Schema: {
            type: 'object',
            properties: {
              spec: {
                type: 'object',
                properties: {
                  engine: {
                    type: 'string',
                    enum: ['mysql', 'postgres'],
                  },
                  size: {
                    type: 'string',
                    pattern: '^[0-9]+Gi$',
                  },
                },
              },
            },
          },
        },
      } as any;

      const apiEntity = builder.build(xrd, version);
      const openApiSpec = JSON.parse(apiEntity.spec.definition);

      expect(openApiSpec.openapi).toBe('3.0.0');
      expect(openApiSpec.info.title).toBe('Database API');
      expect(openApiSpec.info.version).toBe('v1beta1');
      
      // Check paths
      expect(openApiSpec.paths['/apis/storage.io/v1beta1/databases']).toBeDefined();
      expect(openApiSpec.paths['/apis/storage.io/v1beta1/databases/{name}']).toBeDefined();
      
      // Check components
      expect(openApiSpec.components.schemas.Database).toBeDefined();
      expect(openApiSpec.components.schemas.Database.properties.spec).toBeDefined();
    });

    it('should handle namespaced resources correctly', () => {
      const xrd: XRD = {
        metadata: { name: 'services.app.io' },
        spec: {
          group: 'app.io',
          names: {
            kind: 'Service',
            plural: 'services',
          },
          scope: 'Namespaced',
          versions: [],
        },
      } as any;

      const version: XRDVersion = {
        name: 'v1',
        served: true,
        schema: {
          openAPIV3Schema: {
            type: 'object',
            properties: {
              spec: {
                type: 'object',
                properties: {
                  port: { type: 'integer' },
                },
              },
            },
          },
        },
      } as any;

      const apiEntity = builder.build(xrd, version);
      const openApiSpec = JSON.parse(apiEntity.spec.definition);

      // Namespaced resources should have namespace in path
      expect(openApiSpec.paths['/apis/app.io/v1/namespaces/{namespace}/services']).toBeDefined();
      expect(openApiSpec.paths['/apis/app.io/v1/namespaces/{namespace}/services/{name}']).toBeDefined();
      
      // Should have namespace parameter
      const listPath = openApiSpec.paths['/apis/app.io/v1/namespaces/{namespace}/services'];
      const namespaceParam = listPath.get.parameters.find((p: any) => p.name === 'namespace');
      expect(namespaceParam).toBeDefined();
      expect(namespaceParam.in).toBe('path');
      expect(namespaceParam.required).toBe(true);
    });

    it('should add appropriate tags and annotations', () => {
      const xrd: XRD = {
        metadata: {
          name: 'widgets.acme.io',
          labels: {
            'app.kubernetes.io/managed-by': 'crossplane',
          },
        },
        spec: {
          group: 'acme.io',
          names: {
            kind: 'Widget',
            plural: 'widgets',
          },
          scope: 'Cluster',
          versions: [],
        },
        clusterName: 'production-cluster',
      } as any;

      const version: XRDVersion = {
        name: 'v2',
        served: true,
      } as any;

      const apiEntity = builder.build(xrd, version);

      expect(apiEntity.metadata.tags).toContain('crossplane');
      expect(apiEntity.metadata.tags).toContain('kubernetes');
      expect(apiEntity.metadata.tags).toContain('api');
      expect(apiEntity.metadata.tags).toContain('cluster-scoped');
      
      expect(apiEntity.metadata.annotations['backstage.io/managed-by-location']).toBe('cluster: production-cluster');
      expect(apiEntity.metadata.annotations['backstage.io/source-location']).toBe('url:https://github.com/open-service-portal/catalog');
    });

    it('should handle complex schemas with nested properties', () => {
      const xrd: XRD = {
        metadata: { name: 'applications.platform.io' },
        spec: {
          group: 'platform.io',
          names: {
            kind: 'Application',
            plural: 'applications',
          },
          scope: 'Namespaced',
          versions: [],
        },
      } as any;

      const version: XRDVersion = {
        name: 'v1alpha1',
        served: true,
        schema: {
          openAPIV3Schema: {
            type: 'object',
            properties: {
              spec: {
                type: 'object',
                properties: {
                  deployment: {
                    type: 'object',
                    properties: {
                      replicas: {
                        type: 'integer',
                        minimum: 1,
                      },
                      resources: {
                        type: 'object',
                        properties: {
                          limits: {
                            type: 'object',
                            properties: {
                              cpu: { type: 'string' },
                              memory: { type: 'string' },
                            },
                          },
                          requests: {
                            type: 'object',
                            properties: {
                              cpu: { type: 'string' },
                              memory: { type: 'string' },
                            },
                          },
                        },
                      },
                    },
                  },
                  service: {
                    type: 'object',
                    properties: {
                      type: {
                        type: 'string',
                        enum: ['ClusterIP', 'LoadBalancer', 'NodePort'],
                      },
                      ports: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            name: { type: 'string' },
                            port: { type: 'integer' },
                            targetPort: { type: 'integer' },
                          },
                        },
                      },
                    },
                  },
                },
                required: ['deployment'],
              },
            },
          },
        },
      } as any;

      const apiEntity = builder.build(xrd, version);
      const openApiSpec = JSON.parse(apiEntity.spec.definition);
      
      const schema = openApiSpec.components.schemas.Application;
      expect(schema.properties.spec.properties.deployment).toBeDefined();
      expect(schema.properties.spec.properties.deployment.properties.resources).toBeDefined();
      expect(schema.properties.spec.properties.service.properties.ports.type).toBe('array');
      expect(schema.properties.spec.required).toContain('deployment');
    });

    it('should handle XRDs without schema gracefully', () => {
      const xrd: XRD = {
        metadata: { name: 'simple.io' },
        spec: {
          group: 'simple.io',
          names: {
            kind: 'Simple',
            plural: 'simples',
          },
          scope: 'Cluster',
          versions: [],
        },
      } as any;

      const version: XRDVersion = {
        name: 'v1',
        served: true,
        // No schema defined
      } as any;

      const apiEntity = builder.build(xrd, version);
      const openApiSpec = JSON.parse(apiEntity.spec.definition);
      
      // Should still generate valid OpenAPI with minimal schema
      expect(openApiSpec.components.schemas.Simple).toBeDefined();
      expect(openApiSpec.components.schemas.Simple.type).toBe('object');
    });

    it('should include security schemes', () => {
      const xrd: XRD = {
        metadata: { name: 'secured.io' },
        spec: {
          group: 'secured.io',
          names: {
            kind: 'Secured',
            plural: 'secureds',
          },
          scope: 'Cluster',
          versions: [],
        },
      } as any;

      const version: XRDVersion = {
        name: 'v1',
        served: true,
      } as any;

      const apiEntity = builder.build(xrd, version);
      const openApiSpec = JSON.parse(apiEntity.spec.definition);
      
      expect(openApiSpec.components.securitySchemes).toBeDefined();
      expect(openApiSpec.components.securitySchemes.bearerAuth).toEqual({
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      });
      
      expect(openApiSpec.security).toEqual([{ bearerAuth: [] }]);
    });

    it('should generate correct metadata for API discovery', () => {
      const xrd: XRD = {
        metadata: {
          name: 'discoveries.example.com',
          uid: 'abc-123',
          annotations: {
            'crossplane.io/version': 'v2.0',
          },
        },
        spec: {
          group: 'example.com',
          names: {
            kind: 'Discovery',
            plural: 'discoveries',
          },
          scope: 'Namespaced',
          versions: [],
        },
        clusterName: 'test-cluster',
      } as any;

      const version: XRDVersion = {
        name: 'v1beta2',
        served: true,
      } as any;

      const apiEntity = builder.build(xrd, version);
      
      // Check links are generated
      expect(apiEntity.metadata.links).toBeDefined();
      expect(apiEntity.metadata.links).toContainEqual({
        url: 'https://kubernetes.io/docs/concepts/extend-kubernetes/api-extension/custom-resources/',
        title: 'Kubernetes CRD Documentation',
      });
      
      // Check UID handling
      expect(apiEntity.metadata.uid).toBeDefined();
      
      // Check annotations
      expect(apiEntity.metadata.annotations['crossplane.io/xrd']).toBe('discoveries.example.com');
      expect(apiEntity.metadata.annotations['crossplane.io/version']).toBe('v2.0');
    });
  });

  describe('edge cases', () => {
    it('should handle missing metadata gracefully', () => {
      const xrd: XRD = {
        spec: {
          group: 'minimal.io',
          names: {
            kind: 'Minimal',
            plural: 'minimals',
          },
          scope: 'Cluster',
          versions: [],
        },
      } as any;

      const version: XRDVersion = {
        name: 'v1',
        served: true,
      } as any;

      const apiEntity = builder.build(xrd, version);
      
      expect(apiEntity).toBeDefined();
      expect(apiEntity.metadata.name).toBe('minimals-minimal-io');
      expect(apiEntity.metadata.title).toBe('Minimal API');
    });

    it('should sanitize special characters in names', () => {
      const xrd: XRD = {
        metadata: {
          name: 'my-resource_v2.example.com',
        },
        spec: {
          group: 'example.com',
          names: {
            kind: 'MyResource',
            plural: 'my-resources',
          },
          scope: 'Cluster',
          versions: [],
        },
      } as any;

      const version: XRDVersion = {
        name: 'v1',
        served: true,
      } as any;

      const apiEntity = builder.build(xrd, version);
      
      // Names should be sanitized for Backstage
      expect(apiEntity.metadata.name).toMatch(/^[a-z0-9-]+$/);
    });
  });
});