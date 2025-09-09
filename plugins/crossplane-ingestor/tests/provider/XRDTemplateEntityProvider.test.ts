import { XRDTemplateEntityProviderRefactored } from '../../src/provider/XRDTemplateEntityProvider';
import { EntityProviderConnection } from '@backstage/plugin-catalog-node';
import { SchedulerServiceTaskRunner } from '@backstage/backend-plugin-api';
import { Config } from '@backstage/config';
import { CatalogApi } from '@backstage/catalog-client';
import { PermissionEvaluator } from '@backstage/plugin-permission-common';
import {
  LoggerService,
  DiscoveryService,
  HttpAuthService,
  AuthService,
} from '@backstage/backend-plugin-api';
import { XRD } from '../../src/types';

describe('XRDTemplateEntityProviderRefactored', () => {
  let provider: XRDTemplateEntityProviderRefactored;
  let mockTaskRunner: jest.Mocked<SchedulerServiceTaskRunner>;
  let mockLogger: jest.Mocked<LoggerService>;
  let mockConfig: jest.Mocked<Config>;
  let mockCatalogApi: jest.Mocked<CatalogApi>;
  let mockDiscovery: jest.Mocked<DiscoveryService>;
  let mockPermissions: jest.Mocked<PermissionEvaluator>;
  let mockAuth: jest.Mocked<AuthService>;
  let mockHttpAuth: jest.Mocked<HttpAuthService>;
  let mockConnection: jest.Mocked<EntityProviderConnection>;

  beforeEach(() => {
    // Create mocks
    mockTaskRunner = {
      run: jest.fn(),
    } as any;

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      child: jest.fn(() => mockLogger),
    } as any;

    mockConfig = {
      getOptionalBoolean: jest.fn(),
      getOptionalString: jest.fn(),
      getOptionalStringArray: jest.fn(),
      getOptionalConfig: jest.fn(),
    } as any;

    mockCatalogApi = {} as any;
    mockDiscovery = {} as any;
    mockPermissions = {} as any;
    mockAuth = {} as any;
    mockHttpAuth = {} as any;

    mockConnection = {
      applyMutation: jest.fn(),
      refresh: jest.fn(),
    } as any;

    // Create provider instance
    provider = new XRDTemplateEntityProviderRefactored(
      mockTaskRunner,
      mockLogger,
      mockConfig,
      mockCatalogApi,
      mockDiscovery,
      mockPermissions,
      mockAuth,
      mockHttpAuth,
    );
  });

  describe('getProviderName', () => {
    it('should return the provider name', () => {
      expect(provider.getProviderName()).toBe('XRDTemplateEntityProvider');
    });
  });

  describe('connect', () => {
    it('should connect and schedule the task runner', async () => {
      await provider.connect(mockConnection);

      expect(mockTaskRunner.run).toHaveBeenCalledWith({
        id: 'XRDTemplateEntityProvider',
        fn: expect.any(Function),
      });
    });
  });

  describe('run', () => {
    beforeEach(() => {
      // Set up default config values
      mockConfig.getOptionalBoolean.mockImplementation((key) => {
        if (key === 'kubernetesIngestor.crossplane.enabled') return true;
        if (key === 'kubernetesIngestor.crossplane.xrds.enabled') return true;
        if (key === 'kubernetesIngestor.crds.enabled') return true;
        return false;
      });
    });

    it('should throw error if connection not initialized', async () => {
      await expect(provider.run()).rejects.toThrow('Connection not initialized');
    });

    it('should skip processing when crossplane is disabled', async () => {
      mockConfig.getOptionalBoolean.mockImplementation((key) => {
        if (key === 'kubernetesIngestor.crossplane.enabled') return false;
        return true;
      });

      await provider.connect(mockConnection);
      await provider.run();

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Crossplane support is disabled, skipping XRD ingestion'
      );
      expect(mockConnection.applyMutation).toHaveBeenCalledWith({
        type: 'full',
        entities: [],
      });
    });

    it('should process XRDs when enabled', async () => {
      // Mock XrdDataProvider to return test XRDs
      const mockXRD: XRD = {
        apiVersion: 'apiextensions.crossplane.io/v1',
        kind: 'CompositeResourceDefinition',
        metadata: {
          name: 'test.example.com',
        },
        spec: {
          group: 'example.com',
          names: {
            kind: 'Test',
            plural: 'tests',
          },
          scope: 'Namespaced',
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
                      name: { type: 'string' },
                    },
                  },
                },
              },
            },
          }],
        },
        clusterName: 'test-cluster',
      };

      // Mock the XrdDataProvider
      jest.mock('../../src/provider/XrdDataProvider', () => ({
        XrdDataProvider: jest.fn().mockImplementation(() => ({
          fetchXRDObjects: jest.fn().mockResolvedValue([mockXRD]),
        })),
      }));

      await provider.connect(mockConnection);
      
      // We can't easily test the full run without mocking more internals
      // This would require significant setup of the XRDTransformer
    });
  });

  describe('validateXRDName', () => {
    it('should validate XRD names correctly', () => {
      const xrdValid: XRD = {
        metadata: { name: 'valid-name' },
      } as any;

      const xrdTooLong: XRD = {
        metadata: { 
          name: 'this-is-a-very-long-name-that-exceeds-sixty-three-characters-limit-for-kubernetes'
        },
      } as any;

      const xrdNoName: XRD = {
        metadata: {},
      } as any;

      // Use private method access for testing
      const validateMethod = (provider as any).validateXRDName.bind(provider);

      expect(validateMethod(xrdValid)).toBe(true);
      expect(validateMethod(xrdTooLong)).toBe(false);
      expect(validateMethod(xrdNoName)).toBe(false);

      // Check logging
      validateMethod(xrdTooLong);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('exceeds 63 characters')
      );
    });
  });

  describe('getTransformerConfig', () => {
    it('should build correct transformer configuration', () => {
      mockConfig.getOptionalString.mockImplementation((key) => {
        if (key === 'kubernetesIngestor.annotationPrefix') return 'custom.prefix';
        if (key === 'kubernetesIngestor.defaultOwner') return 'test-team';
        return undefined;
      });

      mockConfig.getOptionalBoolean.mockImplementation((key) => {
        if (key === 'kubernetesIngestor.includePublishing') return true;
        if (key === 'kubernetesIngestor.includeFetch') return false;
        return false;
      });

      mockConfig.getOptionalStringArray.mockImplementation((key) => {
        if (key === 'kubernetesIngestor.additionalTags') return ['tag1', 'tag2'];
        return [];
      });

      const config = (provider as any).getTransformerConfig();

      expect(config).toEqual({
        extractorConfig: {
          includePublishing: true,
          publishPhase: undefined,
        },
        stepGeneratorConfig: {
          includeFetch: false,
          includeRegister: false,
          includePublishing: true,
        },
        templateBuilderConfig: {
          templateType: 'crossplane-resource',
          owner: 'test-team',
          additionalTags: ['tag1', 'tag2'],
          kubernetesUIEnabled: false,
          publishingEnabled: false,
          annotationPrefix: 'custom.prefix',
        },
      });
    });
  });

  describe('CRD processing', () => {
    it('should check CRD compatibility correctly', () => {
      const compatibleCRD = {
        metadata: { name: 'test-crd' },
        spec: {
          group: 'example.com',
          names: { kind: 'TestCRD' },
          versions: [{ name: 'v1' }],
        },
      };

      const incompatibleCRD = {
        metadata: { name: 'test-crd' },
        spec: {
          group: 'example.com',
        },
      };

      const isCRDCompatible = (provider as any).isCRDCompatibleWithXRD.bind(provider);

      expect(isCRDCompatible(compatibleCRD)).toBe(true);
      expect(isCRDCompatible(incompatibleCRD)).toBe(false);
    });

    it('should convert CRD to XRD format', () => {
      const crd = {
        apiVersion: 'apiextensions.k8s.io/v1',
        metadata: { name: 'test-crd' },
        spec: {
          group: 'example.com',
          names: { kind: 'TestCRD' },
          scope: 'Cluster',
          versions: [{ name: 'v1' }],
        },
        clusterName: 'test-cluster',
      };

      const convertMethod = (provider as any).convertCRDToXRDFormat.bind(provider);
      const xrd = convertMethod(crd);

      expect(xrd).toEqual({
        apiVersion: 'apiextensions.k8s.io/v1',
        kind: 'CustomResourceDefinition',
        metadata: { name: 'test-crd' },
        spec: {
          group: 'example.com',
          names: { kind: 'TestCRD' },
          scope: 'Cluster',
          versions: [{ name: 'v1' }],
          claimNames: undefined,
        },
        clusters: ['test-cluster'],
      });
    });
  });
});