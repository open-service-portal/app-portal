/**
 * Generates Backstage scaffolder steps for Crossplane v1 XRDs
 * V1 always uses claims (namespaced resources)
 */

import {
  XRD,
  XRDVersion,
  BackstageTemplateStep,
  StepGeneratorConfig,
  ParameterSection
} from '../types';

export class StepGeneratorV1 {
  constructor(
    private readonly config: StepGeneratorConfig = {}
  ) {}

  /**
   * Generates all scaffolder steps for a v1 XRD template
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

    // Add claim creation step (v1 always uses claims)
    steps.push(this.generateClaimStep(xrd, version));

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
          owner: '${{ parameters.owner }}',
          namespace: '${{ parameters.namespace }}'
        }
      }
    };
  }

  /**
   * Generates the claim creation step for v1
   */
  private generateClaimStep(
    xrd: XRD,
    version: XRDVersion
  ): BackstageTemplateStep {
    // V1 always uses claims if defined, otherwise falls back to XR
    const claimKind = xrd.spec.claimNames?.kind || xrd.spec.names.kind;
    const claimPlural = xrd.spec.claimNames?.plural || xrd.spec.names.plural;

    // Build the claim manifest
    const manifest = this.buildClaimManifest(xrd, version, claimKind);

    const step: BackstageTemplateStep = {
      id: 'create-claim',
      name: `Create ${claimKind}`,
      action: this.config.customActions?.createResource || 'kubernetes:apply',
      input: {
        manifest: manifest,
        namespace: '${{ parameters.namespace }}' // Claims always need namespace
      }
    };

    // Add cluster parameter if multiple clusters
    if (xrd.clusters && xrd.clusters.length > 1) {
      step.input.cluster = '${{ parameters.cluster }}';
    }

    return step;
  }

  /**
   * Builds the claim manifest for v1
   */
  private buildClaimManifest(
    xrd: XRD,
    version: XRDVersion,
    claimKind: string
  ): any {
    const apiVersion = `${xrd.spec.group}/${version.name}`;
    
    const manifest: any = {
      apiVersion,
      kind: claimKind,
      metadata: {
        name: '${{ parameters.xrName }}',
        namespace: '${{ parameters.namespace }}', // Claims are always namespaced
        labels: {
          'app.kubernetes.io/managed-by': 'backstage',
          'backstage.io/owner': '${{ parameters.owner }}',
          'crossplane.io/claim-name': '${{ parameters.xrName }}'
        },
        annotations: {
          'backstage.io/created-by': '${{ user.entity.metadata.name }}',
          'backstage.io/template': '${{ template.metadata.name }}',
          'backstage.io/created-at': new Date().toISOString()
        }
      },
      spec: {}
    };

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

    // Add composition reference for v1 (uses refs, not selectors)
    if (xrd.spec.defaultCompositionRef) {
      manifest.spec.compositionRef = {
        name: xrd.spec.defaultCompositionRef.name
      };
    }

    // Add write connection secret reference if configured
    if (this.config.connectionSecretName) {
      manifest.spec.writeConnectionSecretToRef = {
        name: this.config.connectionSecretName || '${{ parameters.xrName }}-connection',
        namespace: '${{ parameters.namespace }}'
      };
    }

    return manifest;
  }

  /**
   * Generates publishing steps for GitOps workflow
   */
  private generatePublishingSteps(xrd: XRD): BackstageTemplateStep[] {
    const steps: BackstageTemplateStep[] = [];
    const publishConfig = this.config.publishPhase!;
    const claimKind = xrd.spec.claimNames?.kind || xrd.spec.names.kind;

    // Generate manifest file
    steps.push({
      id: 'generate-manifest',
      name: 'Generate Claim Manifest',
      action: 'fetch:plain',
      input: {
        targetPath: './claim-${{ parameters.xrName }}.yaml',
        content: this.generateManifestTemplate()
      }
    });

    // Git publish step
    if (publishConfig.git) {
      const gitStep: BackstageTemplateStep = {
        id: 'publish-git',
        name: 'Publish Claim to Git',
        action: 'publish:github:pull-request',
        input: {
          repoUrl: '${{ parameters.repoUrl }}',
          title: `Create ${claimKind}: \${{ parameters.xrName }}`,
          description: `This PR creates a new ${claimKind} claim instance via GitOps`,
          branchName: 'create-claim-${{ parameters.xrName }}',
          gitCommitMessage: 'feat: add claim ${{ parameters.xrName }}',
          gitAuthorName: '${{ user.entity.metadata.name }}',
          gitAuthorEmail: '${{ user.entity.spec.profile.email }}',
          targetBranch: publishConfig.git.targetBranch || '${{ parameters.gitBranch }}',
          targetPath: publishConfig.git.targetPath || 'namespaced/${{ parameters.namespace }}'
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
   * Generates the manifest template for claim publishing
   */
  private generateManifestTemplate(): string {
    return `---
# Generated by Backstage for Crossplane v1 Claim
apiVersion: \${{ values.apiVersion }}
kind: \${{ values.kind }}
metadata:
  name: \${{ values.name }}
  namespace: \${{ values.namespace }}
  labels:
    app.kubernetes.io/managed-by: backstage
    backstage.io/owner: \${{ values.owner }}
    crossplane.io/claim-name: \${{ values.name }}
  annotations:
    backstage.io/created-by: \${{ values.createdBy }}
    backstage.io/template: \${{ values.template }}
spec:
  {{#if values.compositionRef}}
  compositionRef:
    name: \${{ values.compositionRef }}
  {{/if}}
  {{#if values.writeConnectionSecretToRef}}
  writeConnectionSecretToRef:
    name: \${{ values.name }}-connection
    namespace: \${{ values.namespace }}
  {{/if}}
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
   * Checks if XRD is compatible with v1 generator
   */
  isCompatible(xrd: XRD): boolean {
    // Check if it's a v1 API version
    if (xrd.apiVersion.includes('/v1') && !xrd.apiVersion.includes('/v2')) {
      return true;
    }

    // Also handle v2 XRDs in LegacyCluster mode (v1 compatibility)
    // Note: LegacyCluster is a special case that we handle separately
    if (xrd.apiVersion.includes('/v2') && (xrd.spec as any).scope === 'LegacyCluster') {
      return true;
    }

    return false;
  }
}