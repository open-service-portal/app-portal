import { KubeConfig } from '@kubernetes/client-node';
import { LoggerService } from '@backstage/backend-plugin-api';
import { ClusterConfig, CrossplaneXR } from '../types';
import https from 'https';

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
        const clusterConfig: any = {
          name: cluster.name,
          server: cluster.url,
        };

        // Add skipTLSVerify if configured
        if (cluster.skipTLSVerify) {
          clusterConfig.skipTLSVerify = true;
        }

        kc.loadFromOptions({
          clusters: [clusterConfig],
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
        // Build API path
        const apiPath = namespace
          ? `/apis/${group}/${version}/namespaces/${namespace}/${plural}`
          : `/apis/${group}/${version}/${plural}`;

        // Get cluster config
        const cluster = this.clusters.find(c => c.name === clusterName);
        if (!cluster) {
          throw new Error(`Cluster ${clusterName} not found`);
        }

        // Make direct HTTPS request
        const url = new URL(apiPath, cluster.url);

        const body: any = await new Promise((resolve, reject) => {
          const options = {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${cluster.serviceAccountToken}`,
              'Accept': 'application/json',
            },
            rejectUnauthorized: !cluster.skipTLSVerify,
          };

          https.get(url.toString(), options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
              data += chunk;
            });

            res.on('end', () => {
              if (res.statusCode !== 200) {
                reject(new Error(`K8s API returned ${res.statusCode}: ${res.statusMessage}`));
                return;
              }

              try {
                resolve(JSON.parse(data));
              } catch (err) {
                reject(new Error(`Failed to parse JSON response: ${err}`));
              }
            });
          }).on('error', (err) => {
            reject(err);
          });
        });

        // Parse response items
        const items = body.items || [];
        for (const item of items) {
          results.push(this.transformToXR(item, clusterName));
        }

        this.logger.debug(
          `Found ${results.length} XRs of kind ${kind} in cluster ${clusterName}`,
        );
      } catch (error: any) {
        this.logger.error(
          `Failed to list XRs in cluster ${clusterName}: ${error.message}`,
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
