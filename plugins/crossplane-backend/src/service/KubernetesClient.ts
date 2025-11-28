import { KubeConfig, CustomObjectsApi } from '@kubernetes/client-node';
import { LoggerService } from '@backstage/backend-plugin-api';
import { ClusterConfig, CrossplaneXR } from '../types';

/**
 * Kubernetes client for querying Crossplane resources
 */
export class KubernetesClient {
  private kubeConfigs: Map<string, KubeConfig> = new Map();

  constructor(
    private readonly logger: LoggerService,
    private readonly clusters: ClusterConfig[],
  ) {
    this.initializeClients();
  }

  /**
   * Initialize Kubernetes clients for all configured clusters
   */
  private initializeClients() {
    for (const cluster of this.clusters) {
      try {
        const kc = new KubeConfig();

        // Create cluster configuration
        kc.loadFromOptions({
          clusters: [{
            name: cluster.name,
            server: cluster.url,
            skipTLSVerify: cluster.skipTLSVerify ?? false,
          }],
          users: [{
            name: 'backstage',
            token: cluster.serviceAccountToken,
          }],
          contexts: [{
            name: cluster.name,
            cluster: cluster.name,
            user: 'backstage',
          }],
          currentContext: cluster.name,
        });

        this.kubeConfigs.set(cluster.name, kc);
        this.logger.info(`Initialized Kubernetes client for cluster: ${cluster.name}`);
      } catch (error) {
        this.logger.error(`Failed to initialize client for cluster ${cluster.name}:`, error);
      }
    }
  }

  /**
   * List XR instances across all clusters or specific cluster
   */
  async listXRs(
    apiVersion: string,
    kind: string,
    namespace?: string,
    clusterFilter?: string,
    labelSelector?: string,
  ): Promise<CrossplaneXR[]> {
    const results: CrossplaneXR[] = [];

    // Parse apiVersion into group and version
    const [group, version] = apiVersion.includes('/')
      ? apiVersion.split('/')
      : ['', apiVersion];

    // Convert kind to plural lowercase (simple pluralization)
    const plural = this.kindToPlural(kind);

    // Query each cluster
    for (const [clusterName, kc] of this.kubeConfigs.entries()) {
      // Skip if cluster filter is set and doesn't match
      if (clusterFilter && clusterFilter !== clusterName) {
        continue;
      }

      try {
        const api = kc.makeApiClient(CustomObjectsApi);

        let response: any;
        if (namespace) {
          // Namespaced resource
          response = await api.listNamespacedCustomObject(
            group,
            version,
            namespace,
            plural,
            undefined, // pretty
            undefined, // allowWatchBookmarks
            undefined, // continue
            undefined, // fieldSelector
            labelSelector,
          );
        } else {
          // Check if resource is cluster-scoped or search all namespaces
          try {
            response = await api.listClusterCustomObject(
              group,
              version,
              plural,
              undefined, // pretty
              undefined, // allowWatchBookmarks
              undefined, // continue
              undefined, // fieldSelector
              labelSelector,
            );
          } catch (error: any) {
            // If cluster-scoped fails, try listing across all namespaces
            if (error.response?.statusCode === 404) {
              response = await api.listClusterCustomObject(
                group,
                version,
                plural,
                undefined,
                undefined,
                undefined,
                undefined,
                labelSelector,
              );
            } else {
              throw error;
            }
          }
        }

        // Parse response items
        if (response.body && typeof response.body === 'object') {
          const body = response.body as any;
          const items = body.items || [];

          for (const item of items) {
            results.push(this.transformToXR(item, clusterName));
          }
        }

        this.logger.debug(
          `Found ${results.length} XRs of kind ${kind} in cluster ${clusterName}`,
        );
      } catch (error: any) {
        this.logger.error(
          `Failed to list XRs in cluster ${clusterName}:`,
          error.message,
        );
        // Continue with other clusters
      }
    }

    return results;
  }

  /**
   * Transform Kubernetes object to CrossplaneXR
   */
  private transformToXR(obj: any, clusterName: string): CrossplaneXR {
    const metadata = obj.metadata || {};
    const status = obj.status || {};

    // Determine ready state from conditions
    const conditions = status.conditions || [];
    const readyCondition = conditions.find((c: any) => c.type === 'Ready');
    const ready = readyCondition?.status === 'True';

    return {
      name: metadata.name,
      namespace: metadata.namespace,
      apiVersion: obj.apiVersion,
      kind: obj.kind,
      cluster: clusterName,
      labels: metadata.labels || {},
      annotations: metadata.annotations || {},
      status: {
        ready,
        conditions: conditions.map((c: any) => ({
          type: c.type,
          status: c.status,
          reason: c.reason,
          message: c.message,
          lastTransitionTime: c.lastTransitionTime,
        })),
      },
    };
  }

  /**
   * Simple pluralization for Kubernetes resource kinds
   * This handles most common cases but may need enhancement
   */
  private kindToPlural(kind: string): string {
    const lower = kind.toLowerCase();

    // Special cases
    const specialCases: Record<string, string> = {
      'dnssec': 'dnssecs',
      'ingress': 'ingresses',
      'networkpolicy': 'networkpolicies',
    };

    if (specialCases[lower]) {
      return specialCases[lower];
    }

    // General rules
    if (lower.endsWith('s') || lower.endsWith('x') || lower.endsWith('z')) {
      return lower + 'es';
    }
    if (lower.endsWith('y')) {
      return lower.slice(0, -1) + 'ies';
    }

    return lower + 's';
  }

  /**
   * Get list of configured cluster names
   */
  getClusterNames(): string[] {
    return Array.from(this.kubeConfigs.keys());
  }
}
