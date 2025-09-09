/**
 * Unit tests for StepGeneratorV2
 */

import { StepGeneratorV2 } from '../../src/../src/transformers/StepGeneratorV2';
import { XRD, XRDVersion, ParameterSection, StepGeneratorConfig } from '../../src/types';

describe('StepGeneratorV2', () => {
  let generator: StepGeneratorV2;

  beforeEach(() => {
    generator = new StepGeneratorV2();
  });

  describe('generate', () => {
    it('should generate XR creation step for v2 Namespaced XRD', () => {
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

      const version = xrd.spec.versions[0];
      const parameterSections: ParameterSection[] = [];

      const steps = generator.generate(xrd, version, parameterSections);

      expect(steps).toHaveLength(1);
      expect(steps[0].id).toBe('create-xr');
      expect(steps[0].name).toBe('Create Test XR');
      expect(steps[0].action).toBe('kubernetes:apply');
      
      const manifest = steps[0].input.manifest;
      expect(manifest.apiVersion).toBe('example.com/v1alpha1');
      expect(manifest.kind).toBe('Test');
      expect(manifest.metadata.name).toBe('${{ parameters.xrName }}');
      expect(manifest.metadata.namespace).toBe('${{ parameters.namespace }}');
      expect(steps[0].input.namespace).toBe('${{ parameters.namespace }}');
    });

    it('should generate XR creation step for v2 Cluster XRD', () => {
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

      const version = xrd.spec.versions[0];
      const steps = generator.generate(xrd, version, []);

      const manifest = steps[0].input.manifest;
      expect(manifest.kind).toBe('Test');
      expect(manifest.metadata.namespace).toBeUndefined();
      expect(steps[0].input.namespace).toBeUndefined();
    });

    it('should include proper labels and annotations', () => {
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

      const version = xrd.spec.versions[0];
      const steps = generator.generate(xrd, version, []);

      const manifest = steps[0].input.manifest;
      expect(manifest.metadata.labels).toMatchObject({
        'app.kubernetes.io/managed-by': 'backstage',
        'backstage.io/owner': '${{ parameters.owner }}',
        'crossplane.io/xrd': 'tests.example.com'
      });
      expect(manifest.metadata.annotations).toMatchObject({
        'backstage.io/created-by': '${{ user.entity.metadata.name }}',
        'backstage.io/template': '${{ template.metadata.name }}'
      });
    });

    it('should include fetch step when configured', () => {
      const config: StepGeneratorConfig = {
        includeFetch: true
      };
      const generatorWithFetch = new StepGeneratorV2(config);

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

      const version = xrd.spec.versions[0];
      const steps = generatorWithFetch.generate(xrd, version, []);

      expect(steps).toHaveLength(2);
      expect(steps[0].id).toBe('fetch');
      expect(steps[0].action).toBe('fetch:template');
      expect(steps[1].id).toBe('create-xr');
    });

    it('should add composition selector with XRD label', () => {
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

      const version = xrd.spec.versions[0];
      const steps = generator.generate(xrd, version, []);

      const manifest = steps[0].input.manifest;
      expect(manifest.spec.compositionSelector).toEqual({
        matchLabels: {
          'crossplane.io/xrd': 'tests.example.com'
        }
      });
    });

    it('should add composition selector with composition name when defaultCompositionRef exists', () => {
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
          defaultCompositionRef: {
            name: 'test-composition'
          },
          versions: [{
            name: 'v1alpha1',
            served: true,
            referenceable: true
          }]
        }
      };

      const version = xrd.spec.versions[0];
      const steps = generator.generate(xrd, version, []);

      const manifest = steps[0].input.manifest;
      expect(manifest.spec.compositionSelector).toEqual({
        matchLabels: {
          'crossplane.io/xrd': 'tests.example.com',
          'crossplane.io/composition': 'test-composition'
        }
      });
    });

    it('should map OpenAPI schema properties to manifest spec', () => {
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
                      replicas: { type: 'integer' },
                      image: { type: 'string' },
                      enabled: { type: 'boolean' }
                    }
                  }
                }
              }
            }
          }]
        }
      };

      const version = xrd.spec.versions[0];
      const steps = generator.generate(xrd, version, []);

      const manifest = steps[0].input.manifest;
      expect(manifest.spec.replicas).toBe('${{ parameters.replicas }}');
      expect(manifest.spec.image).toBe('${{ parameters.image }}');
      expect(manifest.spec.enabled).toBe('${{ parameters.enabled }}');
    });

    it('should handle nested object properties in schema', () => {
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
                      database: {
                        type: 'object',
                        properties: {
                          host: { type: 'string' },
                          port: { type: 'integer' }
                        }
                      }
                    }
                  }
                }
              }
            }
          }]
        }
      };

      const version = xrd.spec.versions[0];
      const steps = generator.generate(xrd, version, []);

      const manifest = steps[0].input.manifest;
      expect(manifest.spec.database).toEqual({
        host: '${{ parameters.database_host }}',
        port: '${{ parameters.database_port }}'
      });
    });

    it('should handle multi-cluster XRDs', () => {
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
        },
        clusters: ['cluster-1', 'cluster-2', 'cluster-3']
      };

      const version = xrd.spec.versions[0];
      const steps = generator.generate(xrd, version, []);

      expect(steps[0].input.cluster).toBe('${{ parameters.cluster }}');
    });

    it('should include Git publishing steps when configured', () => {
      const config: StepGeneratorConfig = {
        includePublishing: true,
        publishPhase: {
          git: {
            repoUrl: 'github.com?owner=test&repo=orders',
            targetBranch: 'main',
            targetPath: 'cluster/xrs'
          }
        }
      };
      const generatorWithPublishing = new StepGeneratorV2(config);

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

      const version = xrd.spec.versions[0];
      const steps = generatorWithPublishing.generate(xrd, version, []);

      expect(steps.length).toBeGreaterThan(1);
      
      const generateStep = steps.find(s => s.id === 'generate-manifest');
      expect(generateStep).toBeDefined();
      expect(generateStep?.action).toBe('fetch:plain');

      const publishStep = steps.find(s => s.id === 'publish-git');
      expect(publishStep).toBeDefined();
      expect(publishStep?.action).toBe('publish:github:pull-request');
      expect(publishStep?.input.targetPath).toBe('cluster/xrs');
    });

    it('should include Flux reconciliation step when configured', () => {
      const config: StepGeneratorConfig = {
        includePublishing: true,
        publishPhase: {
          flux: {
            kustomization: 'catalog-orders',
            namespace: 'flux-system'
          }
        }
      };
      const generatorWithFlux = new StepGeneratorV2(config);

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

      const version = xrd.spec.versions[0];
      const steps = generatorWithFlux.generate(xrd, version, []);

      const fluxStep = steps.find(s => s.id === 'reconcile-flux');
      expect(fluxStep).toBeDefined();
      expect(fluxStep?.action).toBe('flux:reconcile');
      expect(fluxStep?.input.kustomization).toBe('catalog-orders');
    });

    it('should use custom actions when configured', () => {
      const config: StepGeneratorConfig = {
        customActions: {
          createResource: 'custom:kubernetes:create-xr'
        }
      };
      const generatorWithCustomActions = new StepGeneratorV2(config);

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

      const version = xrd.spec.versions[0];
      const steps = generatorWithCustomActions.generate(xrd, version, []);

      expect(steps[0].action).toBe('custom:kubernetes:create-xr');
    });
  });

  describe('isCompatible', () => {
    it('should accept v2 Cluster XRDs', () => {
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
          versions: []
        }
      };

      expect(generator.isCompatible(xrd)).toBe(true);
    });

    it('should accept v2 Namespaced XRDs', () => {
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
          versions: []
        }
      };

      expect(generator.isCompatible(xrd)).toBe(true);
    });

    it('should reject v1 XRDs', () => {
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
          versions: []
        }
      };

      expect(generator.isCompatible(xrd)).toBe(false);
    });

    it('should reject v2 LegacyCluster XRDs', () => {
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
          scope: 'LegacyCluster',
          versions: []
        }
      };

      expect(generator.isCompatible(xrd)).toBe(false);
    });

    it('should reject XRDs without scope', () => {
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
          versions: []
        }
      };

      expect(generator.isCompatible(xrd)).toBe(false);
    });
  });

  describe('validateConfig', () => {
    it('should return no errors for valid config', () => {
      const config: StepGeneratorConfig = {
        includePublishing: true,
        publishPhase: {
          git: {
            repoUrl: 'github.com?owner=test&repo=orders',
            targetBranch: 'main'
          }
        }
      };
      const generator = new StepGeneratorV2(config);

      const errors = generator.validateConfig();
      expect(errors).toHaveLength(0);
    });

    it('should detect missing publishPhase when publishing is enabled', () => {
      const config: StepGeneratorConfig = {
        includePublishing: true
      };
      const generator = new StepGeneratorV2(config);

      const errors = generator.validateConfig();
      expect(errors).toContain('Publishing is enabled but publishPhase config is missing');
    });

    it('should detect missing flux kustomization', () => {
      const config: StepGeneratorConfig = {
        includePublishing: true,
        publishPhase: {
          flux: {
            kustomization: '',
            namespace: 'flux-system'
          }
        }
      };
      const generator = new StepGeneratorV2(config);

      const errors = generator.validateConfig();
      expect(errors).toContain('Flux reconciliation is configured but kustomization is missing');
    });
  });
});