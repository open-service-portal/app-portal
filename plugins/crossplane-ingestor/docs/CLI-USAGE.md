# CLI Usage Guide

## Overview

The kubernetes-ingestor plugin includes a powerful CLI tool that allows you to transform Crossplane XRDs into Backstage Software Templates outside of the Backstage environment. This is useful for:

- CI/CD pipelines that generate templates
- Testing XRD transformations before deployment
- Batch processing of multiple XRDs
- Validation of XRD structure and annotations

## Installation

### From Plugin Directory

```bash
# Navigate to the plugin directory
cd app-portal/plugins/kubernetes-ingestor

# Build the plugin (required for CLI)
yarn build

# Run the CLI
node src/cli/ingestor.js --help
```

### Using Workspace Script

```bash
# From portal-workspace root
./scripts/xrd-ingestor.sh --help
```

## Command Line Interface

### Basic Usage

```bash
ingestor.js <source> [options]
```

Where `source` can be:
- **File path**: Path to a single XRD YAML file
- **Directory**: Path to a directory containing XRD files
- **"cluster"**: Fetch XRDs from current kubectl context

### Options

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--output` | `-o` | Output directory for generated templates | `./output` |
| `--preview` | `-p` | Preview mode - show what would be generated | `false` |
| `--validate` | `-v` | Validate XRDs without generating templates | `false` |
| `--config` | `-c` | Configuration file (JSON or YAML) | none |
| `--format` | `-f` | Output format: `yaml` or `json` | `yaml` |
| `--help` | `-h` | Show help message | - |

## Examples

### Transform a Single XRD

```bash
# Basic transformation
node src/cli/ingestor.js ./xrd.yaml

# With custom output directory
node src/cli/ingestor.js ./xrd.yaml --output ./backstage-templates

# Output as JSON
node src/cli/ingestor.js ./xrd.yaml --format json
```

### Process Multiple XRDs

```bash
# Transform all XRDs in a directory
node src/cli/ingestor.js ./crossplane/xrds/

# With custom output
node src/cli/ingestor.js ./crossplane/xrds/ --output ./generated-templates
```

### Fetch from Kubernetes Cluster

```bash
# Preview XRDs in current cluster
node src/cli/ingestor.js cluster --preview

# Generate templates from cluster XRDs
node src/cli/ingestor.js cluster --output ./cluster-templates

# Validate cluster XRDs
node src/cli/ingestor.js cluster --validate
```

### Validation Mode

```bash
# Validate single file
node src/cli/ingestor.js ./xrd.yaml --validate

# Validate directory
node src/cli/ingestor.js ./xrds/ --validate

# Sample output:
# ✓ databases.platform.io - Valid
# ✗ clusters.platform.io - Invalid:
#   - No served versions found
#   - Missing OpenAPI schema
```

### Preview Mode

```bash
# Preview transformation details
node src/cli/ingestor.js ./xrd.yaml --preview

# Sample output:
# databases.platform.io:
#   Crossplane Version: v2
#   Scope: Namespaced
#   Resource Kind: Database
#   Templates to Generate: 1
#   Requires Namespace: true
#   Multi-Cluster: false
#   Versions:
#     ✓ v1alpha1 [schema]
#     ✗ v1beta1 (deprecated)
```

### Using Configuration File

```bash
# With YAML config
node src/cli/ingestor.js ./xrd.yaml --config ./config.yaml

# With JSON config
node src/cli/ingestor.js ./xrd.yaml --config ./config.json
```

## Configuration

### Configuration File Format

Create a configuration file to customize the transformation:

```yaml
# config.yaml
# Annotation prefix for Backstage metadata
annotationPrefix: 'backstage.io'

# Convert default values to placeholders
convertDefaultValuesToPlaceholders: true

# Template generation options
includePublishing: true
includeFetch: true
includeRegister: false

# Naming conventions
templateNamePrefix: 'xrd-'
templateNameSuffix: '-template'
defaultOwner: 'platform-team'

# Additional metadata
additionalTags:
  - 'gitops'
  - 'self-service'
  - 'crossplane'

# Publishing configuration for GitOps
publishPhase:
  git:
    repoUrl: 'github.com?owner=org&repo=catalog-orders'
    targetBranch: 'main'
    createPR: true
  flux:
    kustomization: 'catalog-orders'
    namespace: 'flux-system'
```

### JSON Configuration Example

```json
{
  "annotationPrefix": "backstage.io",
  "includePublishing": true,
  "templateNamePrefix": "xrd-",
  "additionalTags": ["gitops", "crossplane"],
  "publishPhase": {
    "git": {
      "repoUrl": "github.com?owner=org&repo=catalog-orders"
    }
  }
}
```

## Output Structure

### Generated Files

For each XRD, the CLI generates a Backstage template file:

```
output/
├── databases-template.yaml
├── clusters-template.yaml
└── dnsrecords-template.yaml
```

### Template Structure

Each generated template contains:

```yaml
apiVersion: scaffolder.backstage.io/v1beta3
kind: Template
metadata:
  name: databases-template
  title: Database Template
  description: Create a Database resource via Crossplane
  tags:
    - crossplane
    - infrastructure
    - crossplane-v2
    - namespaced
  annotations:
    crossplane.io/xrd: databases.platform.io
    crossplane.io/version: v1alpha1
spec:
  type: crossplane-resource
  parameters:
    # Generated from OpenAPI schema
    - title: Resource Metadata
      properties:
        xrName:
          type: string
        namespace:
          type: string
    - title: Resource Configuration
      properties:
        # Extracted from XRD spec
  steps:
    # Generated based on Crossplane version
    - id: create-xr
      name: Create Database XR
      action: kubernetes:apply
  output:
    links:
      - title: View in Kubernetes
        url: ${{ steps["create-xr"].output.resourceUrl }}
