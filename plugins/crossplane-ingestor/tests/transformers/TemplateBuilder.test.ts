/**
 * Unit tests for TemplateBuilder
 */

import { TemplateBuilder } from '../../src/../src/transformers/TemplateBuilder';
import { 
  XRD, 
  XRDVersion, 
  ParameterSection, 
  BackstageTemplateStep,
  TemplateBuilderConfig 
} from '../../src/types';

describe('TemplateBuilder', () => {
  let builder: TemplateBuilder;

  beforeEach(() => {
    builder = new TemplateBuilder();
  });

  describe('build', () => {
    it('should build a complete Backstage template', () => {
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
      
      const parameterSections: ParameterSection[] = [{
        title: 'Basic Configuration',
        properties: {
          name: { type: 'string', title: 'Name' }
        }
      }];

      const steps: BackstageTemplateStep[] = [{
        id: 'create',
        name: 'Create Resource',
        action: 'kubernetes:apply',
        input: { manifest: {} }
      }];

      const template = builder.build(xrd, version, parameterSections, steps);

      expect(template.apiVersion).toBe('scaffolder.backstage.io/v1beta3');
      expect(template.kind).toBe('Template');
      expect(template.metadata.name).toBe('tests-template');
      expect(template.metadata.title).toBe('Test Template');
      expect(template.spec.type).toBe('crossplane-resource');
      expect(template.spec.parameters).toEqual(parameterSections);
      expect(template.spec.steps).toEqual(steps);
    });

    it('should extract title from XRD annotations', () => {
      const xrd: XRD = {
        apiVersion: 'apiextensions.crossplane.io/v2',
        kind: 'CompositeResourceDefinition',
        metadata: {
          name: 'tests.example.com',
          annotations: {
            'backstage.io/title': 'Custom Test Resource',
            'backstage.io/description': 'A custom test resource for demos'
          }
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

      const template = builder.build(xrd, xrd.spec.versions[0], [], []);

      expect(template.metadata.title).toBe('Custom Test Resource');
      expect(template.metadata.description).toBe('A custom test resource for demos');
    });

    it('should extract tags from XRD labels', () => {
      const xrd: XRD = {
        apiVersion: 'apiextensions.crossplane.io/v2',
        kind: 'CompositeResourceDefinition',
        metadata: {
          name: 'tests.example.com',
          labels: {
            'openportal.dev/tags': 'database,storage,managed'
          }
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

      const template = builder.build(xrd, xrd.spec.versions[0], [], []);

      expect(template.metadata.tags).toContain('database');
      expect(template.metadata.tags).toContain('storage');
      expect(template.metadata.tags).toContain('managed');
      expect(template.metadata.tags).toContain('crossplane');
      expect(template.metadata.tags).toContain('crossplane-v2');
      expect(template.metadata.tags).toContain('cluster');
    });

    it('should add XRD reference annotations', () => {
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
      const template = builder.build(xrd, version, [], []);

      expect(template.metadata.annotations['crossplane.io/xrd']).toBe('tests.example.com');
      expect(template.metadata.annotations['crossplane.io/version']).toBe('v1alpha1');
    });

    it('should add icon annotation from XRD', () => {
      const xrd: XRD = {
        apiVersion: 'apiextensions.crossplane.io/v2',
        kind: 'CompositeResourceDefinition',
        metadata: {
          name: 'tests.example.com',
          annotations: {
            'backstage.io/icon': 'database'
          }
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

      const template = builder.build(xrd, xrd.spec.versions[0], [], []);

      expect(template.metadata.annotations['backstage.io/icon']).toBe('database');
    });

    it('should build links from XRD annotations', () => {
      const xrd: XRD = {
        apiVersion: 'apiextensions.crossplane.io/v2',
        kind: 'CompositeResourceDefinition',
        metadata: {
          name: 'tests.example.com',
          annotations: {
            'openportal.dev/docs-url': 'https://docs.example.com/test',
            'openportal.dev/source-url': 'https://github.com/example/test',
            'openportal.dev/support-url': 'https://support.example.com'
          }
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

      const template = builder.build(xrd, xrd.spec.versions[0], [], []);

      expect(template.metadata.links).toHaveLength(3);
      expect(template.metadata.links?.[0]).toEqual({
        url: 'https://docs.example.com/test',
        title: 'Documentation',
        icon: 'docs'
      });
      expect(template.metadata.links?.[1]).toEqual({
        url: 'https://github.com/example/test',
        title: 'Source Code',
        icon: 'github'
      });
    });

    it('should use custom template name from config', () => {
      const config: TemplateBuilderConfig = {
        namePrefix: 'custom-',
        nameSuffix: '-xr'
      };
      const builderWithConfig = new TemplateBuilder(config);

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

      const template = builderWithConfig.build(xrd, xrd.spec.versions[0], [], []);

      expect(template.metadata.name).toBe('custom-tests-xr');
    });

    it('should add output links based on config', () => {
      const config: TemplateBuilderConfig = {
        kubernetesUIEnabled: true,
        publishingEnabled: true,
        catalogRegistrationEnabled: true
      };
      const builderWithConfig = new TemplateBuilder(config);

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

      const template = builderWithConfig.build(xrd, xrd.spec.versions[0], [], []);

      expect(template.spec.output?.links).toHaveLength(3);
      expect(template.spec.output?.links?.[0].title).toBe('View in Kubernetes');
      expect(template.spec.output?.links?.[1].title).toBe('View Pull Request');
      expect(template.spec.output?.links?.[2].title).toBe('View in Catalog');
    });

    it('should include namespace in output text for Namespaced resources', () => {
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

      const template = builder.build(xrd, xrd.spec.versions[0], [], []);

      expect(template.spec.output?.text).toContain('- **Namespace**: ${{ parameters.namespace }}');
    });

    it('should add owner to spec when configured', () => {
      const config: TemplateBuilderConfig = {
        owner: 'platform-team'
      };
      const builderWithOwner = new TemplateBuilder(config);

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

      const template = builderWithOwner.build(xrd, xrd.spec.versions[0], [], []);

      expect(template.spec.owner).toBe('platform-team');
    });
  });

  describe('validate', () => {
    it('should validate a complete template', () => {
      const template = {
        apiVersion: 'scaffolder.backstage.io/v1beta3',
        kind: 'Template',
        metadata: {
          name: 'test-template',
          title: 'Test Template',
          annotations: {}
        },
        spec: {
          type: 'service',
          parameters: [{
            title: 'Test',
            properties: {
              name: { type: 'string' as const }
            }
          }],
          steps: [{
            id: 'test',
            action: 'test:action',
            name: 'Test Step',
            input: {}
          }],
          output: {}
        }
      };

      const errors = builder.validate(template);
      expect(errors).toHaveLength(0);
    });

    it('should detect missing template name', () => {
      const template = {
        apiVersion: 'scaffolder.backstage.io/v1beta3',
        kind: 'Template',
        metadata: {
          name: '',
          title: 'Test Template',
          annotations: {}
        },
        spec: {
          type: 'service',
          parameters: [],
          steps: [],
          output: {}
        }
      };

      const errors = builder.validate(template);
      expect(errors).toContain('Template name is required');
    });

    it('should detect invalid template name format', () => {
      const template = {
        apiVersion: 'scaffolder.backstage.io/v1beta3',
        kind: 'Template',
        metadata: {
          name: 'Test_Template',
          title: 'Test Template',
          annotations: {}
        },
        spec: {
          type: 'service',
          parameters: [{
            title: 'Test',
            properties: { name: { type: 'string' as const } }
          }],
          steps: [{
            id: 'test',
            action: 'test:action',
            name: 'Test Step',
            input: {}
          }],
          output: {}
        }
      };

      const errors = builder.validate(template);
      expect(errors).toContain('Template name must contain only lowercase letters, numbers, and hyphens');
    });

    it('should detect missing parameters', () => {
      const template = {
        apiVersion: 'scaffolder.backstage.io/v1beta3',
        kind: 'Template',
        metadata: {
          name: 'test-template',
          title: 'Test Template',
          annotations: {}
        },
        spec: {
          type: 'service',
          parameters: [],
          steps: [{
            id: 'test',
            action: 'test:action',
            name: 'Test Step',
            input: {}
          }],
          output: {}
        }
      };

      const errors = builder.validate(template);
      expect(errors).toContain('Template must have at least one parameter section');
    });

    it('should detect missing steps', () => {
      const template = {
        apiVersion: 'scaffolder.backstage.io/v1beta3',
        kind: 'Template',
        metadata: {
          name: 'test-template',
          title: 'Test Template',
          annotations: {}
        },
        spec: {
          type: 'service',
          parameters: [{
            title: 'Test',
            properties: { name: { type: 'string' as const } }
          }],
          steps: [],
          output: {}
        }
      };

      const errors = builder.validate(template);
      expect(errors).toContain('Template must have at least one step');
    });
  });

  describe('mergeParameterSections', () => {
    it('should merge sections with the same title', () => {
      const sections: ParameterSection[] = [
        {
          title: 'Configuration',
          properties: {
            name: { type: 'string', title: 'Name' }
          },
          required: ['name']
        },
        {
          title: 'Configuration',
          properties: {
            namespace: { type: 'string', title: 'Namespace' }
          },
          required: ['namespace']
        }
      ];

      const merged = builder.mergeParameterSections(sections);

      expect(merged).toHaveLength(1);
      expect(merged[0].title).toBe('Configuration');
      expect(merged[0].properties).toHaveProperty('name');
      expect(merged[0].properties).toHaveProperty('namespace');
      expect(merged[0].required).toEqual(['name', 'namespace']);
    });

    it('should preserve unique sections', () => {
      const sections: ParameterSection[] = [
        {
          title: 'Basic',
          properties: {
            name: { type: 'string', title: 'Name' }
          }
        },
        {
          title: 'Advanced',
          properties: {
            replicas: { type: 'number', title: 'Replicas' }
          }
        }
      ];

      const merged = builder.mergeParameterSections(sections);

      expect(merged).toHaveLength(2);
      expect(merged[0].title).toBe('Basic');
      expect(merged[1].title).toBe('Advanced');
    });

    it('should handle duplicate required fields', () => {
      const sections: ParameterSection[] = [
        {
          title: 'Config',
          properties: {
            name: { type: 'string', title: 'Name' }
          },
          required: ['name', 'owner']
        },
        {
          title: 'Config',
          properties: {
            namespace: { type: 'string', title: 'Namespace' }
          },
          required: ['name', 'namespace']
        }
      ];

      const merged = builder.mergeParameterSections(sections);

      expect(merged[0].required).toEqual(['name', 'owner', 'namespace']);
    });
  });
});