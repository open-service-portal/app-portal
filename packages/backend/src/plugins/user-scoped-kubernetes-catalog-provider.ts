/**
 * User-Scoped Kubernetes Catalog Provider
 *
 * This is a CUSTOM catalog provider that fetches Kubernetes resources
 * on-demand based on the CURRENT USER's context, rather than as a
 * background task.
 *
 * ⚠️  WARNING: This is non-standard Backstage architecture!
 *
 * Standard Backstage:
 *   - Catalog providers run as background tasks
 *   - No user context available
 *   - All users see same catalog
 *
 * This approach:
 *   - Catalog queries trigger K8s API calls
 *   - Uses current user's OIDC token
 *   - Each user sees different catalog
 *   - No caching (fresh data every time)
 *
 * Trade-offs:
 *   ✅ True multi-tenancy (users only see their resources)
 *   ✅ Real-time K8s data (no cache staleness)
 *   ✅ RBAC enforced by Kubernetes
 *   ❌ Slower catalog queries (K8s API calls per query)
 *   ❌ Higher K8s API load
 *   ❌ Doesn't work for background tasks (no user context)
 *   ❌ Non-standard architecture (harder to maintain)
 *
 * Use Cases:
 *   - Strict multi-tenancy requirements
 *   - Users should NEVER see resources they can't access
 *   - Real-time accuracy more important than performance
 *   - Small number of resources per user
 */

import { Entity } from '@backstage/catalog-model';
import { ClusterAuthStore } from './cluster-auth-store';
import { Logger } from 'winston';
import { Config } from '@backstage/config';

export interface UserScopedKubernetesOptions {
  logger: Logger;
  config: Config;
  clusterAuthStore: ClusterAuthStore;
}

export interface KubernetesClusterConfig {
  name: string;
  url: string;
  skipTLSVerify?: boolean;
  caData?: string;
}

/**
 * Fetch Kubernetes resources for a specific user
 *
 * This is called on-demand when user queries the catalog
 */
export class UserScopedKubernetesFetcher {
  private readonly logger: Logger;
  private readonly clusterAuthStore: ClusterAuthStore;
  private readonly clusters: KubernetesClusterConfig[];

  constructor(options: UserScopedKubernetesOptions) {
    this.logger = options.logger;
    this.clusterAuthStore = options.clusterAuthStore;

    // Load cluster configs from app-config.yaml
    this.clusters = this.loadClustersFromConfig(options.config);
  }

  private loadClustersFromConfig(config: Config): KubernetesClusterConfig[] {
    const clusters: KubernetesClusterConfig[] = [];

    try {
      const clusterConfigs = config.getOptionalConfigArray(
        'kubernetes.clusterLocatorMethods',
      );

      if (!clusterConfigs) {
        this.logger.warn('No kubernetes cluster configs found');
        return clusters;
      }

      for (const clusterLocator of clusterConfigs) {
        const type = clusterLocator.getString('type');
        if (type !== 'config') continue;

        const clusterArray = clusterLocator.getOptionalConfigArray('clusters');
        if (!clusterArray) continue;

        for (const clusterConfig of clusterArray) {
          // Only load clusters with clusterAuth provider
          const authProvider = clusterConfig.getOptionalString('authProvider');
          if (authProvider !== 'clusterAuth') {
            this.logger.debug('Skipping cluster (not using clusterAuth)', {
              name: clusterConfig.getOptionalString('name'),
              authProvider,
            });
            continue;
          }

          clusters.push({
            name: clusterConfig.getString('name'),
            url: clusterConfig.getString('url'),
            skipTLSVerify: clusterConfig.getOptionalBoolean('skipTLSVerify'),
            caData: clusterConfig.getOptionalString('caData'),
          });
        }
      }

      this.logger.info(`Loaded ${clusters.length} clusters for user-scoped catalog`, {
        clusters: clusters.map(c => c.name),
      });
    } catch (error) {
      this.logger.error('Failed to load cluster configs', error);
    }

    return clusters;
  }

  /**
   * Fetch Kubernetes resources for a specific user
   *
   * @param userEntityRef - The user's entity ref (e.g., "user:default/alice")
   * @param resourceTypes - Which K8s resources to fetch (e.g., ["Pod", "Deployment"])
   * @returns Backstage entities representing K8s resources
   */
  async fetchResourcesForUser(
    userEntityRef: string,
    resourceTypes: string[] = ['Pod', 'Deployment', 'Service'],
  ): Promise<Entity[]> {
    this.logger.info('Fetching Kubernetes resources for user', {
      user: userEntityRef,
      resourceTypes,
    });

    // Get user's cluster token
    const tokens = await this.clusterAuthStore.getTokens(userEntityRef);

    if (!tokens) {
      this.logger.warn('User has no cluster tokens', { user: userEntityRef });
      return [];
    }

    // Check if token expired
    if (tokens.expiresAt.getTime() < Date.now()) {
      this.logger.warn('User token expired', { user: userEntityRef });
      return [];
    }

    // Fetch resources from all clusters
    const allEntities: Entity[] = [];

    for (const cluster of this.clusters) {
      try {
        const entities = await this.fetchFromCluster(
          cluster,
          tokens.accessToken,
          resourceTypes,
        );

        allEntities.push(...entities);
      } catch (error: any) {
        this.logger.error('Failed to fetch from cluster', {
          cluster: cluster.name,
          user: userEntityRef,
          error: error.message,
        });
      }
    }

    this.logger.info('Fetched Kubernetes resources', {
      user: userEntityRef,
      totalEntities: allEntities.length,
    });

    return allEntities;
  }

