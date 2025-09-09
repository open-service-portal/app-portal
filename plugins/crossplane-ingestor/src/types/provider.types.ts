/**
 * Provider interface types
 */

import { Entity } from '@backstage/catalog-model';
import { 
  LoggerService, 
  DiscoveryService, 
  HttpAuthService, 
  AuthService 
} from '@backstage/backend-plugin-api';
import { CatalogApi } from '@backstage/catalog-client';
import { PermissionEvaluator } from '@backstage/plugin-permission-common';
import { Config } from '@backstage/config';

export interface DataProviderDependencies {
  logger: LoggerService;
  config: Config;
  catalogApi: CatalogApi;
  discovery: DiscoveryService;
  permissions: PermissionEvaluator;
  auth?: AuthService;
  httpAuth?: HttpAuthService;
}

export interface EntityProviderDependencies extends DataProviderDependencies {
  // Additional dependencies specific to entity providers
}

export interface ObjectToFetch {
  group: string;
  apiVersion: string;
  plural: string;
  objectType: string;
}

export interface KubernetesObject {
  apiVersion: string;
  kind: string;
  metadata: {
    name: string;
    namespace?: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
    uid?: string;
    resourceVersion?: string;
  };
  spec?: any;
  status?: any;
}

export interface ClusterDetails {
  name: string;
  url: string;
  authMetadata?: Record<string, string>;
}

export interface FetchResponse {
  responses: {
    resources: any[];
    errors?: any[];
  }[];
}

export interface TransformResult {
  entities: Entity[];
  errors?: Error[];
}