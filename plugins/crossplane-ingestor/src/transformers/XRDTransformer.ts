/**
 * Main orchestrator for transforming XRDs to Backstage templates
 * Coordinates all transformer classes to produce complete templates
 */

import {
  XRD,
  XRDVersion,
  BackstageTemplate,
  BackstageApiEntity,
  XRDTransformerConfig
} from '../types';
import { CrossplaneDetector } from './CrossplaneDetector';
import { ParameterExtractor } from './ParameterExtractor';
import { StepGeneratorV1 } from './StepGeneratorV1';
import { StepGeneratorV2 } from './StepGeneratorV2';
import { TemplateBuilder } from './TemplateBuilder';
import { ApiEntityBuilder } from './ApiEntityBuilder';

export class XRDTransformer {
  private readonly detector: CrossplaneDetector;
  private readonly parameterExtractor: ParameterExtractor;
  private readonly stepGeneratorV1: StepGeneratorV1;
  private readonly stepGeneratorV2: StepGeneratorV2;
  private readonly templateBuilder: TemplateBuilder;
  private readonly apiEntityBuilder: ApiEntityBuilder;

  constructor(config: XRDTransformerConfig = {}) {
    // Initialize all transformers with their respective configs
    this.detector = new CrossplaneDetector();
    
    this.parameterExtractor = new ParameterExtractor(
      this.detector,
      config.extractorConfig
    );
    
    this.stepGeneratorV1 = new StepGeneratorV1(config.stepGeneratorConfig);
    this.stepGeneratorV2 = new StepGeneratorV2(config.stepGeneratorConfig);
    
    this.templateBuilder = new TemplateBuilder(config.templateBuilderConfig);
    this.apiEntityBuilder = new ApiEntityBuilder();
  }

  /**
   * Transforms an XRD into Backstage entities (Templates and API entities)
   * Returns both template and API entities for each XRD version
   */
  transform(xrd: XRD): Array<BackstageTemplate | BackstageApiEntity> {
    const entities: Array<BackstageTemplate | BackstageApiEntity> = [];
    const crossplaneVersion = this.detector.detect(xrd);

    // Process each XRD version
    for (const version of xrd.spec.versions) {
      // Skip non-served versions
      if (!version.served) {
        continue;
      }

      try {
        // Generate template
        const template = this.transformVersion(xrd, version, crossplaneVersion);
        if (template) {
          entities.push(template);
        }

        // Generate API entity
        const apiEntity = this.apiEntityBuilder.build(xrd, version);
        if (apiEntity) {
          entities.push(apiEntity);
        }
      } catch (error) {
        console.error(`Failed to transform version ${version.name} of ${xrd.metadata.name}:`, error);
        // Continue processing other versions
      }
    }

    return entities;
  }

  /**
   * Transforms an XRD into Backstage templates only
   * Returns one template per XRD version
   */
  transformToTemplates(xrd: XRD): BackstageTemplate[] {
    const templates: BackstageTemplate[] = [];
    const crossplaneVersion = this.detector.detect(xrd);

    // Process each XRD version
    for (const version of xrd.spec.versions) {
      // Skip non-served versions
      if (!version.served) {
        continue;
      }

      try {
        const template = this.transformVersion(xrd, version, crossplaneVersion);
        if (template) {
          templates.push(template);
        }
      } catch (error) {
        console.error(`Failed to transform version ${version.name} of ${xrd.metadata.name}:`, error);
        // Continue processing other versions
      }
    }

    return templates;
  }

  /**
   * Transforms an XRD into Backstage API entities only
   * Returns one API entity per XRD version
   */
  transformToApiEntities(xrd: XRD): BackstageApiEntity[] {
    const apiEntities: BackstageApiEntity[] = [];

    // Process each XRD version
    for (const version of xrd.spec.versions) {
      // Skip non-served versions
      if (!version.served) {
        continue;
      }

      try {
        const apiEntity = this.apiEntityBuilder.build(xrd, version);
        if (apiEntity) {
          apiEntities.push(apiEntity);
        }
      } catch (error) {
        console.error(`Failed to generate API entity for version ${version.name} of ${xrd.metadata.name}:`, error);
        // Continue processing other versions
      }
    }

    return apiEntities;
  }

  /**
   * Transforms a specific XRD version into a Backstage template
   */
  transformVersion(
    xrd: XRD,
    version: XRDVersion,
    crossplaneVersion = this.detector.detect(xrd)
  ): BackstageTemplate | null {
    // Extract parameters from the XRD
    const parameterSections = this.parameterExtractor.extract(xrd, version);
    
    // Generate steps based on Crossplane version
    const stepGenerator = this.selectStepGenerator(crossplaneVersion);
    if (!stepGenerator) {
      console.warn(`No step generator available for Crossplane ${crossplaneVersion.version}`);
      return null;
    }
    
    const steps = stepGenerator.generate(xrd, version, parameterSections);
    
    // Build the final template
    const template = this.templateBuilder.build(xrd, version, parameterSections, steps);
    
    // Validate the template
    const errors = this.templateBuilder.validate(template);
    if (errors.length > 0) {
      console.error(`Template validation failed for ${xrd.metadata.name}:`, errors);
      return null;
    }
    
    // Add version-specific metadata
    this.enrichTemplateMetadata(template, xrd, version, crossplaneVersion);
    
    return template;
  }

