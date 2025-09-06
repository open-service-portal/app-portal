#!/usr/bin/env node

/**
 * XRD to Backstage Template Ingestor
 * 
 * This script transforms Crossplane XRDs into Backstage Software Templates
 * using the actual kubernetes-ingestor plugin transformation logic.
 * 
 * Usage:
 *   ingestor.js <source> [options]
 * 
 * Where source can be:
 *   - Path to an XRD file
 *   - Path to a directory containing XRDs
 *   - "cluster" to fetch from current kubectl context
 * 
 * Options:
 *   --output, -o <dir>    Output directory for templates (default: ./output)
 *   --preview, -p         Preview mode - show what would be generated
 *   --validate, -v        Validate only, don't generate templates
 *   --config, -c <file>   Configuration file (JSON or YAML)
 *   --format, -f <type>   Output format: yaml, json (default: yaml)
 *   --help, -h            Show help
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const yaml = require('js-yaml');

// Import the transformer from the compiled plugin
// This will work after the plugin is built with `yarn build`
let CLITransformer;
let cliTransformer;

try {
  // Try to import from the compiled TypeScript
  const cliModule = require('../../dist/cli/index.cjs.js');
  CLITransformer = cliModule.CLITransformer;
  cliTransformer = cliModule.cliTransformer;
} catch (error) {
  // Fallback to direct CLI folder import
  try {
    const cliModule = require('../../dist/cli/cli');
    CLITransformer = cliModule.CLITransformer;
    cliTransformer = cliModule.cliTransformer;
  } catch (error2) {
    console.error('Error: Plugin not built. Please run "yarn build" first.');
    console.error('From the plugin directory: cd app-portal/plugins/kubernetes-ingestor && yarn build');
    console.error('Debug:', error2.message);
    process.exit(1);
  }
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    source: null,
    output: './output',
    preview: false,
    validate: false,
    config: null,
    format: 'yaml',
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--output' || arg === '-o') {
      options.output = args[++i];
    } else if (arg === '--preview' || arg === '-p') {
      options.preview = true;
    } else if (arg === '--validate' || arg === '-v') {
      options.validate = true;
    } else if (arg === '--config' || arg === '-c') {
      options.config = args[++i];
    } else if (arg === '--format' || arg === '-f') {
      options.format = args[++i];
    } else if (!options.source) {
      options.source = arg;
    }
  }

  return options;
}

// Show help message
function showHelp() {
  console.log(`
XRD to Backstage Template Ingestor

This script transforms Crossplane XRDs into Backstage Software Templates
using the kubernetes-ingestor plugin's transformation logic.

Usage:
  ingestor.js <source> [options]

Where source can be:
  - Path to an XRD file (e.g., ./xrd.yaml)
  - Path to a directory containing XRDs (e.g., ./xrds/)
  - "cluster" to fetch from current kubectl context

Options:
  --output, -o <dir>    Output directory for templates (default: ./output)
  --preview, -p         Preview mode - show what would be generated
  --validate, -v        Validate only, don't generate templates
  --config, -c <file>   Configuration file (JSON or YAML)
  --format, -f <type>   Output format: yaml, json (default: yaml)
  --help, -h            Show this help message

Examples:
  # Transform a single XRD file
  ingestor.js ./my-xrd.yaml

  # Transform all XRDs in a directory
  ingestor.js ./xrds/ --output ./templates

  # Fetch XRDs from current Kubernetes cluster
  ingestor.js cluster --preview

  # Validate XRDs without generating templates
  ingestor.js ./xrds/ --validate

  # Use custom configuration
  ingestor.js ./xrd.yaml --config ./config.yaml
`);
}

// Load configuration from file
function loadConfig(configPath) {
  if (!fs.existsSync(configPath)) {
    console.error(`Configuration file not found: ${configPath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(configPath, 'utf8');
  
  if (configPath.endsWith('.json')) {
    return JSON.parse(content);
  } else {
    return yaml.load(content);
  }
}

// Fetch XRDs from Kubernetes cluster
function fetchXRDsFromCluster() {
  try {
    console.log('Fetching XRDs from current kubectl context...');
    
    // Get current context
    const context = execSync('kubectl config current-context', { encoding: 'utf8' }).trim();
    console.log(`Using context: ${context}`);
    
    // Fetch all XRDs
    const xrdsJson = execSync('kubectl get xrds -o json', { encoding: 'utf8' });
    const xrdsData = JSON.parse(xrdsJson);
    
    console.log(`Found ${xrdsData.items.length} XRDs in cluster`);
    
    return xrdsData.items;
  } catch (error) {
    console.error('Failed to fetch XRDs from cluster:', error.message);
    console.error('Make sure kubectl is configured and you have access to XRDs');
    process.exit(1);
  }
}

// Format output based on format option
function formatOutput(data, format) {
  if (format === 'json') {
    return JSON.stringify(data, null, 2);
  } else {
    return yaml.dump(data, {
      lineWidth: -1,
      noRefs: true,
      sortKeys: false
    });
  }
}

// Main function
async function main() {
  const options = parseArgs();
  
  if (options.help) {
    showHelp();
    process.exit(0);
  }
  
  if (!options.source) {
    console.error('Error: No source specified');
    showHelp();
    process.exit(1);
  }
  
  // Load configuration if provided
  let config = null;
  if (options.config) {
    config = loadConfig(options.config);
    console.log('Loaded configuration from', options.config);
  }
  
  // Create transformer with config
  const transformer = config ? new CLITransformer(config) : cliTransformer;
  
  try {
    let xrds = [];
    
    // Determine source type and fetch XRDs
    if (options.source === 'cluster') {
      xrds = fetchXRDsFromCluster();
    } else if (fs.existsSync(options.source)) {
      const stats = fs.statSync(options.source);
      
      if (stats.isDirectory()) {
        // Process directory
        console.log(`Processing directory: ${options.source}`);
        const files = fs.readdirSync(options.source)
          .filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
        
        for (const file of files) {
          const filePath = path.join(options.source, file);
          const content = fs.readFileSync(filePath, 'utf8');
          const docs = yaml.loadAll(content);
          
          for (const doc of docs) {
            if (doc && doc.kind === 'CompositeResourceDefinition') {
              xrds.push(doc);
            }
          }
        }
        
        console.log(`Found ${xrds.length} XRDs in directory`);
      } else {
        // Process single file
        console.log(`Processing file: ${options.source}`);
        const content = fs.readFileSync(options.source, 'utf8');
        const docs = yaml.loadAll(content);
        
        for (const doc of docs) {
          if (doc && doc.kind === 'CompositeResourceDefinition') {
            xrds.push(doc);
          }
        }
        
        console.log(`Found ${xrds.length} XRDs in file`);
      }
    } else {
      console.error(`Source not found: ${options.source}`);
      process.exit(1);
    }
    
    if (xrds.length === 0) {
      console.log('No XRDs found to process');
      process.exit(0);
    }
    
    // Process each XRD
    let totalTemplates = 0;
    const results = [];
    
    for (const xrd of xrds) {
      const xrdName = xrd.metadata?.name || 'unknown';
      
      try {
        // Validate mode
        if (options.validate) {
          const validation = transformer.validate(xrd);
          
          if (validation.valid) {
            console.log(`✓ ${xrdName} - Valid`);
          } else {
            console.log(`✗ ${xrdName} - Invalid:`);
            validation.reasons.forEach(reason => {
              console.log(`  - ${reason}`);
            });
          }
          continue;
        }
        
        // Preview mode
        if (options.preview) {
          const preview = transformer.preview(xrd);
          console.log(`\n${xrdName}:`);
          console.log(`  Crossplane Version: ${preview.crossplaneVersion.version}`);
          console.log(`  Scope: ${preview.crossplaneVersion.scope}`);
          console.log(`  Resource Kind: ${preview.resourceKind}`);
          console.log(`  Templates to Generate: ${preview.templateCount}`);
          console.log(`  Requires Namespace: ${preview.requiresNamespace}`);
          console.log(`  Multi-Cluster: ${preview.multiCluster}`);
          
          if (preview.versions.length > 0) {
            console.log('  Versions:');
            preview.versions.forEach(v => {
              const status = v.served ? '✓' : '✗';
              const deprecated = v.deprecated ? ' (deprecated)' : '';
              const schema = v.hasSchema ? ' [schema]' : '';
              console.log(`    ${status} ${v.name}${deprecated}${schema}`);
            });
          }
          continue;
        }
        
        // Transform mode
        console.log(`Processing ${xrdName}...`);
        const templates = await transformer.transform(xrd);
        
        if (templates.length > 0) {
          totalTemplates += templates.length;
          
          // Create output directory if needed
          if (!fs.existsSync(options.output)) {
            fs.mkdirSync(options.output, { recursive: true });
          }
          
          // Save each template
          for (const template of templates) {
            const fileName = `${template.metadata.name}.${options.format === 'json' ? 'json' : 'yaml'}`;
            const filePath = path.join(options.output, fileName);
            const content = formatOutput(template, options.format);
            
            fs.writeFileSync(filePath, content);
            console.log(`  Created: ${fileName}`);
            
            results.push({
              xrd: xrdName,
              template: template.metadata.name,
              file: filePath
            });
          }
        } else {
          console.log(`  No templates generated (XRD may not be served)`);
        }
      } catch (error) {
        console.error(`  Error processing ${xrdName}: ${error.message}`);
      }
    }
    
    // Summary
    if (!options.validate && !options.preview) {
      console.log(`\nSummary:`);
      console.log(`  XRDs Processed: ${xrds.length}`);
      console.log(`  Templates Generated: ${totalTemplates}`);
      console.log(`  Output Directory: ${path.resolve(options.output)}`);
      
      if (results.length > 0) {
        console.log('\nGenerated Templates:');
        results.forEach(r => {
          console.log(`  - ${r.template} (from ${r.xrd})`);
        });
      }
    }
  } catch (error) {
    console.error('Error:', error.message);
    if (error.stack && process.env.DEBUG) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
}

// Export for testing
module.exports = { parseArgs, loadConfig, fetchXRDsFromCluster };