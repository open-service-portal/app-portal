#!/usr/bin/env node

/**
 * Backstage Template Exporter CLI
 * 
 * Fetches templates and API entities from a running Backstage instance
 * using the static API token for authentication.
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const https = require('https');
const http = require('http');
const { URL } = require('url');

class BackstageExporter {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || 'http://localhost:7007';
    this.token = options.token;
    this.outputDir = options.outputDir || './exported';
  }

  /**
   * Fetch data from Backstage API
   */
  async fetch(endpoint) {
    const url = new URL(endpoint, this.baseUrl);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;

    return new Promise((resolve, reject) => {
      const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      };

      if (this.token) {
        options.headers['Authorization'] = `Bearer ${this.token}`;
      }

      const req = client.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(data));
            } catch (e) {
              reject(new Error(`Failed to parse JSON: ${e.message}`));
            }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.end();
    });
  }

  /**
   * Export entities from Backstage
   */
  async exportEntities(filter = {}) {
    try {
      // Build query parameters
      const params = new URLSearchParams();
      if (filter.kind) params.append('filter', `kind=${filter.kind}`);
      if (filter.namespace) params.append('filter', `metadata.namespace=${filter.namespace}`);
      if (filter.name) params.append('filter', `metadata.name~${filter.name}`);

      const endpoint = `/api/catalog/entities${params.toString() ? '?' + params.toString() : ''}`;
      console.log(`Fetching entities from: ${this.baseUrl}${endpoint}`);

      const response = await this.fetch(endpoint);
      
      if (!Array.isArray(response)) {
        // Handle single entity response
        return response.items || [response];
      }
      
      return response;
    } catch (error) {
      console.error('Failed to fetch entities:', error.message);
      throw error;
    }
  }

  /**
   * Save entity to file (always in YAML format)
   */
  saveEntity(entity) {
    // Create output directory if it doesn't exist
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }

    // Generate filename (always .yaml)
    const kind = entity.kind.toLowerCase();
    const name = entity.metadata.name;
    const filename = `${name}-${kind}.yaml`;
    const filepath = path.join(this.outputDir, filename);

    // Always save as YAML
    fs.writeFileSync(filepath, yaml.dump(entity, {
      lineWidth: -1,
      noRefs: true,
      sortKeys: false
    }));

    console.log(`Saved: ${filepath}`);
    return filepath;
  }

  /**
   * Export templates matching a pattern
   */
  async exportTemplates(pattern) {
    const entities = await this.exportEntities({ 
      kind: 'Template',
      name: pattern 
    });

    if (entities.length === 0) {
      console.log('No templates found matching the pattern');
      return [];
    }

    const savedFiles = [];
    for (const entity of entities) {
      const filepath = this.saveEntity(entity);
      savedFiles.push(filepath);
    }

    return savedFiles;
  }

  /**
   * Export API entities matching a pattern
   */
  async exportApis(pattern) {
    const entities = await this.exportEntities({ 
      kind: 'API',
      name: pattern 
    });

    if (entities.length === 0) {
      console.log('No API entities found matching the pattern');
      return [];
    }

    const savedFiles = [];
    for (const entity of entities) {
      const filepath = this.saveEntity(entity);
      savedFiles.push(filepath);
    }

    return savedFiles;
  }

  /**
   * Export all entities of specific kinds
   */
  async exportAll(kinds = ['Template', 'API']) {
    const savedFiles = [];

    for (const kind of kinds) {
      console.log(`\nExporting ${kind} entities...`);
      const entities = await this.exportEntities({ kind });
      
      if (entities.length === 0) {
        console.log(`No ${kind} entities found`);
        continue;
      }

      console.log(`Found ${entities.length} ${kind} entities`);
      for (const entity of entities) {
        const filepath = this.saveEntity(entity);
        savedFiles.push(filepath);
      }
    }

    return savedFiles;
  }
}

/**
 * CLI Interface
 */
async function main() {
  const args = process.argv.slice(2);
  
  // Parse command line arguments
  let baseUrl = 'http://localhost:7007';
  let token = process.env.BACKSTAGE_TOKEN;
  let outputDir = './exported';
  let pattern = '';
  let kind = 'all';
  let format = 'yaml';

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--url':
      case '-u':
        baseUrl = args[++i];
        break;
      case '--token':
      case '-t':
        token = args[++i];
        break;
      case '--output':
      case '-o':
        outputDir = args[++i];
        break;
      case '--pattern':
      case '-p':
        pattern = args[++i];
        break;
      case '--kind':
      case '-k':
        kind = args[++i].toLowerCase();
        break;
      case '--format':
      case '-f':
        format = args[++i].toLowerCase();
        break;
      case '--help':
      case '-h':
        console.log(`
Backstage Template Exporter

Usage: export.js [options]

Options:
  -u, --url <url>        Backstage URL (default: http://localhost:7007)
  -t, --token <token>    API token (or set BACKSTAGE_TOKEN env var)
  -o, --output <dir>     Output directory (default: ./exported)
  -p, --pattern <name>   Name pattern to match (supports wildcards)
  -k, --kind <kind>      Entity kind: template, api, or all (default: all)
  -f, --format <format>  Output format: yaml or json (default: yaml)
  -h, --help            Show this help message

Examples:
  # Export all templates and APIs
  export.js -o ./original

  # Export templates matching a pattern
  export.js -k template -p "managednamespace" -o ./templates

  # Export with specific token
  export.js -t "your-token-here" -o ./exported

  # Export as JSON
  export.js -f json -o ./json-output
        `);
        process.exit(0);
    }
  }

  // Validate token
  if (!token) {
    console.error('Error: No API token provided');
    console.error('Set BACKSTAGE_TOKEN environment variable or use --token flag');
    process.exit(1);
  }

  // Create exporter instance
  const exporter = new BackstageExporter({
    baseUrl,
    token,
    outputDir,
  });

  try {
    let savedFiles = [];

    if (kind === 'template') {
      savedFiles = await exporter.exportTemplates(pattern);
    } else if (kind === 'api') {
      savedFiles = await exporter.exportApis(pattern);
    } else if (kind === 'all') {
      savedFiles = await exporter.exportAll(['Template', 'API']);
    } else {
      // Export specific kind
      const entities = await exporter.exportEntities({ 
        kind: kind.charAt(0).toUpperCase() + kind.slice(1),
        name: pattern 
      });

      for (const entity of entities) {
        const filepath = exporter.saveEntity(entity, format);
        savedFiles.push(filepath);
      }
    }

    console.log(`\nExport complete. ${savedFiles.length} files saved to ${outputDir}`);
  } catch (error) {
    console.error('Export failed:', error.message);
    process.exit(1);
  }
}

// Run CLI if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
}

// Export for programmatic use
module.exports = { BackstageExporter };