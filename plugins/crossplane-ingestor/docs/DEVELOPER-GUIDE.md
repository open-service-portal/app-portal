# Developer Guide: Extending Transformers

## Overview

This guide explains how to extend and customize the transformer system in the kubernetes-ingestor plugin. The modular architecture makes it easy to add new features, support additional Crossplane versions, or customize the transformation behavior.

## Architecture Overview

The transformer system follows a pipeline architecture with clear separation of concerns:

```
XRD Input → CrossplaneDetector → ParameterExtractor → StepGenerator → TemplateBuilder → Template Output
                                                           ↑
                                                    (V1 or V2 based on detection)
```

Each component has a single responsibility and can be extended or replaced independently.

## Core Components

### 1. CrossplaneDetector

**Purpose**: Detects Crossplane version and resource scope from XRD.

**Interface**:
```typescript
class CrossplaneDetector {
  detect(xrd: XRD): {
    version: 'v1' | 'v2';
    scope: 'Cluster' | 'Namespaced' | 'LegacyCluster';
    usesClaims: boolean;
  }
}
```

### 2. ParameterExtractor

**Purpose**: Converts OpenAPI schemas to Backstage form parameters.

**Interface**:
```typescript
class ParameterExtractor {
  extract(xrd: XRD, version: XRDVersion, config?: ExtractorConfig): ParameterSection[]
}
```

### 3. StepGenerator (V1/V2)

**Purpose**: Generates scaffolder steps based on Crossplane version.

**Interface**:
```typescript
class StepGeneratorV2 {
  generate(xrd: XRD, version: XRDVersion, parameterSections: ParameterSection[]): BackstageTemplateStep[]
  isCompatible(xrd: XRD): boolean
}
```

### 4. TemplateBuilder

**Purpose**: Assembles complete Backstage templates from components.

**Interface**:
```typescript
class TemplateBuilder {
  build(xrd: XRD, version: XRDVersion, parameterSections: ParameterSection[], steps: BackstageTemplateStep[]): BackstageTemplate
}
```

### 5. XRDTransformer

**Purpose**: Main orchestrator coordinating all transformers.

**Interface**:
```typescript
class XRDTransformer {
  transform(xrd: XRD): BackstageTemplate[]
  canTransform(xrd: XRD): { valid: boolean; reasons: string[] }
  preview(xrd: XRD): TransformationPreview
}
```

## Extension Points

### Adding Support for New Crossplane Versions

To support a new Crossplane version (e.g., v3):

1. **Create a new step generator**:

```typescript
// src/transformers/StepGeneratorV3.ts
import { XRD, XRDVersion, BackstageTemplateStep, StepGeneratorConfig, ParameterSection } from '../types';

export class StepGeneratorV3 {
  constructor(private readonly config: StepGeneratorConfig = {}) {}

  generate(
    xrd: XRD,
    version: XRDVersion,
    parameterSections: ParameterSection[]
  ): BackstageTemplateStep[] {
    const steps: BackstageTemplateStep[] = [];
    
    // Add your v3-specific step generation logic
    steps.push(this.generateV3ResourceStep(xrd, version));
    
    if (this.config.includePublishing) {
      steps.push(...this.generatePublishingSteps(xrd));
    }
    
    return steps;
  }

  private generateV3ResourceStep(xrd: XRD, version: XRDVersion): BackstageTemplateStep {
    // V3-specific resource creation
    return {
      id: 'create-v3-resource',
      name: `Create ${xrd.spec.names.kind} (v3)`,
      action: 'kubernetes:apply-v3', // Hypothetical v3 action
      input: {
        // V3-specific manifest structure
      }
    };
  }

  isCompatible(xrd: XRD): boolean {
    return xrd.apiVersion.includes('/v3');
  }
}
```

2. **Update CrossplaneDetector**:

```typescript
// In CrossplaneDetector.ts
detect(xrd: XRD): CrossplaneVersion {
  const apiVersion = xrd.apiVersion;
  
  if (apiVersion.includes('/v3')) {
    return {
      version: 'v3',
      scope: xrd.spec.scope || 'Cluster',
      usesClaims: false // v3 specific behavior
    };
  }
  // ... existing v1/v2 logic
}
```

3. **Register in XRDTransformer**:

```typescript
// In XRDTransformer.ts
import { StepGeneratorV3 } from './StepGeneratorV3';

export class XRDTransformer {
  private stepGeneratorV3: StepGeneratorV3;

  constructor(config?: XRDTransformerConfig) {
    // ... existing initialization
    this.stepGeneratorV3 = new StepGeneratorV3(config?.stepGeneratorConfig);
  }

  private selectStepGenerator(crossplaneVersion: CrossplaneVersion) {
    if (crossplaneVersion.version === 'v3') {
      return this.stepGeneratorV3;
    }
    // ... existing v1/v2 logic
  }
}
```

