/**
 * XRD (Composite Resource Definition) related types
 */

export interface XRD {
  apiVersion: string;
  kind: 'CompositeResourceDefinition';
  metadata: XRDMetadata;
  spec: XRDSpec;
  status?: XRDStatus;
  // Additional properties from cluster
  clusterName?: string;
  clusterEndpoint?: string;
  clusters?: string[];
  clusterDetails?: ClusterDetail[];
  compositions?: string[];
  crossplaneVersion?: string;
  scope?: string;
  generatedCRD?: any;
  effectiveCompositeType?: {
    kind: string;
    apiVersion: string;
  };
}

export interface XRDMetadata {
  name: string;
  namespace?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  uid?: string;
  resourceVersion?: string;
  generation?: number;
}

export interface XRDSpec {
  group: string;
  names: {
    kind: string;
    plural: string;
    singular?: string;
    listKind?: string;
  };
  claimNames?: {
    kind: string;
    plural: string;
    singular?: string;
  };
  scope?: 'Cluster' | 'Namespaced';
  versions: XRDVersion[];
  connectionSecretKeys?: string[];
  defaultCompositionRef?: {
    name: string;
  };
}

export interface XRDVersion {
  name: string;
  served: boolean;
  referenceable: boolean;
  deprecated?: boolean;
  schema?: {
    openAPIV3Schema?: OpenAPIV3Schema;
  };
  additionalPrinterColumns?: PrinterColumn[];
}

export interface OpenAPIV3Schema {
  type?: string;
  properties?: Record<string, any>;
  required?: string[];
  description?: string;
  default?: any;
  enum?: any[];
  items?: any;
  additionalProperties?: boolean | any;
  // String validation
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  // Number validation
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  multipleOf?: number;
  // Array validation
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  // Object validation
  minProperties?: number;
  maxProperties?: number;
}

export interface PrinterColumn {
  name: string;
  type: string;
  jsonPath: string;
  description?: string;
  priority?: number;
}

export interface XRDStatus {
  conditions?: Condition[];
  controllers?: {
    compositeResourceType?: {
      apiVersion: string;
      kind: string;
    };
  };
}

export interface Condition {
  type: string;
  status: 'True' | 'False' | 'Unknown';
  lastTransitionTime: string;
  reason?: string;
  message?: string;
}

export interface ClusterDetail {
  name: string;
  url: string;
}

export interface CrossplaneVersion {
  version: 'v1' | 'v2';
  scope: 'Cluster' | 'Namespaced' | 'LegacyCluster';
  usesClaims: boolean;
}