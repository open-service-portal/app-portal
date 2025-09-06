/**
 * Generates Backstage scaffolder steps for Crossplane v2 XRDs
 * V2 uses direct XRs (no claims) with Cluster or Namespaced scope
 */

import {
  XRD,
  XRDVersion,
  BackstageTemplateStep,
  StepGeneratorConfig,
  ParameterSection
} from '../types';

export class StepGeneratorV2 {
  constructor(
    private readonly config: StepGeneratorConfig = {}
  ) {}

  /**
   * Generates all scaffolder steps for a v2 XRD template
   */
  generate(
    xrd: XRD,
    version: XRDVersion,
    parameterSections: ParameterSection[]
  ): BackstageTemplateStep[] {
    const steps: BackstageTemplateStep[] = [];

    // Add fetch step if configured
    if (this.config.includeFetch) {
      steps.push(this.generateFetchStep());
    }

    // Add XR creation step (direct XR, not claim)
    steps.push(this.generateXRStep(xrd, version));

    // Add publishing steps if configured
    if (this.config.includePublishing && this.config.publishPhase) {
      steps.push(...this.generatePublishingSteps(xrd));
    }

    // Add register step if configured
    if (this.config.includeRegister) {
      steps.push(this.generateRegisterStep());
    }

    return steps;
  }

  /**
   * Generates the fetch step for template content
   */
  private generateFetchStep(): BackstageTemplateStep {
    return {
      id: 'fetch',
      name: 'Fetch Content',
      action: 'fetch:template',
      input: {
        url: './content',
        values: {
          name: '${{ parameters.xrName }}',
          owner: '${{ parameters.owner }}'
        }
      }
    };
  }

  /**
   * Generates the XR creation step for v2
   */
  private generateXRStep(
    xrd: XRD,
    version: XRDVersion
  ): BackstageTemplateStep {
    const xrKind = xrd.spec.names.kind;
    const isNamespaced = xrd.spec.scope === 'Namespaced';

    // Build the XR manifest
    const manifest = this.buildXRManifest(xrd, version, isNamespaced);

    const step: BackstageTemplateStep = {
      id: 'create-xr',
      name: `Create ${xrKind} XR`,
      action: this.config.customActions?.createResource || 'kubernetes:apply',
      input: {
        manifest: manifest
      }
    };

    // Add cluster parameter if multiple clusters
    if (xrd.clusters && xrd.clusters.length > 1) {
      step.input.cluster = '${{ parameters.cluster }}';
    }

    // Add namespace for Namespaced XRs
    if (isNamespaced) {
      step.input.namespace = '${{ parameters.namespace }}';
    }

    return step;
  }

  /**
   * Builds the XR manifest for v2
   */
  private buildXRManifest(
    xrd: XRD,
    version: XRDVersion,
    isNamespaced: boolean
  ): any {
    const apiVersion = `${xrd.spec.group}/${version.name}`;
    
    const manifest: any = {
      apiVersion,
      kind: xrd.spec.names.kind,
      metadata: {
        name: '${{ parameters.xrName }}',
        labels: {
          'app.kubernetes.io/managed-by': 'backstage',
          'backstage.io/owner': '${{ parameters.owner }}',
          'crossplane.io/xrd': xrd.metadata.name
        },
        annotations: {
          'backstage.io/created-by': '${{ user.entity.metadata.name }}',
          'backstage.io/template': '${{ template.metadata.name }}',
          'backstage.io/created-at': new Date().toISOString()
        }
      },
      spec: {}
    };

    // Add namespace only for Namespaced scope
    if (isNamespaced) {
      manifest.metadata.namespace = '${{ parameters.namespace }}';
    }

    // Map parameters to spec fields from OpenAPI schema
    if (version.schema?.openAPIV3Schema?.properties?.spec) {
      const specProperties = version.schema.openAPIV3Schema.properties.spec.properties || {};
      
      for (const [key, schema] of Object.entries(specProperties)) {
        // Handle nested objects
        const schemaObj = schema as any;
        if (schemaObj.type === 'object' && schemaObj.properties) {
          // For nested objects, create the structure
          manifest.spec[key] = {};
          for (const [nestedKey] of Object.entries(schemaObj.properties)) {
            manifest.spec[key][nestedKey] = `\${{ parameters.${key}_${nestedKey} }}`;
          }
        } else {
          // For simple fields, add parameter reference
          manifest.spec[key] = `\${{ parameters.${key} }}`;
        }
      }
    }

    // Add composition selector for v2 (uses labels, not refs)
    if (xrd.spec.defaultCompositionRef) {
      manifest.spec.compositionSelector = {
        matchLabels: {
          'crossplane.io/xrd': xrd.metadata.name,
          'crossplane.io/composition': xrd.spec.defaultCompositionRef.name
        }
      };
    } else {
      // Default selector using XRD name only
      manifest.spec.compositionSelector = {
        matchLabels: {
          'crossplane.io/xrd': xrd.metadata.name
        }
      };
    }

    // Add resource configuration if present
    if (this.config.resourceConfig) {
      manifest.spec.resourceConfig = this.config.resourceConfig;
    }

    return manifest;
  }

