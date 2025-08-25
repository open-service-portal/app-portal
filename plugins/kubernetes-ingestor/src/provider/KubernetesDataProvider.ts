import { Config, JsonObject } from '@backstage/config';
import { LoggerService } from '@backstage/backend-plugin-api';
import { KubernetesBuilder } from '@backstage/plugin-kubernetes-backend';
import { CatalogApi } from '@backstage/catalog-client';
import { PermissionEvaluator } from '@backstage/plugin-permission-common';
import {
  DiscoveryService,
  BackstageCredentials,
} from '@backstage/backend-plugin-api';
import {
  KubernetesObjectTypes,
  ClusterDetails,
} from '@backstage/plugin-kubernetes-node';
import pluralize from 'pluralize';
import { ANNOTATION_KUBERNETES_AUTH_PROVIDER } from '@backstage/plugin-kubernetes-common';
import { getAuthCredential } from '../auth';

type ObjectToFetch = {
  group: string;
  apiVersion: string;
  plural: string;
  singular?: string;
  objectType: KubernetesObjectTypes;
};

// Add new type definitions for auth providers
type AuthProvider = 'serviceAccount' | 'google' | 'aws' | 'azure' | 'oidc';

// Extend ClusterDetails to include authProvider
interface ExtendedClusterDetails extends ClusterDetails {
  authProvider?: AuthProvider;
}

export class KubernetesDataProvider {
  logger: LoggerService;
  config: Config;
  catalogApi: CatalogApi;
  permissions: PermissionEvaluator;
  discovery: DiscoveryService;

  private getAnnotationPrefix(): string {
    return (
      this.config.getOptionalString('kubernetesIngestor.annotationPrefix') ||
      'terasky.backstage.io'
    );
  }

  constructor(
    logger: LoggerService,
    config: Config,
    catalogApi: CatalogApi,
    permissions: PermissionEvaluator,
    discovery: DiscoveryService,
  ) {
    this.logger = logger;
    this.config = config;
    this.catalogApi = catalogApi;
    this.permissions = permissions;
    this.discovery = discovery;
  }

