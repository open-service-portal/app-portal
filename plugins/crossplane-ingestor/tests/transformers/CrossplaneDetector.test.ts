/**
 * Unit tests for CrossplaneDetector
 */

import { CrossplaneDetector } from '../../src/../src/transformers/CrossplaneDetector';
import { XRD } from '../../src/types';

describe('CrossplaneDetector', () => {
  let detector: CrossplaneDetector;

  beforeEach(() => {
    detector = new CrossplaneDetector();
  });

  describe('detect', () => {
    it('should detect v1 XRD correctly', () => {
      const xrd: XRD = {
        apiVersion: 'apiextensions.crossplane.io/v1',
        kind: 'CompositeResourceDefinition',
        metadata: {
          name: 'test.example.com'
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

      const result = detector.detect(xrd);

      expect(result).toEqual({
        version: 'v1',
        scope: 'Cluster',
        usesClaims: true
      });
    });

    it('should detect v2 Namespaced XRD correctly', () => {
      const xrd: XRD = {
        apiVersion: 'apiextensions.crossplane.io/v2',
        kind: 'CompositeResourceDefinition',
        metadata: {
          name: 'test.example.com'
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

      const result = detector.detect(xrd);

      expect(result).toEqual({
        version: 'v2',
        scope: 'Namespaced',
        usesClaims: false
      });
    });

    it('should detect v2 Cluster XRD correctly', () => {
      const xrd: XRD = {
        apiVersion: 'apiextensions.crossplane.io/v2',
        kind: 'CompositeResourceDefinition',
        metadata: {
          name: 'test.example.com'
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

      const result = detector.detect(xrd);

      expect(result).toEqual({
        version: 'v2',
        scope: 'Cluster',
        usesClaims: false
      });
    });

    it('should detect v2 LegacyCluster XRD with claims', () => {
      const xrd: XRD = {
        apiVersion: 'apiextensions.crossplane.io/v2',
        kind: 'CompositeResourceDefinition',
        metadata: {
          name: 'test.example.com'
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
          scope: 'LegacyCluster',
          versions: []
        }
      };

      const result = detector.detect(xrd);

      expect(result).toEqual({
        version: 'v2',
        scope: 'LegacyCluster',
        usesClaims: true
      });
    });
  });

  describe('getResourceKind', () => {
    it('should return claim kind for v1 XRD', () => {
      const xrd: XRD = {
        apiVersion: 'apiextensions.crossplane.io/v1',
        kind: 'CompositeResourceDefinition',
        metadata: {
          name: 'test.example.com'
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

      const result = detector.getResourceKind(xrd);
      expect(result).toBe('TestClaim');
    });

    it('should return XR kind for v2 Namespaced XRD', () => {
      const xrd: XRD = {
        apiVersion: 'apiextensions.crossplane.io/v2',
        kind: 'CompositeResourceDefinition',
        metadata: {
          name: 'test.example.com'
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

      const result = detector.getResourceKind(xrd);
      expect(result).toBe('Test');
    });

    it('should return XR kind when no claim names exist', () => {
      const xrd: XRD = {
        apiVersion: 'apiextensions.crossplane.io/v1',
        kind: 'CompositeResourceDefinition',
        metadata: {
          name: 'test.example.com'
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

      const result = detector.getResourceKind(xrd);
      expect(result).toBe('Test');
    });
  });

  describe('needsNamespaceParameter', () => {
    it('should return true for v1 XRD with claims', () => {
      const xrd: XRD = {
        apiVersion: 'apiextensions.crossplane.io/v1',
        kind: 'CompositeResourceDefinition',
        metadata: {
          name: 'test.example.com'
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

      const result = detector.needsNamespaceParameter(xrd);
      expect(result).toBe(true);
    });

    it('should return true for v2 Namespaced XRD', () => {
      const xrd: XRD = {
        apiVersion: 'apiextensions.crossplane.io/v2',
        kind: 'CompositeResourceDefinition',
        metadata: {
          name: 'test.example.com'
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

      const result = detector.needsNamespaceParameter(xrd);
      expect(result).toBe(true);
    });

    it('should return false for v2 Cluster XRD', () => {
      const xrd: XRD = {
        apiVersion: 'apiextensions.crossplane.io/v2',
        kind: 'CompositeResourceDefinition',
        metadata: {
          name: 'test.example.com'
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

      const result = detector.needsNamespaceParameter(xrd);
      expect(result).toBe(false);
    });
  });
});