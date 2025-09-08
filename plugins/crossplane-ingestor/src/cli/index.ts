/**
 * CLI interface for the kubernetes-ingestor plugin
 * This module exports the transformation logic for use outside of Backstage
 */

import { XRDTransformer } from '../transformers';
import { XRD, XRDTransformerConfig, BackstageTemplate, BackstageApiEntity } from '../types';
import { parseYaml, toYaml } from '../utils';
import * as fs from 'fs';
import * as path from 'path';

/**
 * CLI-friendly transformer that can work with files and YAML strings
 */
export class CLITransformer {
  private transformer: XRDTransformer;

  constructor(config?: XRDTransformerConfig) {
    this.transformer = new XRDTransformer(config || this.getDefaultConfig());
  }

  /**
   * Transforms an XRD from various sources (returns both templates and API entities)
   */
  async transform(input: string | XRD): Promise<Array<BackstageTemplate | BackstageApiEntity>> {
    let xrd: XRD;

    if (typeof input === 'string') {
      // Check if it's a file path
      if (fs.existsSync(input)) {
        const content = fs.readFileSync(input, 'utf8');
        xrd = parseYaml<XRD>(content)!;
      } else {
        // Assume it's YAML content
        xrd = parseYaml<XRD>(input)!;
      }
    } else {
      xrd = input;
    }

    if (!xrd) {
      throw new Error('Invalid XRD input');
    }

    // Validate XRD
    const validation = this.transformer.canTransform(xrd);
    if (!validation.valid) {
      throw new Error(`XRD validation failed: ${validation.reasons.join(', ')}`);
    }

    return this.transformer.transform(xrd);
  }

  /**
   * Transforms XRD from a file (returns both templates and API entities)
   */
  async transformFile(filePath: string): Promise<Array<BackstageTemplate | BackstageApiEntity>> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const content = fs.readFileSync(filePath, 'utf8');
    return this.transform(content);
  }

  /**
   * Transforms XRDs from a directory (returns both templates and API entities)
   */
  async transformDirectory(dirPath: string): Promise<Array<BackstageTemplate | BackstageApiEntity>> {
    if (!fs.existsSync(dirPath)) {
      throw new Error(`Directory not found: ${dirPath}`);
    }

    const entities: Array<BackstageTemplate | BackstageApiEntity> = [];
    const files = fs.readdirSync(dirPath);

    for (const file of files) {
      if (file.endsWith('.yaml') || file.endsWith('.yml')) {
        const filePath = path.join(dirPath, file);
        
        try {
          const fileEntities = await this.transformFile(filePath);
          entities.push(...fileEntities);
        } catch (error) {
          console.error(`Failed to process ${file}:`, error);
        }
      }
    }

    return entities;
  }

  /**
   * Transforms XRD and saves entities to directory
   */
  async transformAndSave(
    input: string | XRD,
    outputDir: string
  ): Promise<string[]> {
    const entities = await this.transform(input);
    const savedFiles: string[] = [];

    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    for (const entity of entities) {
      // Determine entity type and filename
      const isTemplate = entity.kind === 'Template';
      const suffix = isTemplate ? 'template' : 'api';
      const fileName = `${entity.metadata.name}-${suffix}.yaml`;
      const filePath = path.join(outputDir, fileName);
      
      fs.writeFileSync(filePath, toYaml(entity));
      savedFiles.push(filePath);
    }

    return savedFiles;
  }

  /**
   * Gets preview information for an XRD
   */
  preview(input: string | XRD): any {
    let xrd: XRD;

    if (typeof input === 'string') {
      if (fs.existsSync(input)) {
        const content = fs.readFileSync(input, 'utf8');
        xrd = parseYaml<XRD>(content)!;
      } else {
        xrd = parseYaml<XRD>(input)!;
      }
    } else {
      xrd = input;
    }

    if (!xrd) {
      throw new Error('Invalid XRD input');
    }

    return this.transformer.preview(xrd);
  }

  /**
   * Validates an XRD
   */
  validate(input: string | XRD): { valid: boolean; reasons: string[] } {
    let xrd: XRD;

    if (typeof input === 'string') {
      if (fs.existsSync(input)) {
        const content = fs.readFileSync(input, 'utf8');
        xrd = parseYaml<XRD>(content)!;
      } else {
        xrd = parseYaml<XRD>(input)!;
      }
    } else {
      xrd = input;
    }

    if (!xrd) {
      return {
        valid: false,
        reasons: ['Failed to parse XRD']
      };
    }

    return this.transformer.canTransform(xrd);
  }

  /**
   * Gets default configuration for CLI usage
   */
  private getDefaultConfig(): XRDTransformerConfig {
    return {
      extractorConfig: {
        includePublishing: true,
        publishPhase: {
          git: {
            repoUrl: 'github.com?owner=open-service-portal&repo=catalog-orders',
            targetBranch: 'main'
          }
        }
      },
      stepGeneratorConfig: {
        includeFetch: true,
        includeRegister: false,
        includePublishing: true
      },
      templateBuilderConfig: {
        templateType: 'crossplane-resource',
        owner: 'platform-team',
        additionalTags: ['cli-generated'],
        kubernetesUIEnabled: true,
        publishingEnabled: true
      }
    };
  }
}

/**
 * Export a singleton instance for easy CLI usage
 */
export const cliTransformer = new CLITransformer();

/**
 * Export all transformers for advanced usage
 */
export * from '../transformers';
export * from '../types';
export * from '../utils';