### Customizing Parameter Extraction

To add custom parameter extraction logic:

1. **Extend the ParameterExtractor**:

```typescript
// src/transformers/CustomParameterExtractor.ts
import { ParameterExtractor } from './ParameterExtractor';

export class CustomParameterExtractor extends ParameterExtractor {
  protected extractFieldFromSchema(
    key: string,
    schema: any,
    parentKey?: string
  ): ParameterProperty | null {
    // Call parent implementation
    const baseProperty = super.extractFieldFromSchema(key, schema, parentKey);
    
    // Add custom logic
    if (schema['x-custom-widget']) {
      baseProperty['ui:widget'] = schema['x-custom-widget'];
    }
    
    if (schema['x-validation-rules']) {
      baseProperty['ui:options'] = {
        validationRules: schema['x-validation-rules']
      };
    }
    
    return baseProperty;
  }
}
```

2. **Use custom extractor in transformer**:

```typescript
// When creating XRDTransformer
const transformer = new XRDTransformer({
  extractorClass: CustomParameterExtractor // Pass custom class
});
```

### Adding Custom Scaffolder Actions

To add custom scaffolder actions to generated templates:

1. **Create a custom step generator**:

```typescript
// src/transformers/CustomStepGenerator.ts
export class CustomStepGenerator extends StepGeneratorV2 {
  generate(
    xrd: XRD,
    version: XRDVersion,
    parameterSections: ParameterSection[]
  ): BackstageTemplateStep[] {
    const steps = super.generate(xrd, version, parameterSections);
    
    // Add custom steps
    steps.push(this.generateCustomValidationStep(xrd));
    steps.push(this.generateNotificationStep());
    
    return steps;
  }

  private generateCustomValidationStep(xrd: XRD): BackstageTemplateStep {
    return {
      id: 'validate-resource',
      name: 'Validate Resource Configuration',
      action: 'custom:validate',
      input: {
        resourceKind: xrd.spec.names.kind,
        validationRules: this.extractValidationRules(xrd)
      }
    };
  }

  private generateNotificationStep(): BackstageTemplateStep {
    return {
      id: 'notify-team',
      name: 'Notify Team',
      action: 'notification:send',
      input: {
        channels: ['slack', 'email'],
        message: 'New ${{ parameters.xrName }} resource created'
      }
    };
  }
}
```

### Customizing Template Metadata

To customize how template metadata is generated:

1. **Extend TemplateBuilder**:

```typescript
// src/transformers/CustomTemplateBuilder.ts
export class CustomTemplateBuilder extends TemplateBuilder {
  protected buildMetadata(xrd: XRD, version: XRDVersion): BackstageTemplate['metadata'] {
    const metadata = super.buildMetadata(xrd, version);
    
    // Add custom annotations
    metadata.annotations['custom.io/category'] = this.determineCategory(xrd);
    metadata.annotations['custom.io/cost-center'] = this.extractCostCenter(xrd);
    
    // Add custom tags
    metadata.tags.push(...this.generateCustomTags(xrd));
    
    // Add custom links
    metadata.links.push({
      url: `https://costs.example.com/${xrd.spec.names.plural}`,
      title: 'Cost Analysis',
      icon: 'money'
    });
    
    return metadata;
  }

  private determineCategory(xrd: XRD): string {
    // Custom categorization logic
    if (xrd.spec.group.includes('database')) return 'data';
    if (xrd.spec.group.includes('network')) return 'networking';
    return 'infrastructure';
  }
}
```

## Creating a Plugin Extension

To create a reusable extension for the transformer system:

1. **Define the extension interface**:

```typescript
// src/extensions/TransformerExtension.ts
export interface TransformerExtension {
  name: string;
  version: string;
  
  // Hooks into transformation pipeline
  beforeTransform?(xrd: XRD): XRD;
  afterParameterExtraction?(params: ParameterSection[]): ParameterSection[];
  afterStepGeneration?(steps: BackstageTemplateStep[]): BackstageTemplateStep[];
  afterTemplateBuilt?(template: BackstageTemplate): BackstageTemplate;
}
```

2. **Implement an extension**:

```typescript
// src/extensions/SecurityExtension.ts
export class SecurityExtension implements TransformerExtension {
  name = 'security-scanner';
  version = '1.0.0';

