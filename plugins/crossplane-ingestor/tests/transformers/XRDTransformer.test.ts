/**
 * Unit tests for XRDTransformer
 */

import { XRDTransformer } from '../../src/../src/transformers/XRDTransformer';
import { XRD, XRDTransformerConfig } from '../../src/types';

describe('XRDTransformer', () => {
  let transformer: XRDTransformer;

  beforeEach(() => {
    transformer = new XRDTransformer();
  });

  describe('transform', () => {
    it('should transform a v2 Cluster XRD into a Backstage template', () => {
      const xrd: XRD = {
        apiVersion: 'apiextensions.crossplane.io/v2',
        kind: 'CompositeResourceDefinition',
        metadata: {
          name: 'tests.example.com'
        },
        spec: {
          group: 'example.com',
          names: {
            kind: 'Test',
            plural: 'tests'
          },
          scope: 'Cluster',
          versions: [{
            name: 'v1alpha1',
            served: true,
            referenceable: true
          }]
        }
      };

      const templates = transformer.transform(xrd);

      expect(templates).toHaveLength(1);
      const template = templates[0];
      expect(template.apiVersion).toBe('scaffolder.backstage.io/v1beta3');
      expect(template.kind).toBe('Template');
      expect(template.metadata.name).toBe('tests-template');
      expect(template.metadata.title).toBe('Test Template');
      expect(template.metadata.annotations['crossplane.io/xrd']).toBe('tests.example.com');
      expect(template.metadata.annotations['crossplane.io/api-version']).toBe('v2');
      expect(template.metadata.annotations['crossplane.io/scope']).toBe('Cluster');
      expect(template.metadata.annotations['crossplane.io/uses-claims']).toBe('false');
    });

    it('should transform a v2 Namespaced XRD', () => {
      const xrd: XRD = {
        apiVersion: 'apiextensions.crossplane.io/v2',
        kind: 'CompositeResourceDefinition',
        metadata: {
          name: 'tests.example.com'
        },
        spec: {
          group: 'example.com',
          names: {
            kind: 'Test',
            plural: 'tests'
          },
          scope: 'Namespaced',
          versions: [{
            name: 'v1alpha1',
            served: true,
            referenceable: true
          }]
        }
      };

      const templates = transformer.transform(xrd);

      expect(templates).toHaveLength(1);
      const template = templates[0];
      expect(template.metadata.annotations['crossplane.io/scope']).toBe('Namespaced');
      expect(template.spec.parameters).toBeDefined();
      
      // Should have namespace parameter
      const metadataSection = template.spec.parameters.find(s => s.title === 'Resource Metadata');
      expect(metadataSection?.properties).toHaveProperty('namespace');
    });

    it('should transform a v1 XRD with claims', () => {
      const xrd: XRD = {
        apiVersion: 'apiextensions.crossplane.io/v1',
        kind: 'CompositeResourceDefinition',
        metadata: {
          name: 'tests.example.com'
        },
        spec: {
          group: 'example.com',
          names: {
            kind: 'Test',
            plural: 'tests'
          },
          claimNames: {
            kind: 'TestClaim',
            plural: 'testclaims'
          },
          versions: [{
            name: 'v1alpha1',
            served: true,
            referenceable: true
          }]
        }
      };

      const templates = transformer.transform(xrd);

      expect(templates).toHaveLength(1);
      const template = templates[0];
      expect(template.metadata.annotations['crossplane.io/api-version']).toBe('v1');
      expect(template.metadata.annotations['crossplane.io/uses-claims']).toBe('true');
      expect(template.metadata.title).toBe('TestClaim Template');
    });

    it('should generate multiple templates for multiple served versions', () => {
      const xrd: XRD = {
        apiVersion: 'apiextensions.crossplane.io/v2',
        kind: 'CompositeResourceDefinition',
        metadata: {
          name: 'tests.example.com'
        },
        spec: {
          group: 'example.com',
          names: {
            kind: 'Test',
            plural: 'tests'
          },
          scope: 'Cluster',
          versions: [
            {
              name: 'v1alpha1',
              served: true,
              referenceable: true
            },
            {
              name: 'v1beta1',
              served: true,
              referenceable: true
            },
            {
              name: 'v1',
              served: false, // Not served, should be skipped
              referenceable: true
            }
          ]
        }
      };

      const templates = transformer.transform(xrd);

      expect(templates).toHaveLength(2);
      expect(templates[0].metadata.name).toBe('tests-template-v1alpha1');
      expect(templates[0].metadata.title).toContain('v1alpha1');
      expect(templates[1].metadata.name).toBe('tests-template-v1beta1');
      expect(templates[1].metadata.title).toContain('v1beta1');
    });

    it('should skip non-served versions', () => {
      const xrd: XRD = {
        apiVersion: 'apiextensions.crossplane.io/v2',
        kind: 'CompositeResourceDefinition',
        metadata: {
          name: 'tests.example.com'
        },
        spec: {
          group: 'example.com',
          names: {
            kind: 'Test',
            plural: 'tests'
          },
          scope: 'Cluster',
          versions: [
            {
              name: 'v1alpha1',
              served: false,
              referenceable: true
            },
            {
              name: 'v1beta1',
              served: true,
              referenceable: true
            }
          ]
        }
      };

      const templates = transformer.transform(xrd);

      expect(templates).toHaveLength(1);
      expect(templates[0].metadata.name).toBe('tests-template-v1beta1');
    });

    it('should add deprecated tag for deprecated versions', () => {
      const xrd: XRD = {
        apiVersion: 'apiextensions.crossplane.io/v2',
        kind: 'CompositeResourceDefinition',
        metadata: {
          name: 'tests.example.com'
        },
        spec: {
          group: 'example.com',
          names: {
            kind: 'Test',
            plural: 'tests'
          },
          scope: 'Cluster',
          versions: [{
            name: 'v1alpha1',
            served: true,
            referenceable: true,
            deprecated: true
          }]
        }
      };

      const templates = transformer.transform(xrd);

      expect(templates[0].metadata.annotations['backstage.io/deprecated']).toBe('true');
      expect(templates[0].metadata.tags).toContain('deprecated');
    });

    it('should handle XRDs with OpenAPI schema', () => {
      const xrd: XRD = {
        apiVersion: 'apiextensions.crossplane.io/v2',
        kind: 'CompositeResourceDefinition',
        metadata: {
          name: 'tests.example.com'
        },
        spec: {
          group: 'example.com',
          names: {
            kind: 'Test',
            plural: 'tests'
          },
          scope: 'Cluster',
          versions: [{
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
                      replicas: { type: 'integer', default: 3 }
                    }
                  }
                }
              }
            }
          }]
        }
      };

      const templates = transformer.transform(xrd);

      expect(templates[0].metadata.annotations['crossplane.io/has-schema']).toBe('true');
      
      const resourceSection = templates[0].spec.parameters.find(s => s.title === 'Resource Configuration');
      expect(resourceSection).toBeDefined();
      expect(resourceSection?.properties).toHaveProperty('replicas');
    });

    it('should handle errors gracefully and continue processing other versions', () => {
      const xrd: XRD = {
        apiVersion: 'apiextensions.crossplane.io/v2',
        kind: 'CompositeResourceDefinition',
        metadata: {
          name: 'tests.example.com'
        },
        spec: {
          group: 'example.com',
          names: {
            kind: 'Test',
            plural: 'tests'
          },
          scope: 'Cluster',
          versions: [
            {
              name: 'v1alpha1',
              served: true,
              referenceable: true,
              // This will cause validation to fail due to invalid schema
              schema: {
                openAPIV3Schema: null as any
              }
            },
            {
              name: 'v1beta1',
              served: true,
              referenceable: true
            }
          ]
        }
      };

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const templates = transformer.transform(xrd);
      
      // Should still return the valid template (v1beta1)
      expect(templates.length).toBeGreaterThan(0);
      // Note: The error is logged internally but validation passes for v1beta1
      
      consoleSpy.mockRestore();
    });
  });

  describe('canTransform', () => {
    it('should validate a valid XRD', () => {
      const xrd: XRD = {
        apiVersion: 'apiextensions.crossplane.io/v2',
        kind: 'CompositeResourceDefinition',
        metadata: {
          name: 'tests.example.com'
        },
        spec: {
          group: 'example.com',
          names: {
            kind: 'Test',
            plural: 'tests'
          },
          scope: 'Cluster',
          versions: [{
            name: 'v1alpha1',
            served: true,
            referenceable: true
          }]
        }
      };

      const result = transformer.canTransform(xrd);

      expect(result.valid).toBe(true);
      expect(result.reasons).toHaveLength(0);
    });

    it('should detect missing metadata.name', () => {
      const xrd: XRD = {
        apiVersion: 'apiextensions.crossplane.io/v2',
        kind: 'CompositeResourceDefinition',
        metadata: {} as any,
        spec: {
          group: 'example.com',
          names: {
            kind: 'Test',
            plural: 'tests'
          },
          scope: 'Cluster',
          versions: [{
            name: 'v1alpha1',
            served: true,
            referenceable: true
          }]
        }
      };

      const result = transformer.canTransform(xrd);

      expect(result.valid).toBe(false);
      expect(result.reasons).toContain('XRD metadata.name is required');
    });

    it('should detect missing spec.group', () => {
      const xrd: XRD = {
        apiVersion: 'apiextensions.crossplane.io/v2',
        kind: 'CompositeResourceDefinition',
        metadata: {
          name: 'tests.example.com'
        },
        spec: {
          names: {
            kind: 'Test',
            plural: 'tests'
          },
          scope: 'Cluster',
          versions: [{
            name: 'v1alpha1',
            served: true,
            referenceable: true
          }]
        } as any
      };

      const result = transformer.canTransform(xrd);

      expect(result.valid).toBe(false);
      expect(result.reasons).toContain('XRD spec.group is required');
    });

    it('should detect no served versions', () => {
      const xrd: XRD = {
        apiVersion: 'apiextensions.crossplane.io/v2',
        kind: 'CompositeResourceDefinition',
        metadata: {
          name: 'tests.example.com'
        },
        spec: {
          group: 'example.com',
          names: {
            kind: 'Test',
            plural: 'tests'
          },
          scope: 'Cluster',
          versions: [{
            name: 'v1alpha1',
            served: false,
            referenceable: true
          }]
        }
      };

      const result = transformer.canTransform(xrd);

      expect(result.valid).toBe(false);
      expect(result.reasons).toContain('XRD must have at least one served version');
    });
  });

  describe('preview', () => {
    it('should provide a preview of transformation', () => {
      const xrd: XRD = {
        apiVersion: 'apiextensions.crossplane.io/v2',
        kind: 'CompositeResourceDefinition',
        metadata: {
          name: 'tests.example.com'
        },
        spec: {
          group: 'example.com',
          names: {
            kind: 'Test',
            plural: 'tests'
          },
          scope: 'Namespaced',
          versions: [
            {
              name: 'v1alpha1',
              served: true,
              referenceable: true,
              deprecated: true,
              schema: {
                openAPIV3Schema: {
                  type: 'object',
                  properties: {}
                }
              }
            },
            {
              name: 'v1beta1',
              served: true,
              referenceable: true
            }
          ]
        },
        clusters: ['cluster-1', 'cluster-2']
      };

      const preview = transformer.preview(xrd);

      expect(preview.crossplaneVersion.version).toBe('v2');
      expect(preview.crossplaneVersion.scope).toBe('Namespaced');
      expect(preview.templateCount).toBe(2);
      expect(preview.versions).toHaveLength(2);
      expect(preview.versions[0].deprecated).toBe(true);
      expect(preview.versions[0].hasSchema).toBe(true);
      expect(preview.versions[1].hasSchema).toBe(false);
      expect(preview.resourceKind).toBe('Test');
      expect(preview.requiresNamespace).toBe(true);
      expect(preview.multiCluster).toBe(true);
    });
  });

  describe('with custom configuration', () => {
    it('should apply custom configuration to transformers', () => {
      const config: XRDTransformerConfig = {
        extractorConfig: {
          includePublishing: true,
          publishPhase: {
            git: {
              repoUrl: 'github.com?owner=test&repo=catalog',
              targetBranch: 'main'
            }
          }
        },
        stepGeneratorConfig: {
          includeFetch: true,
          includeRegister: true
        },
        templateBuilderConfig: {
          namePrefix: 'custom-',
          templateType: 'infrastructure'
        }
      };

      const customTransformer = new XRDTransformer(config);

      const xrd: XRD = {
        apiVersion: 'apiextensions.crossplane.io/v2',
        kind: 'CompositeResourceDefinition',
        metadata: {
          name: 'tests.example.com'
        },
        spec: {
          group: 'example.com',
          names: {
            kind: 'Test',
            plural: 'tests'
          },
          scope: 'Cluster',
          versions: [{
            name: 'v1alpha1',
            served: true,
            referenceable: true
          }]
        }
      };

      const templates = customTransformer.transform(xrd);

      expect(templates[0].metadata.name).toBe('custom-tests-template');
      expect(templates[0].spec.type).toBe('infrastructure');
      
      // Should have publishing section in parameters
      const publishingSection = templates[0].spec.parameters.find(s => s.title === 'Publishing Configuration');
      expect(publishingSection).toBeDefined();
      
      // Should have fetch and register steps
      const fetchStep = templates[0].spec.steps.find(s => s.id === 'fetch');
      expect(fetchStep).toBeDefined();
      
      const registerStep = templates[0].spec.steps.find(s => s.id === 'register');
      expect(registerStep).toBeDefined();
    });
  });
});