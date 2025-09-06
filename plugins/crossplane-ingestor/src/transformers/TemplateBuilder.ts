/**
 * Builds complete Backstage templates from XRD components
 */

import {
  XRD,
  XRDVersion,
  BackstageTemplate,
  BackstageTemplateStep,
  ParameterSection,
  TemplateBuilderConfig
} from '../types';

export class TemplateBuilder {
  constructor(
    private readonly config: TemplateBuilderConfig = {}
  ) {}

  /**
   * Builds a complete Backstage template
   */
  build(
    xrd: XRD,
    version: XRDVersion,
    parameterSections: ParameterSection[],
    steps: BackstageTemplateStep[]
  ): BackstageTemplate {
    const template: BackstageTemplate = {
      apiVersion: 'scaffolder.backstage.io/v1beta3',
      kind: 'Template',
      metadata: this.buildMetadata(xrd, version),
      spec: {
        type: this.config.templateType || 'crossplane-resource',
        parameters: parameterSections,
        steps: steps,
        output: this.buildOutput(xrd)
      }
    };

    // Add owner if configured
    if (this.config.owner) {
      template.spec.owner = this.config.owner;
    }

    return template;
  }

  /**
   * Builds template metadata from XRD
   */
  private buildMetadata(xrd: XRD, version: XRDVersion): BackstageTemplate['metadata'] {
    const xrKind = xrd.spec.names.kind;
    const claimKind = xrd.spec.claimNames?.kind;
    const resourceKind = claimKind || xrKind;

    // Extract metadata from XRD annotations and labels
    const xrdAnnotations = xrd.metadata.annotations || {};
    const xrdLabels = xrd.metadata.labels || {};

    const metadata: BackstageTemplate['metadata'] = {
      name: this.generateTemplateName(xrd),
      title: xrdAnnotations['backstage.io/title'] || 
             xrdAnnotations['openportal.dev/title'] || 
             `${resourceKind} Template`,
      description: xrdAnnotations['backstage.io/description'] || 
                  xrdAnnotations['openportal.dev/description'] || 
                  `Create a ${resourceKind} resource via Crossplane`,
      tags: this.extractTags(xrd),
      annotations: {}
    };

    // Add XRD reference annotation
    metadata.annotations['crossplane.io/xrd'] = xrd.metadata.name;
    metadata.annotations['crossplane.io/version'] = version.name;

    // Add icon if specified
    if (xrdAnnotations['backstage.io/icon']) {
      metadata.annotations['backstage.io/icon'] = xrdAnnotations['backstage.io/icon'];
    }

    // Add documentation link if specified
    if (xrdAnnotations['backstage.io/docs-url']) {
      metadata.annotations['backstage.io/docs-url'] = xrdAnnotations['backstage.io/docs-url'];
    }

    // Add source location if specified
    if (xrdAnnotations['backstage.io/source-location']) {
      metadata.annotations['backstage.io/source-location'] = xrdAnnotations['backstage.io/source-location'];
    }

    // Add lifecycle annotation
    metadata.annotations['backstage.io/lifecycle'] = xrdAnnotations['backstage.io/lifecycle'] || 'production';

    // Add custom annotations from config
    if (this.config.additionalAnnotations) {
      Object.assign(metadata.annotations, this.config.additionalAnnotations);
    }

    // Add links section
    metadata.links = this.buildLinks(xrd);

    return metadata;
  }

  /**
   * Generates a template name from XRD
   */
  private generateTemplateName(xrd: XRD): string {
    if (this.config.namePrefix || this.config.nameSuffix) {
      const baseName = xrd.spec.names.plural;
      const prefix = this.config.namePrefix || '';
      const suffix = this.config.nameSuffix || '-template';
      return `${prefix}${baseName}${suffix}`;
    }

    // Use XRD annotation if available
    const annotations = xrd.metadata.annotations || {};
    if (annotations['backstage.io/template-name']) {
      return annotations['backstage.io/template-name'];
    }

    // Default: use plural name with -template suffix
    return `${xrd.spec.names.plural}-template`;
  }

  /**
   * Extracts tags from XRD labels and annotations
   */
  private extractTags(xrd: XRD): string[] {
    const tags: Set<string> = new Set();
    
    // Add default tags
    tags.add('crossplane');
    tags.add('infrastructure');

    // Extract from XRD labels
    const labels = xrd.metadata.labels || {};
    if (labels['openportal.dev/tags']) {
      labels['openportal.dev/tags'].split(',').forEach(tag => tags.add(tag.trim()));
    }
    if (labels['backstage.io/tags']) {
      labels['backstage.io/tags'].split(',').forEach(tag => tags.add(tag.trim()));
    }

    // Extract from annotations
    const annotations = xrd.metadata.annotations || {};
    if (annotations['backstage.io/tags']) {
      annotations['backstage.io/tags'].split(',').forEach(tag => tags.add(tag.trim()));
    }

    // Add version tag
    const apiVersion = xrd.apiVersion.split('/')[1];
    tags.add(`crossplane-${apiVersion}`);

    // Add scope tag for v2
    if (xrd.spec.scope) {
      tags.add(xrd.spec.scope.toLowerCase());
    }

    // Add configured tags
    if (this.config.additionalTags) {
      this.config.additionalTags.forEach(tag => tags.add(tag));
    }

    return [...tags];
  }

