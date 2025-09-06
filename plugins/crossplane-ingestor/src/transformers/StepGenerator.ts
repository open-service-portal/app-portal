/**
 * Generates Backstage scaffolder steps from XRD configuration
 */

import {
  XRD,
  XRDVersion,
  BackstageTemplateStep,
  StepGeneratorConfig,
  CrossplaneVersion,
  ParameterSection
} from '../types';
import { CrossplaneDetector } from './CrossplaneDetector';

export class StepGenerator {
  constructor(
    private readonly detector: CrossplaneDetector,
    private readonly config: StepGeneratorConfig = {}
  ) {}

  /**
   * Generates all scaffolder steps for the template
   */
  generate(
    xrd: XRD,
    version: XRDVersion,
    parameterSections: ParameterSection[]
  ): BackstageTemplateStep[] {
    const crossplaneVersion = this.detector.detect(xrd);
    const steps: BackstageTemplateStep[] = [];

    // Add fetch step if configured
    if (this.config.includeFetch) {
      steps.push(this.generateFetchStep());
    }

    // Add resource creation step
    steps.push(this.generateResourceStep(xrd, version, crossplaneVersion));

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
   * Generates the resource creation step
   */
  private generateResourceStep(
    xrd: XRD,
    version: XRDVersion,
    crossplaneVersion: CrossplaneVersion
  ): BackstageTemplateStep {
    const resourceKind = this.detector.getResourceKind(xrd);
    const resourcePlural = this.detector.getResourcePlural(xrd);
    const needsNamespace = this.detector.needsNamespaceParameter(xrd);

    // Build the manifest for the resource
    const manifest = this.buildResourceManifest(
      xrd,
      version,
      resourceKind,
      crossplaneVersion,
      needsNamespace
    );

    const step: BackstageTemplateStep = {
      id: 'create-resource',
      name: `Create ${resourceKind}`,
      action: this.config.customActions?.createResource || 'kubernetes:create',
      input: {
        manifest: manifest
      }
    };

    // Add cluster parameter if multiple clusters
    if (xrd.clusters && xrd.clusters.length > 1) {
      step.input.cluster = '${{ parameters.cluster }}';
    }

    // Add namespace if needed
    if (needsNamespace) {
      step.input.namespace = '${{ parameters.namespace }}';
    }

    return step;
  }

  /**
   * Builds the resource manifest
   */
  private buildResourceManifest(
    xrd: XRD,
    version: XRDVersion,
    resourceKind: string,
    crossplaneVersion: CrossplaneVersion,
    needsNamespace: boolean
  ): any {
    const apiVersion = this.getApiVersion(xrd, crossplaneVersion);
    
    const manifest: any = {
      apiVersion,
      kind: resourceKind,
      metadata: {
        name: '${{ parameters.xrName }}'
      },
      spec: {}
    };

    // Add namespace to metadata if needed
    if (needsNamespace) {
      manifest.metadata.namespace = '${{ parameters.namespace }}';
    }

    // Add labels
    manifest.metadata.labels = {
      'app.kubernetes.io/managed-by': 'backstage',
      'backstage.io/owner': '${{ parameters.owner }}'
    };

    // Add annotations
    manifest.metadata.annotations = {
      'backstage.io/created-by': '${{ user.entity.metadata.name }}',
      'backstage.io/template': '${{ template.metadata.name }}'
    };

    // Map parameters to spec fields
    if (version.schema?.openAPIV3Schema?.properties?.spec) {
      const specProperties = version.schema.openAPIV3Schema.properties.spec.properties || {};
      
      for (const [key, schema] of Object.entries(specProperties)) {
        // Add parameter reference for each field
        manifest.spec[key] = `\${{ parameters.${key} }}`;
      }
    }

    // Handle composition selector for v1 XRDs
    if (crossplaneVersion.version === 'v1' && xrd.spec.defaultCompositionRef) {
      manifest.spec.compositionRef = {
        name: xrd.spec.defaultCompositionRef.name
      };
    }

    // Handle composition selector for v2 XRDs
    if (crossplaneVersion.version === 'v2' && xrd.spec.defaultCompositionRef) {
      manifest.spec.compositionSelector = {
        matchLabels: {
          'crossplane.io/xrd': xrd.metadata.name
        }
      };
    }

    return manifest;
  }

  /**
   * Gets the API version for the resource
   */
  private getApiVersion(xrd: XRD, crossplaneVersion: CrossplaneVersion): string {
    // For claims (v1 or v2 LegacyCluster), use the claim group
    if (crossplaneVersion.usesClaims && xrd.spec.claimNames) {
      return `${xrd.spec.group}/${xrd.spec.versions[0].name}`;
    }
    
    // For direct XRs (v2), use the XR group
    return `${xrd.spec.group}/${xrd.spec.versions[0].name}`;
  }

  /**
   * Generates publishing steps for GitOps workflow
   */
  private generatePublishingSteps(xrd: XRD): BackstageTemplateStep[] {
    const steps: BackstageTemplateStep[] = [];
    const publishConfig = this.config.publishPhase!;

    // Generate manifest step
    steps.push({
      id: 'generate-manifest',
      name: 'Generate Manifest',
      action: 'fetch:plain',
      input: {
        targetPath: './manifest.yaml',
        content: this.generateManifestTemplate(xrd)
      }
    });

    // Git publish step
    if (publishConfig.git) {
      steps.push({
        id: 'publish-git',
        name: 'Publish to Git',
        action: 'publish:github:pull-request',
        input: {
          repoUrl: '${{ parameters.repoUrl }}',
          title: 'Create ${{ parameters.xrName }}',
          description: 'This PR creates a new resource instance',
          branchName: 'create-${{ parameters.xrName }}',
          gitCommitMessage: 'feat: add ${{ parameters.xrName }} resource',
          gitAuthorName: '${{ user.entity.metadata.name }}',
          gitAuthorEmail: '${{ user.entity.spec.profile.email }}',
          targetBranch: '${{ parameters.gitBranch }}',
          createPr: '${{ parameters.createPr }}'
        }
      });
    }

    // ArgoCD sync step
    if (publishConfig.argocd) {
      steps.push({
        id: 'sync-argocd',
        name: 'Sync ArgoCD',
        action: 'argocd:sync',
        input: {
          application: publishConfig.argocd.application,
          revision: '${{ parameters.gitBranch }}'
        }
      });
    }

    return steps;
  }

  /**
   * Generates the manifest template for publishing
   */
  private generateManifestTemplate(xrd: XRD): string {
    // This would typically be a more complex template
    // For now, returning a simple placeholder
    return `---
# Generated by Backstage
apiVersion: $\{{ values.apiVersion }}
kind: $\{{ values.kind }}
metadata:
  name: $\{{ values.name }}
  namespace: $\{{ values.namespace }}
spec:
  $\{{ values.spec | dump }}
`;
  }

  /**
   * Generates the catalog registration step
   */
  private generateRegisterStep(): BackstageTemplateStep {
    return {
      id: 'register',
      name: 'Register in Catalog',
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

    if (this.config.publishPhase?.argocd && !this.config.publishPhase.argocd.application) {
      errors.push('ArgoCD sync is configured but application name is missing');
    }

    return errors;
  }
}