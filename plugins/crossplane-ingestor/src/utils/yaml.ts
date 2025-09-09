/**
 * YAML processing utilities
 */

import * as yaml from 'js-yaml';

/**
 * Safely parses YAML content
 */
export function parseYaml<T = any>(content: string): T | null {
  try {
    return yaml.load(content) as T;
  } catch (error) {
    console.error('Failed to parse YAML:', error);
    return null;
  }
}

/**
 * Safely parses multiple YAML documents
 */
export function parseYamlDocuments<T = any>(content: string): T[] {
  try {
    const docs: T[] = [];
    yaml.loadAll(content, (doc) => {
      if (doc) {
        docs.push(doc as T);
      }
    });
    return docs;
  } catch (error) {
    console.error('Failed to parse YAML documents:', error);
    return [];
  }
}

/**
 * Converts object to YAML string
 */
export function toYaml(obj: any, options?: yaml.DumpOptions): string {
  return yaml.dump(obj, {
    lineWidth: -1,
    noRefs: true,
    sortKeys: false,
    ...options
  });
}

/**
 * Converts multiple objects to YAML documents
 */
export function toYamlDocuments(objs: any[], options?: yaml.DumpOptions): string {
  return objs
    .map(obj => toYaml(obj, options))
    .join('---\n');
}

/**
 * Validates if string is valid YAML
 */
export function isValidYaml(content: string): boolean {
  try {
    yaml.load(content);
    return true;
  } catch {
    return false;
  }
}

/**
 * Extracts metadata from a Kubernetes resource YAML
 */
export function extractMetadata(yamlContent: string): {
  apiVersion?: string;
  kind?: string;
  name?: string;
  namespace?: string;
} | null {
  const doc = parseYaml(yamlContent);
  if (!doc || typeof doc !== 'object') {
    return null;
  }
  
  const resource = doc as any;
  return {
    apiVersion: resource.apiVersion,
    kind: resource.kind,
    name: resource.metadata?.name,
    namespace: resource.metadata?.namespace
  };
}

/**
 * Merges YAML content preserving comments
 */
export function mergeYaml(base: string, override: string): string {
  const baseObj = parseYaml(base);
  const overrideObj = parseYaml(override);
  
  if (!baseObj || !overrideObj) {
    return base;
  }
  
  const merged = deepMerge(baseObj, overrideObj);
  return toYaml(merged);
}

/**
 * Deep merges two objects
 */
function deepMerge(target: any, source: any): any {
  if (!source || typeof source !== 'object') {
    return source;
  }
  
  if (!target || typeof target !== 'object') {
    return source;
  }
  
  if (Array.isArray(source)) {
    return source;
  }
  
  const result = { ...target };
  
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  
  return result;
}