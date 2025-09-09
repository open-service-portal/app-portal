/**
 * Backstage Template related types
 */

export interface BackstageTemplate {
  apiVersion: 'scaffolder.backstage.io/v1beta3';
  kind: 'Template';
  metadata: TemplateMetadata;
  spec: TemplateSpec;
}

export interface TemplateMetadata {
  name: string;
  title: string;
  description?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  tags?: string[];
  links?: BackstageLink[];
}

export interface BackstageLink {
  url: string;
  title: string;
  icon?: string;
  [key: string]: string | undefined;
}

export interface TemplateSpec {
  type: string;
  owner?: string;
  parameters: ParameterSection[];
  steps: StepDefinition[];
  output?: TemplateOutput;
}

export interface ParameterSection {
  title: string;
  description?: string;
  required?: string[];
  properties: Record<string, ParameterProperty>;
  dependencies?: Record<string, any>;
}

export interface ParameterProperty {
  title: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description?: string;
  default?: any;
  enum?: any[];
  enumNames?: string[];
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  ui?: {
    widget?: string;
    placeholder?: string;
    help?: string;
    autofocus?: boolean;
    disabled?: boolean;
    readonly?: boolean;
    'ui:options'?: Record<string, any>;
  };
}

export interface StepDefinition {
  id: string;
  name: string;
  action: string;
  input?: Record<string, any>;
  if?: string;
}

export interface TemplateOutput {
  links?: OutputLink[];
  text?: string | string[];  // Can be a single string or array (Backstage now prefers single string)
}

export interface OutputLink {
  title: string;
  url: string;
  icon?: string;
  if?: string;
}

// Aliases for backward compatibility
export type BackstageTemplateStep = StepDefinition;