  afterStepGeneration(steps: BackstageTemplateStep[]): BackstageTemplateStep[] {
    // Add security scanning step
    steps.push({
      id: 'security-scan',
      name: 'Security Scan',
      action: 'security:scan',
      input: {
        scanType: 'infrastructure',
        failOnHighSeverity: true
      }
    });
    
    return steps;
  }

  afterTemplateBuilt(template: BackstageTemplate): BackstageTemplate {
    // Add security metadata
    template.metadata.annotations['security.io/scan-required'] = 'true';
    template.metadata.annotations['security.io/compliance'] = 'pci-dss';
    
    return template;
  }
}
```

3. **Register extensions in transformer**:

```typescript
// src/transformers/XRDTransformer.ts
export class XRDTransformer {
  private extensions: TransformerExtension[] = [];

  registerExtension(extension: TransformerExtension): void {
    this.extensions.push(extension);
  }

  transform(xrd: XRD): BackstageTemplate[] {
    // Apply beforeTransform hooks
    let processedXrd = xrd;
    for (const ext of this.extensions) {
      if (ext.beforeTransform) {
        processedXrd = ext.beforeTransform(processedXrd);
      }
    }

    // ... normal transformation logic

    // Apply other hooks at appropriate points
    for (const ext of this.extensions) {
      if (ext.afterTemplateBuilt) {
        template = ext.afterTemplateBuilt(template);
      }
    }

    return templates;
  }
}
```

## Testing Custom Transformers

### Unit Testing

```typescript
// src/transformers/__tests__/CustomStepGenerator.test.ts
import { CustomStepGenerator } from '../CustomStepGenerator';

describe('CustomStepGenerator', () => {
  let generator: CustomStepGenerator;

  beforeEach(() => {
    generator = new CustomStepGenerator({
      includeCustomSteps: true
    });
  });

  it('should add validation step', () => {
    const steps = generator.generate(mockXRD, mockVersion, mockParams);
    
    const validationStep = steps.find(s => s.id === 'validate-resource');
    expect(validationStep).toBeDefined();
    expect(validationStep?.action).toBe('custom:validate');
  });

  it('should include notification step when configured', () => {
    const steps = generator.generate(mockXRD, mockVersion, mockParams);
    
    const notifyStep = steps.find(s => s.id === 'notify-team');
    expect(notifyStep).toBeDefined();
    expect(notifyStep?.input.channels).toContain('slack');
  });
});
```

### Integration Testing

```typescript
// src/transformers/__tests__/integration/custom.test.ts
import { XRDTransformer } from '../../XRDTransformer';
import { CustomStepGenerator } from '../../CustomStepGenerator';
import { SecurityExtension } from '../../../extensions/SecurityExtension';

describe('Custom Transformer Integration', () => {
  it('should apply all customizations', () => {
    const transformer = new XRDTransformer({
      stepGeneratorV2Class: CustomStepGenerator
    });
    
    // Register extension
    transformer.registerExtension(new SecurityExtension());
    
    const templates = transformer.transform(mockXRD);
    const template = templates[0];
    
    // Verify custom steps
    expect(template.spec.steps).toContainEqual(
      expect.objectContaining({ id: 'validate-resource' })
    );
    expect(template.spec.steps).toContainEqual(
      expect.objectContaining({ id: 'security-scan' })
    );
    
    // Verify security annotations
    expect(template.metadata.annotations['security.io/scan-required']).toBe('true');
  });
});
```

## Configuration Best Practices

### 1. Use Configuration Objects

```typescript
// Good: Extensible configuration
interface CustomTransformerConfig extends XRDTransformerConfig {
  customValidation?: {
    enabled: boolean;
    rules: ValidationRule[];
  };
  notifications?: {
    channels: string[];
    webhookUrl?: string;
  };
}

// Usage
const transformer = new XRDTransformer({
  customValidation: {
    enabled: true,
    rules: [...]
  }
});
```

### 2. Provide Sensible Defaults

```typescript
class CustomTransformer {
  private config: CustomTransformerConfig;

  constructor(config: Partial<CustomTransformerConfig> = {}) {
    this.config = {
      ...this.getDefaultConfig(),
      ...config
    };
  }

  private getDefaultConfig(): CustomTransformerConfig {
    return {
      customValidation: { enabled: false, rules: [] },
      notifications: { channels: ['email'] }
    };
  }
}
```

### 3. Validate Configuration

```typescript
class CustomTransformer {
  constructor(config: CustomTransformerConfig) {
    this.validateConfig(config);
    this.config = config;
  }