```

## CLI Workflow Integration

### CI/CD Pipeline Example

```yaml
# .github/workflows/generate-templates.yml
name: Generate Backstage Templates

on:
  push:
    paths:
      - 'crossplane/xrds/*.yaml'

jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install Dependencies
        run: |
          cd app-portal/plugins/kubernetes-ingestor
          yarn install
          yarn build
      
      - name: Generate Templates
        run: |
          node app-portal/plugins/kubernetes-ingestor/src/cli/ingestor.js \
            ./crossplane/xrds/ \
            --output ./backstage-templates \
            --config ./config.yaml
      
      - name: Commit Templates
        run: |
          git add backstage-templates/
          git commit -m "chore: update Backstage templates from XRDs"
          git push
```

### Pre-commit Hook

```bash
#!/bin/bash
# .git/hooks/pre-commit

# Validate XRDs before commit
node app-portal/plugins/kubernetes-ingestor/src/cli/ingestor.js \
  ./crossplane/xrds/ \
  --validate

if [ $? -ne 0 ]; then
  echo "XRD validation failed. Please fix errors before committing."
  exit 1
fi
```

### Makefile Integration

```makefile
# Makefile
PLUGIN_DIR := app-portal/plugins/kubernetes-ingestor
XRD_DIR := crossplane/xrds
TEMPLATE_DIR := backstage-templates

.PHONY: build-plugin
build-plugin:
	cd $(PLUGIN_DIR) && yarn build

.PHONY: generate-templates
generate-templates: build-plugin
	node $(PLUGIN_DIR)/src/cli/ingestor.js \
		$(XRD_DIR) \
		--output $(TEMPLATE_DIR) \
		--config config.yaml

.PHONY: validate-xrds
validate-xrds: build-plugin
	node $(PLUGIN_DIR)/src/cli/ingestor.js \
		$(XRD_DIR) \
		--validate

.PHONY: preview-templates
preview-templates: build-plugin
	node $(PLUGIN_DIR)/src/cli/ingestor.js \
		$(XRD_DIR) \
		--preview
```

## Troubleshooting

### Common Issues

#### Plugin Not Built

```
Error: Plugin not built. Please run "yarn build" first.
```

**Solution**: Build the plugin before using CLI:
```bash
cd app-portal/plugins/kubernetes-ingestor
yarn build
```

#### No XRDs Found

```
No XRDs found to process
```

**Causes**:
- Wrong file extension (must be `.yaml` or `.yml`)
- File doesn't contain `kind: CompositeResourceDefinition`
- Directory path is incorrect

#### Invalid XRD Structure

```
✗ databases.platform.io - Invalid:
  - No served versions found
  - Missing OpenAPI schema
```

**Solution**: Ensure XRD has:
- At least one version with `served: true`
- OpenAPI schema defined for parameters
- Valid Crossplane API version

#### Kubectl Context Issues

```
Failed to fetch XRDs from cluster: command not found: kubectl
```

**Solution**: Ensure kubectl is installed and configured:
```bash
kubectl config current-context
kubectl get xrds
```

### Debug Mode

Enable debug output for troubleshooting:

```bash
DEBUG=* node src/cli/ingestor.js ./xrd.yaml
```

## Advanced Usage

### Batch Processing Script

```bash
#!/bin/bash
# batch-process.sh

# Process XRDs from multiple sources
SOURCES=(
  "./team-a/xrds"
  "./team-b/xrds"
  "./platform/xrds"
)

for source in "${SOURCES[@]}"; do
  echo "Processing $source..."
  node src/cli/ingestor.js "$source" \
    --output "./templates/$(basename $source)" \
    --config ./config.yaml
done
```

### Validation Report

```bash
#!/bin/bash
# validate-all.sh

# Generate validation report
echo "XRD Validation Report" > validation-report.txt
echo "=====================" >> validation-report.txt
echo "" >> validation-report.txt

node src/cli/ingestor.js ./xrds/ --validate >> validation-report.txt 2>&1

# Check if any validation failed
if grep -q "✗" validation-report.txt; then
  echo "Validation failed for some XRDs"
  exit 1
fi
```

## Best Practices

1. **Always Validate First**: Run with `--validate` before generating templates
2. **Use Preview Mode**: Check what will be generated with `--preview`
3. **Version Control Config**: Keep configuration files in version control
4. **Automate Generation**: Integrate CLI into CI/CD pipelines
5. **Consistent Naming**: Use prefix/suffix configuration for consistent template names
6. **Document Annotations**: Ensure XRDs have proper Backstage annotations

## API Usage

The CLI can also be used programmatically:

```javascript
const { CLITransformer } = require('@terasky/backstage-plugin-kubernetes-ingestor/cli');

async function generateTemplates() {
  const transformer = new CLITransformer({
    includePublishing: true,
    templateNamePrefix: 'xrd-'
  });

  // Transform from file
  const templates = await transformer.transform('./xrd.yaml');
  
  // Validate XRD
  const validation = transformer.validate(xrdObject);
  
  // Preview transformation
  const preview = transformer.preview(xrdObject);
  
  return templates;
}
```

## Related Documentation

- [METADATA-FLOW.md](./METADATA-FLOW.md) - Complete transformation pipeline
- [API.md](./API.md) - Detailed API reference
- [TESTING.md](./TESTING.md) - Testing guide for transformers