  /**
   * Generates publishing steps for GitOps workflow
   */
  private generatePublishingSteps(xrd: XRD): BackstageTemplateStep[] {
    const steps: BackstageTemplateStep[] = [];
    const publishConfig = this.config.publishPhase!;

    // Generate manifest file
    steps.push({
      id: 'generate-manifest',
      name: 'Generate XR Manifest',
      action: 'fetch:plain',
      input: {
        targetPath: './xr-${{ parameters.xrName }}.yaml',
        content: this.generateManifestTemplate()
      }
    });

    // Git publish step
    if (publishConfig.git) {
      const gitStep: BackstageTemplateStep = {
        id: 'publish-git',
        name: 'Publish XR to Git',
        action: 'publish:github:pull-request',
        input: {
          repoUrl: '${{ parameters.repoUrl }}',
          title: `Create ${xrd.spec.names.kind} XR: \${{ parameters.xrName }}`,
          description: `This PR creates a new ${xrd.spec.names.kind} XR instance via GitOps`,
          branchName: 'create-xr-${{ parameters.xrName }}',
          gitCommitMessage: 'feat: add XR ${{ parameters.xrName }}',
          gitAuthorName: '${{ user.entity.metadata.name }}',
          gitAuthorEmail: '${{ user.entity.spec.profile.email }}',
          targetBranch: publishConfig.git.targetBranch || '${{ parameters.gitBranch }}',
          targetPath: publishConfig.git.targetPath || xrd.spec.scope?.toLowerCase() || 'cluster'
        }
      };

      // Add PR creation flag if specified
      if (publishConfig.git.createPR !== undefined) {
        gitStep.input.createPr = publishConfig.git.createPR;
      } else {
        gitStep.input.createPr = '${{ parameters.createPr }}';
      }

      steps.push(gitStep);
    }

    // Flux reconcile step
    if (publishConfig.flux) {
      steps.push({
        id: 'reconcile-flux',
        name: 'Trigger Flux Reconciliation',
        action: 'flux:reconcile',
        input: {
          kustomization: publishConfig.flux.kustomization || 'catalog-orders',
          namespace: publishConfig.flux.namespace || 'flux-system',
          wait: true
        }
      });
    }

    // ArgoCD sync step
    if (publishConfig.argocd) {
      steps.push({
        id: 'sync-argocd',
        name: 'Sync ArgoCD Application',
        action: 'argocd:sync',
        input: {
          application: publishConfig.argocd.application,
          namespace: publishConfig.argocd.namespace || 'argocd',
          revision: '${{ parameters.gitBranch }}',
          prune: false
        }
      });
    }

    return steps;
  }

  /**
   * Generates the manifest template for XR publishing
   */
  private generateManifestTemplate(): string {
    return `---
# Generated by Backstage for Crossplane v2 XR
# Direct XR (no claim needed)
apiVersion: \${{ values.apiVersion }}
kind: \${{ values.kind }}
metadata:
  name: \${{ values.name }}
  {{#if values.namespace}}
  namespace: \${{ values.namespace }}
  {{/if}}
  labels:
    app.kubernetes.io/managed-by: backstage
    backstage.io/owner: \${{ values.owner }}
    crossplane.io/xrd: \${{ values.xrdName }}
  annotations:
    backstage.io/created-by: \${{ values.createdBy }}
    backstage.io/template: \${{ values.template }}
spec:
  compositionSelector:
    matchLabels:
      crossplane.io/xrd: \${{ values.xrdName }}
  {{#each values.spec}}
  {{@key}}: {{this}}
  {{/each}}
`;
  }

  /**
   * Generates the catalog registration step
   */
  private generateRegisterStep(): BackstageTemplateStep {
    return {
      id: 'register',
      name: 'Register in Software Catalog',
      action: 'catalog:register',
      input: {
        repoContentsUrl: '${{ steps["publish-git"].output.repoContentsUrl }}',
        catalogInfoPath: '/catalog-info.yaml'
      }
    };
  }

  /**
   * Validates that required config is present for steps
   */
  validateConfig(): string[] {
    const errors: string[] = [];

    if (this.config.includePublishing && !this.config.publishPhase) {
      errors.push('Publishing is enabled but publishPhase config is missing');
    }

    if (this.config.publishPhase?.git && !this.config.publishPhase.git.repoUrl) {
      errors.push('Git publishing is configured but repoUrl is missing');
    }

    if (this.config.publishPhase?.flux && !this.config.publishPhase.flux.kustomization) {
      errors.push('Flux reconciliation is configured but kustomization is missing');
    }

    if (this.config.publishPhase?.argocd && !this.config.publishPhase.argocd.application) {
      errors.push('ArgoCD sync is configured but application name is missing');
    }

    return errors;
  }

  /**
   * Checks if XRD is compatible with v2 generator
   */
  isCompatible(xrd: XRD): boolean {
    // Must be v2 API version
    if (!xrd.apiVersion.includes('/v2')) {
      return false;
    }

    // Must have explicit scope (v2 requirement)
    if (!xrd.spec.scope) {
      return false;
    }

    // Scope must be either Cluster or Namespaced
    if (!['Cluster', 'Namespaced'].includes(xrd.spec.scope)) {
      return false;
    }

    // Should not use claims (v2 uses direct XRs)
    // Note: LegacyCluster is a special case for v1 compatibility
    if ((xrd.spec as any).scope === 'LegacyCluster') {
      return false;
    }

    return true;
  }
}