  private validateConfig(config: CustomTransformerConfig): void {
    if (config.notifications?.webhookUrl) {
      if (!this.isValidUrl(config.notifications.webhookUrl)) {
        throw new Error('Invalid webhook URL');
      }
    }
  }
}
```

## Plugin Integration

### Registering Custom Transformers in Backstage

```typescript
// packages/backend/src/plugins/kubernetesIngestor.ts
import { createRouter } from '@terasky/backstage-plugin-kubernetes-ingestor';
import { CustomTransformer } from './transformers/CustomTransformer';
import { SecurityExtension } from './extensions/SecurityExtension';

export default async function createPlugin(env: PluginEnvironment): Promise<express.Router> {
  // Create custom transformer
  const transformer = new CustomTransformer({
    // Custom configuration
  });
  
  // Register extensions
  transformer.registerExtension(new SecurityExtension());
  
  // Create router with custom transformer
  return await createRouter({
    logger: env.logger,
    config: env.config,
    transformer: transformer // Pass custom transformer
  });
}
```

### Using Custom CLI Transformer

```typescript
// src/cli/custom-cli.ts
import { CLITransformer } from './index';
import { CustomTransformer } from '../transformers/CustomTransformer';

export class CustomCLITransformer extends CLITransformer {
  constructor(config?: any) {
    super(config);
    this.transformer = new CustomTransformer(config);
  }

  // Add CLI-specific methods
  async validateBatch(files: string[]): Promise<ValidationResult[]> {
    const results = [];
    for (const file of files) {
      const xrd = await this.loadXRD(file);
      results.push(this.transformer.validate(xrd));
    }
    return results;
  }
}

// Export for CLI usage
export const customCliTransformer = new CustomCLITransformer();
```

## Performance Optimization

### 1. Caching

```typescript
class CachedTransformer extends XRDTransformer {
  private cache = new Map<string, BackstageTemplate[]>();

  transform(xrd: XRD): BackstageTemplate[] {
    const cacheKey = this.generateCacheKey(xrd);
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }
    
    const templates = super.transform(xrd);
    this.cache.set(cacheKey, templates);
    
    return templates;
  }

  private generateCacheKey(xrd: XRD): string {
    return `${xrd.metadata.name}-${xrd.metadata.resourceVersion}`;
  }
}
```

### 2. Parallel Processing

```typescript
class ParallelTransformer {
  async transformBatch(xrds: XRD[]): Promise<BackstageTemplate[][]> {
    return Promise.all(
      xrds.map(xrd => this.transform(xrd))
    );
  }
}
```

## Debugging

### Enable Debug Logging

```typescript
class DebugTransformer extends XRDTransformer {
  private debug = process.env.DEBUG === 'true';

  transform(xrd: XRD): BackstageTemplate[] {
    if (this.debug) {
      console.log('Starting transformation for:', xrd.metadata.name);
      console.time('transformation');
    }

    const templates = super.transform(xrd);

    if (this.debug) {
      console.timeEnd('transformation');
      console.log('Generated templates:', templates.length);
    }

    return templates;
  }
}
```

### Transformation Tracing

```typescript
interface TransformationTrace {
  step: string;
  input: any;
  output: any;
  duration: number;
}

class TracedTransformer extends XRDTransformer {
  private traces: TransformationTrace[] = [];

  private trace<T>(step: string, input: any, fn: () => T): T {
    const start = Date.now();
    const output = fn();
    const duration = Date.now() - start;

    this.traces.push({ step, input, output, duration });
    
    return output;
  }

  transform(xrd: XRD): BackstageTemplate[] {
    this.traces = [];

    const detection = this.trace('detect', xrd, () => 
      this.crossplaneDetector.detect(xrd)
    );

    // ... continue tracing other steps

    return templates;
  }

  getTraces(): TransformationTrace[] {
    return this.traces;
  }
}
```

## Contributing

When contributing new transformers or extensions:

1. **Follow the existing patterns**: Maintain consistency with existing code
2. **Write comprehensive tests**: Include unit and integration tests
3. **Document your extension**: Add JSDoc comments and update this guide
4. **Consider backwards compatibility**: Don't break existing transformations
5. **Add examples**: Provide usage examples in the documentation

## Resources

- [Type Definitions](../src/types/) - All TypeScript interfaces and types
- [Test Examples](../src/transformers/__tests__/) - Test patterns and examples
- [CLI Documentation](./CLI-USAGE.md) - CLI usage and integration
- [Metadata Flow](./METADATA-FLOW.md) - Complete transformation pipeline