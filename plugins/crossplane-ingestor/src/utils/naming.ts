/**
 * Utility functions for entity naming and validation
 */

/**
 * Validates an entity name according to Backstage requirements
 */
export function validateEntityName(name: string): boolean {
  // Entity names must be lowercase alphanumeric with hyphens
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(name);
}

/**
 * Sanitizes a name to be valid for Backstage entities
 */
export function sanitizeEntityName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Generates a template name from an XRD name
 */
export function generateTemplateName(xrdName: string, version?: string): string {
  const baseName = xrdName.split('.')[0]; // Get first part before domain
  const sanitized = sanitizeEntityName(baseName);
  
  if (version) {
    return `${sanitized}-${sanitizeEntityName(version)}`;
  }
  
  return sanitized;
}

/**
 * Generates a unique entity name with timestamp
 */
export function generateUniqueEntityName(baseName: string): string {
  const timestamp = Date.now().toString(36);
  const sanitized = sanitizeEntityName(baseName);
  return `${sanitized}-${timestamp}`;
}

/**
 * Converts a Kubernetes resource name to Backstage entity format
 */
export function kubernetesToBackstageName(k8sName: string): string {
  // Replace dots with hyphens (common in CRD names)
  return sanitizeEntityName(k8sName.replace(/\./g, '-'));
}

/**
 * Extracts namespace from a fully qualified resource name
 */
export function extractNamespace(resourceName: string): string | undefined {
  const parts = resourceName.split('/');
  if (parts.length === 2) {
    return parts[0];
  }
  return undefined;
}

/**
 * Creates a fully qualified Backstage entity ref
 */
export function createEntityRef(
  kind: string,
  namespace: string,
  name: string
): string {
  return `${kind.toLowerCase()}:${namespace}/${name}`;
}

/**
 * Parses a Backstage entity ref
 */
export function parseEntityRef(ref: string): {
  kind: string;
  namespace: string;
  name: string;
} | null {
  const match = ref.match(/^([^:]+):([^/]+)\/(.+)$/);
  if (!match) {
    return null;
  }
  
  return {
    kind: match[1],
    namespace: match[2],
    name: match[3]
  };
}