  async fetchKubernetesObjects(): Promise<any[]> {
    try {
      const builder = KubernetesBuilder.createBuilder({
        logger: this.logger,
        config: this.config,
        catalogApi: this.catalogApi,
        permissions: this.permissions,
        discovery: this.discovery,
      });

      const globalAuthStrategies = (global as any).kubernetesAuthStrategies;
      if (globalAuthStrategies) {
        for (const [key, strategy] of globalAuthStrategies) {
          this.logger.debug(`Adding auth strategy: ${key}`);
          builder.addAuthStrategy(key, strategy);
        }
      }

      const { fetcher, clusterSupplier } = await builder.build();

      const credentials: BackstageCredentials = {
        $$type: '@backstage/BackstageCredentials',
        principal: 'anonymous',
      };

      const clusters = await clusterSupplier.getClusters({ credentials });

      if (clusters.length === 0) {
        this.logger.warn('No clusters found.');
        return [];
      }

      const disableDefaultWorkloadTypes =
        this.config.getOptionalBoolean(
          'kubernetesIngestor.components.disableDefaultWorkloadTypes',
        ) ?? false;

      const defaultWorkloadTypes: ObjectToFetch[] = [
        {
          group: 'apps',
          apiVersion: 'v1',
          plural: 'deployments',
          objectType: 'deployments',
        },
        {
          group: 'apps',
          apiVersion: 'v1',
          plural: 'statefulsets',
          objectType: 'statefulsets',
        },
        {
          group: 'apps',
          apiVersion: 'v1',
          plural: 'daemonsets',
          objectType: 'daemonsets',
        },
        {
          group: 'batch',
          apiVersion: 'v1',
          plural: 'cronjobs',
          objectType: 'cronjobs',
        },
      ];

      const customWorkloadTypes =
        this.config
          .getOptionalConfigArray(
            'kubernetesIngestor.components.customWorkloadTypes',
          )
          ?.map(type => ({
            group: type.getString('group'),
            apiVersion: type.getString('apiVersion'),
            plural: type.getString('plural'),
            singular: type.getOptionalString('singular'),
            objectType: type.getString('plural') as KubernetesObjectTypes,
          })) || [];

      const objectTypesToFetch: Set<ObjectToFetch> = new Set([
        ...(disableDefaultWorkloadTypes ? [] : defaultWorkloadTypes),
        ...customWorkloadTypes,
      ]);

      const isCrossplaneEnabled = this.config.getOptionalBoolean('kubernetesIngestor.crossplane.enabled') ?? true;

      // Only add Crossplane-related objects if the feature is enabled
      if (isCrossplaneEnabled) {
        // --- BEGIN: Add all v2/Cluster and v2/Namespaced composite kinds (XRs) to objectTypesToFetch ---
        try {
          // Import XrdDataProvider here to avoid circular dependency at top
          const { XrdDataProvider } = await import('./XrdDataProvider');
          // You may need to pass auth/httpAuth if required by your XrdDataProvider constructor
          const xrdDataProvider = new XrdDataProvider(
            this.logger,
            this.config,
            this.catalogApi,
            this.discovery,
            this.permissions,
            // @ts-ignore
            this.auth,
            // @ts-ignore
            this.httpAuth,
          );
          const xrdObjects = await xrdDataProvider.fetchXRDObjects();
          for (const xrd of xrdObjects) {
            const isV2 = !!xrd.spec?.scope;
            const scope = xrd.spec?.scope || (isV2 ? 'LegacyCluster' : 'Cluster');
            if (isV2 && scope !== 'LegacyCluster') {
              for (const version of xrd.spec.versions || []) {
                objectTypesToFetch.add({
                  group: xrd.spec.group,
                  apiVersion: version.name,
                  plural: xrd.spec.names.plural,
                  objectType: 'customresources' as KubernetesObjectTypes,
                });
              }
            }
          }
        } catch (error) {
          this.logger.error('Failed to fetch XRD objects:', error as Error);
        }
      }

      const allowedClusters = this.config.getOptionalStringArray("kubernetesIngestor.allowedClusterNames");
      const onlyIngestAnnotatedResources = this.config.getOptionalBoolean('kubernetesIngestor.components.onlyIngestAnnotatedResources') ?? false;
      const excludedNamespaces = new Set(this.config.getOptionalStringArray('kubernetesIngestor.components.excludedNamespaces') || []);
      const ingestAllCrossplaneClaims = this.config.getOptionalBoolean('kubernetesIngestor.crossplane.claims.ingestAllClaims') ?? false;
      const objectTypeMap: Record<string, ObjectToFetch> = {};
      objectTypesToFetch.forEach(type => {
        objectTypeMap[type.plural] = type;
      });

      const allObjects: any[] = [];

      for (const cluster of clusters as ExtendedClusterDetails[]) {
        if (allowedClusters && !allowedClusters.includes(cluster.name)) {
          this.logger.debug(`Skipping cluster: ${cluster.name} as it is not included in the allowedClusterNames configuration.`);
          continue;
        }
        // Get the auth provider type from the cluster config
        const authProvider =
          cluster.authMetadata[ANNOTATION_KUBERNETES_AUTH_PROVIDER] ||
          'serviceAccount';

        // Get the auth credentials based on the provider type
        let credential;
        try {
          credential = await getAuthCredential(
            cluster,
            authProvider,
            this.config,
            this.logger,
          );
        } catch (error) {
          if (error instanceof Error) {
            this.logger.error(
              `Failed to get auth credentials for cluster ${cluster.name} with provider ${authProvider}:`,
              error,
            );
          } else {
            this.logger.error(
              `Failed to get auth credentials for cluster ${cluster.name} with provider ${authProvider}:`,
              {
                error: String(error),
              },
            );
          }
          continue;
        }

        try {
          // Only fetch Crossplane claims if enabled
          if (isCrossplaneEnabled && ingestAllCrossplaneClaims) {
            const claimCRDs = await this.fetchCRDsForCluster(
              fetcher,
              cluster,
              credential,
            );
            claimCRDs.forEach(crd => {
              objectTypesToFetch.add({
                group: crd.group,
                apiVersion: crd.version,
                plural: crd.plural,
                objectType: 'customresources' as KubernetesObjectTypes,
              });
              objectTypeMap[crd.plural] = {
                group: crd.group,
                apiVersion: crd.version,
                plural: crd.plural,
                objectType: 'customresources' as KubernetesObjectTypes,
              };
            });
          }

          if (
            this.config.getOptionalConfig(
              'kubernetesIngestor.genericCRDTemplates.crdLabelSelector',
            ) ||
            this.config.getOptionalStringArray(
              'kubernetesIngestor.genericCRDTemplates.crds',
            )
          ) {
            const genericCRDs = await this.fetchGenericCRDs(
              fetcher,
              cluster,
              credential,
            );
            genericCRDs.forEach(crd => {
              objectTypesToFetch.add({
                group: crd.group,
                apiVersion: crd.version,
                plural: crd.plural,
                objectType: 'customresources' as KubernetesObjectTypes,
              });
              objectTypeMap[crd.plural] = {
                group: crd.group,
                apiVersion: crd.version,
                plural: crd.plural,
                objectType: 'customresources' as KubernetesObjectTypes,
              };
            });
          }

          const fetchedObjects = await fetcher.fetchObjectsForService({
            serviceId: cluster.name,
            clusterDetails: cluster,
            credential,
            objectTypesToFetch,
            customResources: [],
          });
          const prefix = this.getAnnotationPrefix();
          const filteredObjects = await Promise.all(fetchedObjects.responses.flatMap(async response =>
            response.resources
              .filter(resource => {
                if (
                  resource.metadata.annotations?.[
                    `${prefix}/exclude-from-catalog`
                  ]
                ) {
                  return false;
                }

                if (onlyIngestAnnotatedResources) {
                  return resource.metadata.annotations?.[
                    `${prefix}/add-to-catalog`
                  ];
                }

                return !excludedNamespaces.has(resource.metadata.namespace);
              })
              .map(async resource => {
                let type = response.type as string;
                if (response.type === 'customresources') {
                  type = pluralize(resource.kind.toLowerCase());
                }
                const objectType = objectTypeMap[type];
                if (
                  objectType.group === null ||
                  objectType.apiVersion === null
                ) {
                  return {};
                }

                // Skip Crossplane-related resources if disabled
                if (!isCrossplaneEnabled) {
                  // Check if it's a Crossplane resource
                  if (resource.spec?.resourceRef || resource.spec?.crossplane) {
                    this.logger.debug(`Skipping Crossplane resource: ${resource.kind} ${resource.metadata?.name}`);
                    return {};
                  }
                }

                // Handle v2 composites: spec.crossplane.compositionRef.name
                if (isCrossplaneEnabled && resource.spec?.crossplane?.compositionRef?.name) {
                  const composition = await this.fetchComposition(
                    fetcher,
                    cluster,
                    credential,
                    resource.spec.crossplane.compositionRef.name,
                  );
                  const usedFunctions = this.extractUsedFunctions(composition);

                  return {
                    ...resource,
                    apiVersion: `${objectType.group}/${objectType.apiVersion}`,
                    kind: objectType.singular || pluralize.singular(objectType.plural) || objectType.plural?.slice(0, -1),
                    clusterName: cluster.name,
                    compositionData: {
                      name: resource.spec.crossplane.compositionRef.name,
                      usedFunctions,
                    },
                  };
                }
                // Handle claims: spec.compositionRef.name
                if (isCrossplaneEnabled && resource.spec?.compositionRef?.name) {
                  const composition = await this.fetchComposition(
                    fetcher,
                    cluster,
                    credential,
                    resource.spec.compositionRef.name,
                  );
                  const usedFunctions = this.extractUsedFunctions(composition);

                  return {
                    ...resource,
                    apiVersion: `${objectType.group}/${objectType.apiVersion}`,
                    kind: objectType.singular || pluralize.singular(objectType.plural) || objectType.plural?.slice(0, -1),
                    clusterName: cluster.name,
                    compositionData: {
                      name: resource.spec.compositionRef.name,
                      usedFunctions,
                    },
                  };
                }

                return {
                  ...resource,
                  apiVersion: `${objectType.group}/${objectType.apiVersion}`,
                  kind: objectType.singular || pluralize.singular(objectType.plural) || objectType.plural?.slice(0, -1),
                  clusterName: cluster.name,
                };
              })
          ));

          allObjects.push(...(await Promise.all(filteredObjects.flat())));
        } catch (error) {
          this.logger.error(
            `Failed to fetch objects for cluster ${cluster.name}: ${error}`,
          );
        }
      }

      return allObjects.filter(obj => Object.keys(obj).length > 0);
    } catch (error) {
      this.logger.error('Error fetching Kubernetes objects:', error as Error);
      return [];
    }
  }

