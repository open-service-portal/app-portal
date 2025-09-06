/**
 * Unit tests for StepGenerator
 */

import { StepGenerator } from '../../src/../src/transformers/StepGenerator';
import { CrossplaneDetector } from '../../src/../src/transformers/CrossplaneDetector';
import { XRD, XRDVersion, ParameterSection, StepGeneratorConfig } from '../../src/types';

describe('StepGenerator', () => {
  let detector: CrossplaneDetector;
  let generator: StepGenerator;

  beforeEach(() => {
    detector = new CrossplaneDetector();
    generator = new StepGenerator(detector);
  });

  describe('generate', () => {
    it('should generate basic resource creation step for v1 XRD with claims', () => {
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

      const version = xrd.spec.versions[0];
      const parameterSections: ParameterSection[] = [];

      const steps = generator.generate(xrd, version, parameterSections);

      expect(steps).toHaveLength(1);
      expect(steps[0].id).toBe('create-resource');
      expect(steps[0].name).toBe('Create TestClaim');
      expect(steps[0].action).toBe('kubernetes:create');
      
      const manifest = steps[0].input.manifest;
      expect(manifest.apiVersion).toBe('example.com/v1alpha1');
      expect(manifest.kind).toBe('TestClaim');
      expect(manifest.metadata.name).toBe('${{ parameters.xrName }}');
      expect(manifest.metadata.namespace).toBe('${{ parameters.namespace }}');
    });

    it('should generate steps for v2 Namespaced XRD', () => {
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
      
      const manifest = steps[0].input.manifest;
      expect(manifest.apiVersion).toBe('example.com/v1alpha1');
      expect(manifest.kind).toBe('Test');
      expect(manifest.metadata.namespace).toBe('${{ parameters.namespace }}');
    });

    it('should generate steps for v2 Cluster XRD', () => {
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
      const parameterSections: ParameterSection[] = [];

      const steps = generator.generate(xrd, version, parameterSections);

      const manifest = steps[0].input.manifest;
      expect(manifest.kind).toBe('Test');
      expect(manifest.metadata.namespace).toBeUndefined();
    });

    it('should include fetch step when configured', () => {
      const config: StepGeneratorConfig = {
        includeFetch: true
      };
      const generatorWithFetch = new StepGenerator(detector, config);

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
      expect(steps[1].id).toBe('create-resource');
    });

    it('should include publishing steps when configured', () => {
      const config: StepGeneratorConfig = {
        includePublishing: true,
        publishPhase: {
          git: {
            repoUrl: 'github.com?owner=test&repo=orders',
            targetBranch: 'main'
          }
        }
      };
      const generatorWithPublishing = new StepGenerator(detector, config);

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
    });

    it('should include register step when configured', () => {
      const config: StepGeneratorConfig = {
        includeRegister: true,
        includePublishing: true,
        publishPhase: {
          git: {
            repoUrl: 'github.com?owner=test&repo=orders',
            targetBranch: 'main'
          }
        }
      };
      const generatorWithRegister = new StepGenerator(detector, config);

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
          versions: [{
            name: 'v1alpha1',
            served: true,
            referenceable: true
          }]
        }
      };

      const version = xrd.spec.versions[0];
      const steps = generatorWithRegister.generate(xrd, version, []);

      const registerStep = steps.find(s => s.id === 'register');
      expect(registerStep).toBeDefined();
      expect(registerStep?.action).toBe('catalog:register');
    });

    it('should handle multi-cluster XRDs', () => {
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

    it('should map OpenAPI schema properties to manifest spec', () => {
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

    it('should add composition reference for v1 XRDs', () => {
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
      expect(manifest.spec.compositionRef).toEqual({
        name: 'test-composition'
      });
    });

    it('should add composition selector for v2 XRDs', () => {
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
          'crossplane.io/xrd': 'tests.example.com'
        }
      });
    });

    it('should use custom actions when configured', () => {
      const config: StepGeneratorConfig = {
        customActions: {
          createResource: 'custom:kubernetes:apply'
        }
      };
      const generatorWithCustomActions = new StepGenerator(detector, config);

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
          versions: [{
            name: 'v1alpha1',
            served: true,
            referenceable: true
          }]
        }
      };

      const version = xrd.spec.versions[0];
      const steps = generatorWithCustomActions.generate(xrd, version, []);

      expect(steps[0].action).toBe('custom:kubernetes:apply');
    });

    it('should include ArgoCD sync step when configured', () => {
      const config: StepGeneratorConfig = {
        includePublishing: true,
        publishPhase: {
          git: {
            repoUrl: 'github.com?owner=test&repo=orders',
            targetBranch: 'main'
          },
          argocd: {
            application: 'my-app',
            namespace: 'argocd'
          }
        }
      };
      const generatorWithArgoCD = new StepGenerator(detector, config);

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
          versions: [{
            name: 'v1alpha1',
            served: true,
            referenceable: true
          }]
        }
      };

      const version = xrd.spec.versions[0];
      const steps = generatorWithArgoCD.generate(xrd, version, []);

      const argoCDStep = steps.find(s => s.id === 'sync-argocd');
      expect(argoCDStep).toBeDefined();
      expect(argoCDStep?.action).toBe('argocd:sync');
      expect(argoCDStep?.input.application).toBe('my-app');
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
      const generator = new StepGenerator(detector, config);

      const errors = generator.validateConfig();
      expect(errors).toHaveLength(0);
    });

    it('should detect missing publishPhase when publishing is enabled', () => {
      const config: StepGeneratorConfig = {
        includePublishing: true
      };
      const generator = new StepGenerator(detector, config);

      const errors = generator.validateConfig();
      expect(errors).toContain('Publishing is enabled but publishPhase config is missing');
    });

    it('should detect missing git repoUrl', () => {
      const config: StepGeneratorConfig = {
        includePublishing: true,
        publishPhase: {
          git: {
            repoUrl: '',
            targetBranch: 'main'
          }
        }
      };
      const generator = new StepGenerator(detector, config);

      const errors = generator.validateConfig();
      expect(errors).toContain('Git publishing is configured but repoUrl is missing');
    });

    it('should detect missing ArgoCD application name', () => {
      const config: StepGeneratorConfig = {
        includePublishing: true,
        publishPhase: {
          argocd: {
            application: '',
            namespace: 'argocd'
          }
        }
      };
      const generator = new StepGenerator(detector, config);

      const errors = generator.validateConfig();
      expect(errors).toContain('ArgoCD sync is configured but application name is missing');
    });
  });
});