/**
 * Test fixtures and utilities for kubernetes-ingestor tests
 */

import { XRD, XRDVersion } from '../../src/types';

/**
 * Creates a minimal valid XRD for testing
 */
export function createMockXRD(overrides?: Partial<XRD>): XRD {
  return {
    apiVersion: 'apiextensions.crossplane.io/v1',
    kind: 'CompositeResourceDefinition',
    metadata: {
      name: 'test.example.com',
      labels: {},
      annotations: {},
      ...overrides?.metadata,
    },
    spec: {
      group: 'example.com',
      names: {
        kind: 'Test',
        plural: 'tests',
        singular: 'test',
        ...overrides?.spec?.names,
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
                    name: {
                      type: 'string',
                      description: 'Test name',
                    },
                  },
                  required: ['name'],
                },
              },
            },
          },
        },
      ],
      ...overrides?.spec,
    },
    clusters: overrides?.clusters,
  };
}

/**
 * Creates a v2 XRD (cluster-scoped, no claims)
 */
export function createMockXRDv2(overrides?: Partial<XRD>): XRD {
  return createMockXRD({
    apiVersion: 'apiextensions.crossplane.io/v2',
    spec: {
      scope: 'Cluster',
      ...overrides?.spec,
    },
    ...overrides,
  });
}

/**
 * Creates a namespaced v2 XRD
 */
export function createMockXRDv2Namespaced(overrides?: Partial<XRD>): XRD {
  return createMockXRD({
    apiVersion: 'apiextensions.crossplane.io/v2',
    spec: {
      scope: 'Namespaced',
      ...overrides?.spec,
    },
    ...overrides,
  });
}

/**
 * Creates an XRD with claim names (v1 style)
 */
export function createMockXRDWithClaims(overrides?: Partial<XRD>): XRD {
  return createMockXRD({
    spec: {
      claimNames: {
        kind: 'TestClaim',
        plural: 'testclaims',
        singular: 'testclaim',
      },
      ...overrides?.spec,
    },
    ...overrides,
  });
}

/**
 * Creates an XRD version for testing
 */
export function createMockXRDVersion(overrides?: Partial<XRDVersion>): XRDVersion {
  return {
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
              field1: {
                type: 'string',
                description: 'Test field 1',
              },
              field2: {
                type: 'number',
                description: 'Test field 2',
              },
            },
          },
        },
      },
    },
    ...overrides,
  };
}

/**
 * Sample XRD content as string for parsing tests
 */
export const SAMPLE_XRD_YAML = `
apiVersion: apiextensions.crossplane.io/v1
kind: CompositeResourceDefinition
metadata:
  name: xpostgresqlinstances.database.example.com
spec:
  group: database.example.com
  names:
    kind: XPostgreSQLInstance
    plural: xpostgresqlinstances
  claimNames:
    kind: PostgreSQLInstance
    plural: postgresqlinstances
  scope: Cluster
  versions:
  - name: v1alpha1
    served: true
    referenceable: true
    schema:
      openAPIV3Schema:
        type: object
        properties:
          spec:
            type: object
            properties:
              storageGB:
                type: integer
                description: Storage size in GB
              version:
                type: string
                description: PostgreSQL version
            required:
            - storageGB
`.trim();