  /**
   * Builds links section for the template
   */
  private buildLinks(xrd: XRD): Array<{ url: string; title: string; icon?: string }> {
    const links: Array<{ url: string; title: string; icon?: string }> = [];
    const annotations = xrd.metadata.annotations || {};

    // Add documentation link
    if (annotations['openportal.dev/docs-url']) {
      links.push({
        url: annotations['openportal.dev/docs-url'],
        title: 'Documentation',
        icon: 'docs'
      });
    }

    // Add source repository link
    if (annotations['openportal.dev/source-url']) {
      links.push({
        url: annotations['openportal.dev/source-url'],
        title: 'Source Code',
        icon: 'github'
      });
    }

    // Add support link
    if (annotations['openportal.dev/support-url']) {
      links.push({
        url: annotations['openportal.dev/support-url'],
        title: 'Support',
        icon: 'help'
      });
    }

    // Add configured links
    if (this.config.additionalLinks) {
      links.push(...this.config.additionalLinks);
    }

    return links;
  }

  /**
   * Builds the output section of the template
   */
  private buildOutput(xrd: XRD): BackstageTemplate['spec']['output'] {
    const output: BackstageTemplate['spec']['output'] = {
      links: []
    };

    // Add link to created resource
    if (this.config.kubernetesUIEnabled) {
      output.links?.push({
        title: 'View in Kubernetes',
        url: '${{ steps["create-xr"].output.resourceUrl || steps["create-claim"].output.resourceUrl }}'
      });
    }

    // Add link to Git PR if publishing
    if (this.config.publishingEnabled) {
      output.links?.push({
        title: 'View Pull Request',
        url: '${{ steps["publish-git"].output.pullRequestUrl }}'
      });
    }

    // Add link to catalog if registering
    if (this.config.catalogRegistrationEnabled) {
      output.links?.push({
        title: 'View in Catalog',
        url: '${{ steps["register"].output.entityRef }}'
      });
    }

    // Add text output
    output.text = this.buildOutputText(xrd);

    return output;
  }

  /**
   * Builds the output text message
   * Note: Backstage expects text to be a single string, not an array
   */
  private buildOutputText(xrd: XRD): string {
    const resourceKind = xrd.spec.claimNames?.kind || xrd.spec.names.kind;
    const text: string[] = [];

    text.push(`## ${resourceKind} Created Successfully`);
    text.push('');
    text.push('Your resource has been created with the following details:');
    text.push('- **Name**: ${{ parameters.xrName }}');
    
    if (xrd.spec.scope === 'Namespaced' || xrd.spec.claimNames) {
      text.push('- **Namespace**: ${{ parameters.namespace }}');
    }
    
    text.push('- **Owner**: ${{ parameters.owner }}');
    
    if (xrd.clusters && xrd.clusters.length > 1) {
      text.push('- **Cluster**: ${{ parameters.cluster }}');
    }

    if (this.config.publishingEnabled) {
      text.push('');
      text.push('### GitOps Status');
      text.push('{{#if parameters.createPr}}');
      text.push('A pull request has been created for review.');
      text.push('{{else}}');
      text.push('Changes have been committed directly to the repository.');
      text.push('{{/if}}');
    }

    // Add custom output text
    if (this.config.additionalOutputText) {
      text.push('');
      text.push(...this.config.additionalOutputText);
    }

    // Join all lines into a single string
    return text.join('\n');
  }

  /**
   * Validates the built template
   */
  validate(template: BackstageTemplate): string[] {
    const errors: string[] = [];

    // Validate required fields
    if (!template.metadata.name) {
      errors.push('Template name is required');
    }

    if (!template.metadata.title) {
      errors.push('Template title is required');
    }

    if (!template.spec.type) {
      errors.push('Template type is required');
    }

    if (!template.spec.parameters || template.spec.parameters.length === 0) {
      errors.push('Template must have at least one parameter section');
    }

    if (!template.spec.steps || template.spec.steps.length === 0) {
      errors.push('Template must have at least one step');
    }

    // Validate parameter sections
    template.spec.parameters.forEach((section, index) => {
      if (!section.title) {
        errors.push(`Parameter section ${index + 1} is missing a title`);
      }
      if (!section.properties || Object.keys(section.properties).length === 0) {
        errors.push(`Parameter section "${section.title}" has no properties`);
      }
    });

    // Validate steps
    template.spec.steps.forEach((step, index) => {
      if (!step.id) {
        errors.push(`Step ${index + 1} is missing an ID`);
      }
      if (!step.action) {
        errors.push(`Step "${step.id || index + 1}" is missing an action`);
      }
    });

    // Validate template name format
    if (template.metadata.name && !/^[a-z0-9-]+$/.test(template.metadata.name)) {
      errors.push('Template name must contain only lowercase letters, numbers, and hyphens');
    }

    return errors;
  }

  /**
   * Merges multiple parameter sections intelligently
   */
  mergeParameterSections(sections: ParameterSection[]): ParameterSection[] {
    const merged = new Map<string, ParameterSection>();

    sections.forEach(section => {
      const existing = merged.get(section.title);
      if (existing) {
        // Merge properties and required fields
        existing.properties = { ...existing.properties, ...section.properties };
        if (section.required) {
          existing.required = [...new Set([...(existing.required || []), ...section.required])];
        }
        if (section.description && !existing.description) {
          existing.description = section.description;
        }
      } else {
        merged.set(section.title, { ...section });
      }
    });

    return Array.from(merged.values());
  }
}