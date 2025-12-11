/**
 * Type definitions for Crossplane Backend Plugin
 */

/**
 * Crossplane XR instance returned by the API
 */
export interface CrossplaneXR {
  name: string;
  namespace?: string;
  apiVersion: string;
  kind: string;
  cluster: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  status: {
    ready: boolean;
    conditions: Array<{
      type: string;
      status: string;
      reason?: string;
      message?: string;
      lastTransitionTime?: string;
    }>;
  };
}

/**
 * Query parameters for XR listing
 */
export interface ListXRsRequest {
  apiVersion: string;
  kind: string;
  namespace?: string;
  cluster?: string;
  labelSelector?: string;
}

/**
 * Response from XR listing
 */
export interface ListXRsResponse {
  items: CrossplaneXR[];
}

/**
 * Kubernetes cluster configuration
 */
export interface ClusterConfig {
  name: string;
  url: string;
  authProvider: string;
  serviceAccountToken?: string;
  skipTLSVerify?: boolean;
}