  private async fetchComposition(
    fetcher: any,
    cluster: any,
    credential: any,
    compositionName: string,
  ): Promise<any> {
    const compositions = await fetcher.fetchObjectsForService({
      serviceId: cluster.name,
      clusterDetails: cluster,
      credential,
      objectTypesToFetch: new Set([
        {
          group: 'apiextensions.crossplane.io',
          apiVersion: 'v1',
          plural: 'compositions',
          objectType: 'customresources' as KubernetesObjectTypes,
        },
      ]),
      customResources: [],
    });

    return compositions.responses
      .flatMap((response: { resources: any }) => response.resources)
      .find(
        (composition: { metadata: { name: string } }) =>
          composition.metadata.name === compositionName,
      );
  }

  private extractUsedFunctions(composition: any): string[] {
    const usedFunctions = new Set<string>();
    if (composition?.spec?.pipeline) {
      composition.spec.pipeline.forEach(
        (item: { functionRef: { name: string } }) => {
          if (item.functionRef?.name) {
            usedFunctions.add(item.functionRef.name);
          }
        },
      );
    }
    return Array.from(usedFunctions);
  }

  async fetchCRDMapping(): Promise<Record<string, string>> {
    try {
      const builder = KubernetesBuilder.createBuilder({
        logger: this.logger,
        config: this.config,
        catalogApi: this.catalogApi,
        permissions: this.permissions,
        discovery: this.discovery,
      });

      const globalAuthStrategies = (global as any).kubernetesAuthStrategies;
      if (globalAuthStrategies) {
        for (const [key, strategy] of globalAuthStrategies) {
          this.logger.debug(`Adding auth strategy: ${key}`);
          builder.addAuthStrategy(key, strategy);
        }
      }

      const { fetcher, clusterSupplier } = await builder.build();

      const credentials: BackstageCredentials = {
        $$type: '@backstage/BackstageCredentials',
        principal: 'anonymous',
      };

      const clusters = await clusterSupplier.getClusters({ credentials });

      if (clusters.length === 0) {
        this.logger.warn('No clusters found for CRD mapping.');
        return {};
      }

      const crdMapping: Record<string, string> = {};

      const allowedClusters = this.config.getOptionalStringArray("kubernetesIngestor.allowedClusterNames");
      for (const cluster of clusters as ExtendedClusterDetails[]) {
        if (allowedClusters && !allowedClusters.includes(cluster.name)) {
          this.logger.debug(`Skipping cluster: ${cluster.name} as it is not included in the allowedClusterNames configuration.`);
          continue;
        }
        // Get the auth provider type from the cluster config
        const authProvider =
          cluster.authMetadata[ANNOTATION_KUBERNETES_AUTH_PROVIDER] ||
          'serviceAccount';

        // Get the auth credentials based on the provider type
        let credential;
        try {
          credential = await getAuthCredential(cluster, authProvider,this.config,this.logger);
        } catch (error) {
          if (error instanceof Error) {
            this.logger.error(
              `Failed to get auth credentials for cluster ${cluster.name} with provider ${authProvider}:`,
              error,
            );
          } else {
            this.logger.error(
              `Failed to get auth credentials for cluster ${cluster.name} with provider ${authProvider}:`,
              {
                error: String(error),
              },
            );
          }
          continue;
        }

        try {
          const crds = await fetcher.fetchObjectsForService({
            serviceId: cluster.name,
            clusterDetails: cluster,
            credential,
            objectTypesToFetch: new Set([
              {
                group: 'apiextensions.k8s.io',
                apiVersion: 'v1',
                plural: 'customresourcedefinitions',
                objectType: 'customresources' as KubernetesObjectTypes,
              },
            ]),
            customResources: [],
          });

          crds.responses
            .flatMap(response => response.resources)
            .forEach(crd => {
              const kind = crd.spec?.names?.kind;
              const plural = crd.spec?.names?.plural;
              if (kind && plural) {
                crdMapping[kind] = plural;
              }
            });
        } catch (clusterError) {
          if (clusterError instanceof Error) {
            this.logger.error(
              `Failed to fetch objects for cluster ${cluster.name}: ${clusterError.message}`,
              clusterError,
            );
          } else {
            this.logger.error(
              `Failed to fetch objects for cluster ${cluster.name}:`,
              {
                error: String(clusterError),
              },
            );
          }
        }
      }

      return crdMapping;
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error('Error fetching Kubernetes objects', error);
      } else if (typeof error === 'object') {
        this.logger.error(
          'Error fetching Kubernetes objects',
          error as JsonObject,
        );
      } else {
        this.logger.error(
          'Unknown error occurred while fetching Kubernetes objects',
          {
            message: String(error),
          },
        );
      }
      return {};
    }
  }

  private async fetchCRDsForCluster(
    fetcher: any,
    cluster: any,
    credential: any,
  ): Promise<{ group: string; version: string; plural: string }[]> {
    const claimCRDs = await fetcher.fetchObjectsForService({
      serviceId: cluster.name,
      clusterDetails: cluster,
      credential,
      objectTypesToFetch: new Set([
        {
          group: 'apiextensions.k8s.io',
          apiVersion: 'v1',
          plural: 'customresourcedefinitions',
          objectType: 'customresources' as KubernetesObjectTypes,
        },
      ]),
      customResources: [],
    });

    return claimCRDs.responses
      .flatMap((response: { resources: any }) => response.resources)
      .filter(
        (resource: { spec: { names: { categories: string | string[] } } }) =>
          resource?.spec?.names?.categories?.includes('claim'),
      )
      .map(
        (crd: {
          spec: {
            group: any;
            versions: { name: any }[];
            names: { plural: any };
          };
        }) => ({
          group: crd.spec.group,
          version: crd.spec.versions[0]?.name || '',
          plural: crd.spec.names.plural,
        }),
      );
  }

  private async fetchGenericCRDs(
    fetcher: any,
    cluster: any,
    credential: any,
  ): Promise<{ group: string; version: string; plural: string }[]> {
    const labelSelector = this.config.getOptionalConfig(
      'kubernetesIngestor.genericCRDTemplates.crdLabelSelector',
    );
    const specificCRDs =
      this.config.getOptionalStringArray(
        'kubernetesIngestor.genericCRDTemplates.crds',
      ) || [];

    const crds = await fetcher.fetchObjectsForService({
      serviceId: cluster.name,
      clusterDetails: cluster,
      credential,
      objectTypesToFetch: new Set([
        {
          group: 'apiextensions.k8s.io',
          apiVersion: 'v1',
          plural: 'customresourcedefinitions',
          objectType: 'customresources' as KubernetesObjectTypes,
        },
      ]),
      customResources: [],
    });

    return crds.responses
      .flatMap((response: { resources: any }) => response.resources)
      .filter((crd: any) => {
        if (labelSelector) {
          const key = labelSelector.getString('key');
          const value = labelSelector.getString('value');
          return crd.metadata?.labels?.[key] === value;
        }
        if (specificCRDs.length > 0) {
          return specificCRDs.includes(crd.metadata.name);
        }
        return false;
      })
      .map(
        (crd: {
          spec: {
            group: any;
            versions: { name: any; storage: boolean }[];
            names: { plural: any };
          };
        }) => {
          const storageVersion =
            crd.spec.versions.find(version => version.storage) ||
            crd.spec.versions[0];
          return {
            group: crd.spec.group,
            version: storageVersion.name,
            plural: crd.spec.names.plural,
          };
        },
      );
  }
}
