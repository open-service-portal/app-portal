/**
 * Unit tests for ParameterExtractor
 */

import { ParameterExtractor } from '../../src/../src/transformers/ParameterExtractor';
import { CrossplaneDetector } from '../../src/../src/transformers/CrossplaneDetector';
import { XRD, XRDVersion, ExtractorConfig } from '../../src/types';

describe('ParameterExtractor', () => {
  let detector: CrossplaneDetector;
  let extractor: ParameterExtractor;

  beforeEach(() => {
    detector = new CrossplaneDetector();
    extractor = new ParameterExtractor(detector);
  });

  describe('extract', () => {
    it('should extract basic metadata parameters', () => {
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
          versions: []
        }
      };

      const version: XRDVersion = {
        name: 'v1alpha1',
        served: true,
        referenceable: true
      };

      const sections = extractor.extract(xrd, version);

      expect(sections).toHaveLength(1); // Only metadata section
      expect(sections[0].title).toBe('Resource Metadata');
      expect(sections[0].properties).toHaveProperty('xrName');
      expect(sections[0].properties).toHaveProperty('owner');
      expect(sections[0].properties).toHaveProperty('namespace'); // Claims need namespace
    });

    it('should extract parameters from OpenAPI schema', () => {
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
                  replicas: {
                    type: 'integer',
                    description: 'Number of replicas',
                    default: 3,
                    minimum: 1,
                    maximum: 10
                  },
                  image: {
                    type: 'string',
                    description: 'Container image',
                    default: 'nginx:latest'
                  },
                  enabled: {
                    type: 'boolean',
                    description: 'Enable the feature',
                    default: true
                  }
                },
                required: ['image']
              }
            }
          }
        }
      };

      const sections = extractor.extract(xrd, version);

      expect(sections).toHaveLength(2); // Metadata + Resource config
      
      const resourceSection = sections[1];
      expect(resourceSection.title).toBe('Resource Configuration');
      expect(resourceSection.required).toEqual(['image']);
      expect(resourceSection.properties).toHaveProperty('replicas');
      expect(resourceSection.properties).toHaveProperty('image');
      expect(resourceSection.properties).toHaveProperty('enabled');

      const replicasParam = resourceSection.properties.replicas;
      expect(replicasParam.type).toBe('number');
      expect(replicasParam.default).toBe(3);
      expect(replicasParam.minimum).toBe(1);
      expect(replicasParam.maximum).toBe(10);
    });

    it('should include publishing section when configured', () => {
      const config: ExtractorConfig = {
        includePublishing: true,
        publishPhase: {
          git: {
            repoUrl: 'github.com?owner=test&repo=test',
            targetBranch: 'develop'
          }
        }
      };

      const extractorWithPublishing = new ParameterExtractor(detector, config);

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

      const version: XRDVersion = {
        name: 'v1alpha1',
        served: true,
        referenceable: true
      };

      const sections = extractorWithPublishing.extract(xrd, version);

      expect(sections).toHaveLength(2); // Metadata + Publishing
      
      const publishingSection = sections[1];
      expect(publishingSection.title).toBe('Publishing Configuration');
      expect(publishingSection.properties).toHaveProperty('pushToGit');
      expect(publishingSection.properties).toHaveProperty('repoUrl');
      expect(publishingSection.properties.repoUrl.default).toContain('test&repo=test');
    });

    it('should add cluster parameter for multi-cluster XRDs', () => {
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
        },
        clusters: ['cluster-1', 'cluster-2', 'cluster-3']
      };

      const version: XRDVersion = {
        name: 'v1alpha1',
        served: true,
        referenceable: true
      };

      const sections = extractor.extract(xrd, version);
      
      const metadataSection = sections[0];
      expect(metadataSection.properties).toHaveProperty('cluster');
      expect(metadataSection.properties.cluster.enum).toEqual(['cluster-1', 'cluster-2', 'cluster-3']);
    });

    it('should handle enum fields in schema', () => {
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
                  tier: {
                    type: 'string',
                    description: 'Service tier',
                    enum: ['basic', 'standard', 'premium'],
                    default: 'standard'
                  }
                }
              }
            }
          }
        }
      };

      const sections = extractor.extract(xrd, version);
      
      const resourceSection = sections[1];
      const tierParam = resourceSection.properties.tier;
      expect(tierParam.enum).toEqual(['basic', 'standard', 'premium']);
      expect(tierParam.enumNames).toEqual(['basic', 'standard', 'premium']);
    });

    it('should convert defaults to placeholders when configured', () => {
      const config: ExtractorConfig = {
        convertDefaultValuesToPlaceholders: true
      };

      const extractorWithPlaceholders = new ParameterExtractor(detector, config);

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
                  replicas: {
                    type: 'integer',
                    default: 3
                  }
                }
              }
            }
          }
        }
      };

      const sections = extractorWithPlaceholders.extract(xrd, version);
      
      const resourceSection = sections[1];
      expect(resourceSection.properties.replicas.default).toBe('${{ parameters.replicas | default("3") }}');
    });
  });

  describe('humanizeFieldName', () => {
    it('should convert camelCase to Title Case', () => {
      const extractor = new ParameterExtractor(detector);
      // Access private method through any type casting for testing
      const humanize = (extractor as any).humanizeFieldName.bind(extractor);
      
      expect(humanize('fieldName')).toBe('Field Name');
      expect(humanize('myLongFieldName')).toBe('My Long Field Name');
    });

    it('should handle snake_case and kebab-case', () => {
      const extractor = new ParameterExtractor(detector);
      const humanize = (extractor as any).humanizeFieldName.bind(extractor);
      
      expect(humanize('field_name')).toBe('Field Name');
      expect(humanize('field-name')).toBe('Field Name');
    });
  });
});