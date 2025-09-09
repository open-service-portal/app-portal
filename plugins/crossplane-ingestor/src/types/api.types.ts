/**
 * Types for Backstage API entities
 */

/**
 * Backstage API Entity
 * Represents an API definition in the Backstage catalog
 */
export interface BackstageApiEntity {
  apiVersion: 'backstage.io/v1alpha1';
  kind: 'API';
  metadata: {
    namespace?: string;
    name: string;
    title?: string;
    description?: string;
    annotations?: Record<string, string>;
    labels?: Record<string, string>;
    tags?: string[];
    uid?: string;
    etag?: string;
  };
  spec: {
    type: string; // e.g., 'openapi', 'asyncapi', 'graphql', 'grpc'
    lifecycle: string; // e.g., 'production', 'experimental', 'deprecated'
    owner: string;
    system?: string;
    definition: string; // The actual API definition (e.g., OpenAPI spec)
  };
  relations?: Array<{
    type: string;
    targetRef: string;
  }>;
}

/**
 * OpenAPI specification components
 */
export interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  servers?: Array<{
    url: string;
    description?: string;
  }>;
  tags?: Array<{
    name: string;
    description?: string;
  }>;
  paths: Record<string, any>;
  components?: {
    schemas?: Record<string, any>;
    securitySchemes?: Record<string, any>;
  };
  security?: Array<Record<string, string[]>>;
}