  /**
   * Selects the appropriate step generator based on Crossplane version
   */
  private selectStepGenerator(crossplaneVersion: ReturnType<CrossplaneDetector['detect']>) {
    if (crossplaneVersion.version === 'v2') {
      // V2 with LegacyCluster is handled by V1 generator (for compatibility)
      if (crossplaneVersion.scope === 'LegacyCluster') {
        return this.stepGeneratorV1;
      }
      return this.stepGeneratorV2;
    }
    
    // V1 always uses claims
    return this.stepGeneratorV1;
  }

  /**
   * Enriches template metadata with additional information
   */
  private enrichTemplateMetadata(
    template: BackstageTemplate,
    xrd: XRD,
    version: XRDVersion,
    crossplaneVersion: ReturnType<CrossplaneDetector['detect']>
  ): void {
    // Add version suffix if multiple versions exist
    if (xrd.spec.versions.length > 1) {
      template.metadata.name = `${template.metadata.name}-${version.name}`;
      template.metadata.title = `${template.metadata.title} (${version.name})`;
    }
    
    // Add Crossplane version info to annotations
    template.metadata.annotations['crossplane.io/api-version'] = crossplaneVersion.version;
    template.metadata.annotations['crossplane.io/scope'] = crossplaneVersion.scope;
    template.metadata.annotations['crossplane.io/uses-claims'] = String(crossplaneVersion.usesClaims);
    
    // Add version-specific annotations
    if (version.deprecated) {
      template.metadata.annotations['backstage.io/deprecated'] = 'true';
      template.metadata.tags?.push('deprecated');
    }
    
    if (!version.referenceable) {
      template.metadata.annotations['crossplane.io/non-referenceable'] = 'true';
    }
    
    // Add schema availability
    if (version.schema?.openAPIV3Schema) {
      template.metadata.annotations['crossplane.io/has-schema'] = 'true';
    }
  }

  /**
   * Validates if an XRD can be transformed
   */
  canTransform(xrd: XRD): { valid: boolean; reasons: string[] } {
    const reasons: string[] = [];
    
    // Check if XRD has required fields
    if (!xrd.metadata?.name) {
      reasons.push('XRD metadata.name is required');
    }
    
    if (!xrd.spec?.group) {
      reasons.push('XRD spec.group is required');
    }
    
    if (!xrd.spec?.names?.kind) {
      reasons.push('XRD spec.names.kind is required');
    }
    
    if (!xrd.spec?.versions || xrd.spec.versions.length === 0) {
      reasons.push('XRD must have at least one version');
    }
    
    // Check if any version is served
    const hasServedVersion = xrd.spec?.versions?.some(v => v.served);
    if (!hasServedVersion) {
      reasons.push('XRD must have at least one served version');
    }
    
    // Check Crossplane version compatibility
    try {
      const crossplaneVersion = this.detector.detect(xrd);
      
      // Validate step generator compatibility
      if (crossplaneVersion.version === 'v2') {
        if (!this.stepGeneratorV2.isCompatible(xrd) && !this.stepGeneratorV1.isCompatible(xrd)) {
          reasons.push(`No compatible step generator for v2 XRD with scope ${crossplaneVersion.scope}`);
        }
      } else if (crossplaneVersion.version === 'v1') {
        if (!this.stepGeneratorV1.isCompatible(xrd)) {
          reasons.push('V1 XRD is not compatible with step generator');
        }
      } else {
        reasons.push(`Unknown Crossplane version: ${crossplaneVersion.version}`);
      }
    } catch (error) {
      reasons.push(`Failed to detect Crossplane version: ${error}`);
    }
    
    return {
      valid: reasons.length === 0,
      reasons
    };
  }

  /**
   * Gets a summary of what will be generated for an XRD
   */
  preview(xrd: XRD): {
    crossplaneVersion: ReturnType<CrossplaneDetector['detect']>;
    templateCount: number;
    versions: Array<{
      name: string;
      served: boolean;
      deprecated?: boolean;
      hasSchema: boolean;
    }>;
    resourceKind: string;
    requiresNamespace: boolean;
    multiCluster: boolean;
  } {
    const crossplaneVersion = this.detector.detect(xrd);
    const servedVersions = xrd.spec.versions.filter(v => v.served);
    
    return {
      crossplaneVersion,
      templateCount: servedVersions.length,
      versions: xrd.spec.versions.map(v => ({
        name: v.name,
        served: v.served,
        deprecated: v.deprecated,
        hasSchema: !!v.schema?.openAPIV3Schema
      })),
      resourceKind: this.detector.getResourceKind(xrd),
      requiresNamespace: this.detector.needsNamespaceParameter(xrd),
      multiCluster: !!(xrd.clusters && xrd.clusters.length > 1)
    };
  }

  /**
   * Exports the transformer configuration for debugging
   */
  getConfig(): XRDTransformerConfig {
    return {
      extractorConfig: this.parameterExtractor['config'],
      stepGeneratorConfig: this.stepGeneratorV2['config'],
      templateBuilderConfig: this.templateBuilder['config']
    };
  }
}