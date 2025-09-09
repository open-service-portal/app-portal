/**
 * Configuration related types
 */

// Config type from @backstage/config - removed as it's not used in this file

export interface IngestorConfig {
  annotationPrefix?: string;
  components?: ComponentConfig;
  crossplane?: CrossplaneConfig;
  genericCRDTemplates?: GenericCRDConfig;
  allowedClusterNames?: string[];
}

export interface ComponentConfig {
  enabled?: boolean;
  taskRunner?: {
    frequency?: number;
    timeout?: number;
  };
  excludedNamespaces?: string[];
}

export interface CrossplaneConfig {
  enabled?: boolean;
  claims?: {
    ingestAllClaims?: boolean;
  };
  xrds?: {
    enabled?: boolean;
    ingestAllXRDs?: boolean;
    taskRunner?: {
      frequency?: number;
      timeout?: number;
    };
    convertDefaultValuesToPlaceholders?: boolean;
    allowedTargets?: string[];
    publishPhase?: PublishPhaseConfig;
  };
}

export interface PublishPhaseConfig {
  target?: string;
  enabled?: boolean;
  git?: {
    repoUrl: string;
    targetBranch?: string;
    targetPath?: string;
    createPR?: boolean;
  };
  flux?: {
    kustomization: string;
    namespace?: string;
  };
  argocd?: {
    application: string;
    namespace?: string;
  };
  allowRepoSelection?: boolean;
}

export interface GenericCRDConfig {
  publishPhase?: PublishPhaseConfig;
  crdLabelSelector?: {
    key: string;
    value: string;
  };
  crds?: string[];
}

export interface ExtractorConfig {
  includePublishing?: boolean;
  convertDefaultValuesToPlaceholders?: boolean;
  allowedTargets?: string[];
  annotationPrefix?: string;
  publishPhase?: PublishPhaseConfig;
}

export interface GeneratorConfig {
  includePublishing?: boolean;
  publishPhase?: PublishPhaseConfig;
}

export interface TransformerConfig {
  annotationPrefix?: string;
  convertDefaultValuesToPlaceholders?: boolean;
  publishPhase?: PublishPhaseConfig;
  allowedTargets?: string[];
}

// Step generator configuration
export interface StepGeneratorConfig {
  includeFetch?: boolean;
  includeRegister?: boolean;
  includePublishing?: boolean;
  publishPhase?: PublishPhaseConfig;
  customActions?: {
    createResource?: string;
    fetchTemplate?: string;
    publishGit?: string;
  };
  connectionSecretName?: string;
  resourceConfig?: any;
}

// Template builder configuration
export interface TemplateBuilderConfig {
  templateType?: string;
  owner?: string;
  namePrefix?: string;
  nameSuffix?: string;
  additionalTags?: string[];
  additionalAnnotations?: Record<string, string>;
  additionalLinks?: Array<{ url: string; title: string; icon?: string }>;
  additionalOutputText?: string[];
  kubernetesUIEnabled?: boolean;
  publishingEnabled?: boolean;
  catalogRegistrationEnabled?: boolean;
}

// XRD transformer configuration
export interface XRDTransformerConfig {
  extractorConfig?: ExtractorConfig;
  stepGeneratorConfig?: StepGeneratorConfig;
  templateBuilderConfig?: TemplateBuilderConfig;
}