  /**
   * Fetch resources from a specific cluster
   */
  private async fetchFromCluster(
    cluster: KubernetesClusterConfig,
    token: string,
    resourceTypes: string[],
  ): Promise<Entity[]> {
    const entities: Entity[] = [];

    // Example: Fetch Pods
    if (resourceTypes.includes('Pod')) {
      const pods = await this.fetchPods(cluster, token);
      entities.push(...pods);
    }

    // Example: Fetch Deployments
    if (resourceTypes.includes('Deployment')) {
      const deployments = await this.fetchDeployments(cluster, token);
      entities.push(...deployments);
    }

    return entities;
  }

  /**
   * Fetch Pods from cluster and convert to Backstage entities
   */
  private async fetchPods(
    cluster: KubernetesClusterConfig,
    token: string,
  ): Promise<Entity[]> {
    try {
      const fetch = (await import('node-fetch')).default;

      const response = await fetch(`${cluster.url}/api/v1/pods`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        // @ts-ignore
        rejectUnauthorized: !cluster.skipTLSVerify,
      });

      if (!response.ok) {
        this.logger.warn('Failed to fetch pods', {
          cluster: cluster.name,
          status: response.status,
        });
        return [];
      }

      const data: any = await response.json();
      const pods = data.items || [];

      // Convert K8s Pods to Backstage entities
      return pods.map((pod: any) => this.podToEntity(pod, cluster));
    } catch (error: any) {
      this.logger.error('Error fetching pods', {
        cluster: cluster.name,
        error: error.message,
      });
      return [];
    }
  }

  /**
   * Fetch Deployments from cluster and convert to Backstage entities
   */
  private async fetchDeployments(
    cluster: KubernetesClusterConfig,
    token: string,
  ): Promise<Entity[]> {
    try {
      const fetch = (await import('node-fetch')).default;

      const response = await fetch(
        `${cluster.url}/apis/apps/v1/deployments`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          // @ts-ignore
          rejectUnauthorized: !cluster.skipTLSVerify,
        },
      );

      if (!response.ok) {
        this.logger.warn('Failed to fetch deployments', {
          cluster: cluster.name,
          status: response.status,
        });
        return [];
      }

      const data: any = await response.json();
      const deployments = data.items || [];

      // Convert K8s Deployments to Backstage entities
      return deployments.map((deployment: any) =>
        this.deploymentToEntity(deployment, cluster),
      );
    } catch (error: any) {
      this.logger.error('Error fetching deployments', {
        cluster: cluster.name,
        error: error.message,
      });
      return [];
    }
  }

  /**
   * Convert Kubernetes Pod to Backstage Component entity
   */
  private podToEntity(pod: any, cluster: KubernetesClusterConfig): Entity {
    const namespace = pod.metadata.namespace || 'default';
    const name = pod.metadata.name;

    return {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Component',
      metadata: {
        name: `${name}`,
        namespace: namespace,
        title: name,
        description: `Kubernetes Pod in ${namespace}`,
        annotations: {
          'backstage.io/kubernetes-id': name,
          'backstage.io/kubernetes-namespace': namespace,
          'kubernetes.io/cluster': cluster.name,
          'kubernetes.io/resource-type': 'Pod',
        },
        labels: {
          'kubernetes.io/resource-type': 'pod',
          'kubernetes.io/cluster': cluster.name,
        },
        tags: ['kubernetes', 'pod', cluster.name],
      },
      spec: {
        type: 'service',
        lifecycle: 'production',
        owner: 'unknown',
        // Add pod-specific data
        ...pod.spec,
      },
    };
  }

  /**
   * Convert Kubernetes Deployment to Backstage Component entity
   */
  private deploymentToEntity(
    deployment: any,
    cluster: KubernetesClusterConfig,
  ): Entity {
    const namespace = deployment.metadata.namespace || 'default';
    const name = deployment.metadata.name;

    return {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Component',
      metadata: {
        name: `${name}`,
        namespace: namespace,
        title: name,
        description: `Kubernetes Deployment in ${namespace}`,
        annotations: {
          'backstage.io/kubernetes-id': name,
          'backstage.io/kubernetes-namespace': namespace,
          'kubernetes.io/cluster': cluster.name,
          'kubernetes.io/resource-type': 'Deployment',
        },
        labels: {
          'kubernetes.io/resource-type': 'deployment',
          'kubernetes.io/cluster': cluster.name,
        },
        tags: ['kubernetes', 'deployment', cluster.name],
      },
      spec: {
        type: 'service',
        lifecycle: 'production',
        owner: 'unknown',
        // Add deployment-specific data
        ...deployment.spec,
      },
    };
  }
}

/**
 * NOTE: This fetcher is NOT a standard EntityProvider!
 *
 * Standard EntityProvider:
 *   - Implements EntityProvider interface
 *   - connect() method called by catalog backend
 *   - Runs as background task
 *   - No user context
 *
 * This fetcher:
 *   - Called on-demand from catalog queries
 *   - Requires user context (userEntityRef)
 *   - No background processing
 *   - Returns entities directly
 *
 * To integrate with catalog, you would need to:
 *   1. Create custom catalog endpoint (e.g., /catalog/user-scoped)
 *   2. Call fetchResourcesForUser() with current user
 *   3. Return entities in catalog format
 *   4. Frontend queries this custom endpoint instead of standard /catalog
 *
 * This is a SIGNIFICANT architectural change!
 */
