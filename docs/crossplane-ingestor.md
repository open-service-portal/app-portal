# Crossplane Ingestor Plugin

The Crossplane Ingestor is an advanced Backstage plugin that discovers Crossplane XRDs from Kubernetes clusters and transforms them into Backstage template entities.

## Overview

This plugin is a complete rewrite of the kubernetes-ingestor with enhanced capabilities specifically for Crossplane:

- **16,000+ lines** of production-ready code
- **Comprehensive test suite** with unit and integration tests
- **CLI tools** for debugging and testing
- **Advanced transformation pipeline** for XRD to template conversion
- **Multi-cluster support** with caching

## Architecture

```
Kubernetes Cluster          Crossplane Ingestor              Backstage Catalog
┌──────────────┐           ┌──────────────────┐            ┌──────────────┐
│              │           │                  │            │              │
│  XRDs        │◀──────────│ DataProvider     │            │  Templates   │
│              │  Discover │                  │  Generate  │              │
│  Compositions│           │ Transformers     │───────────▶│  APIs        │
│              │           │                  │            │              │
│  XRs         │           │ CLI Tools        │            │  Resources   │
│              │           │                  │            │              │
└──────────────┘           └──────────────────┘            └──────────────┘
```

## Installation

The plugin is already included in this app-portal. It's located at:
```
plugins/crossplane-ingestor/
```

## Configuration

Configure in `app-config/ingestor.yaml`:

```yaml
crossplaneIngestor:
  enabled: true
  
  # Default metadata
  defaultOwner: platform-team
  defaultSystem: crossplane
  
  # Discovery schedule
  schedule:
    frequency: { minutes: 5 }
    timeout: { minutes: 2 }
  
  # Cluster configuration
  clusters:
    - name: local
      url: ${KUBERNETES_API_URL}
      authProvider: serviceAccount
      serviceAccountToken: ${KUBERNETES_SA_TOKEN}
  
  # XRD filters
  xrdFilters:
    labelSelector: "openportal.dev/ingest=true"
    groups:
      - platform.io
      - infrastructure.io
  
  # Template generation
  templateGeneration:
    generateApiEntities: true
    includeCompositionDetails: true
    defaultNamespace: default
```

## CLI Tools

The plugin includes powerful CLI tools for testing:

### Discover XRDs
```bash
cd plugins/crossplane-ingestor
yarn cli discover --cluster local
```

### Transform XRD to Template
```bash
yarn cli transform --xrd ./xrd.yaml --output ./template.yaml
```

### Export All Entities
```bash
yarn cli export --cluster local --output ./catalog/
```

### Validate XRD
```bash
yarn cli validate --xrd ./xrd.yaml
```

## Project Structure

```
plugins/crossplane-ingestor/
├── src/
│   ├── auth/                    # Authentication providers
│   ├── cli/                     # CLI tools
│   │   ├── index.ts            # CLI entry point
│   │   ├── ingestor.js         # Main CLI script
│   │   └── export.js           # Export utility
│   ├── provider/               # Data providers
│   │   ├── KubernetesDataProvider.ts
│   │   ├── XrdDataProvider.ts
│   │   ├── CRDDataProvider.ts
│   │   └── XRDTemplateEntityProvider.ts
│   ├── transformers/           # XRD transformers
│   │   ├── XRDTransformer.ts
│   │   ├── TemplateBuilder.ts
│   │   ├── ApiEntityBuilder.ts
│   │   ├── ParameterExtractor.ts
│   │   ├── StepGenerator.ts
│   │   └── CrossplaneDetector.ts
│   ├── types/                  # TypeScript types
│   └── utils/                  # Utilities
├── tests/                      # Test suite
│   ├── integration/            # Integration tests
│   ├── transformers/           # Unit tests
│   └── helpers/               # Test fixtures
└── docs/                      # Documentation
    ├── CLI-USAGE.md
    ├── DEVELOPER-GUIDE.md
    ├── METADATA-FLOW.md
    └── XRD_INGESTION.md
```

## Key Features

### 1. XRD Discovery
- Discovers XRDs from multiple clusters
- Filters by labels, annotations, and groups
- Caches results for performance

### 2. Template Generation
- Converts XRD schemas to Backstage form parameters
- Generates scaffolder actions for XR creation
- Supports complex nested schemas

### 3. API Entity Creation
- Documents infrastructure APIs
- Generates OpenAPI specifications
- Links to source XRDs

### 4. Composition Tracking
- Maps XRDs to Compositions
- Shows implementation details
- Tracks dependencies

### 5. Multi-Cluster Support
- Connects to multiple clusters
- Aggregates resources
- Handles different auth methods

## XRD Requirements

For XRDs to be discovered and processed:

### Required Labels
```yaml
metadata:
  labels:
    openportal.dev/ingest: "true"  # Required for discovery
```

### Recommended Annotations
```yaml
metadata:
  annotations:
    backstage.io/title: "PostgreSQL Database"
    backstage.io/description: "Managed PostgreSQL instance"
    backstage.io/owner: "platform-team"
    backstage.io/tags: "database,postgresql,rds"
```

### Schema Requirements
- Must have OpenAPI v3 schema
- Should include descriptions
- Should set defaults where appropriate

## Development

### Running Tests
```bash
cd plugins/crossplane-ingestor
yarn test                # Unit tests
yarn test:integration    # Integration tests
```

### Debugging
```bash
# Enable debug logging
export DEBUG=crossplane-ingestor:*
yarn start
```

### Building
```bash
yarn build
```

## Transformation Pipeline

```
XRD → CrossplaneDetector → ParameterExtractor → TemplateBuilder → Template Entity
                        ↘                    ↗
                          StepGenerator
```

1. **CrossplaneDetector**: Identifies Crossplane version and features
2. **ParameterExtractor**: Extracts form parameters from schema
3. **StepGenerator**: Creates scaffolder actions
4. **TemplateBuilder**: Assembles final template entity

## Comparison with kubernetes-ingestor

| Feature | kubernetes-ingestor | crossplane-ingestor |
|---------|-------------------|-------------------|
| Lines of Code | ~500 | 16,000+ |
| Tests | Basic | Comprehensive |
| CLI Tools | No | Yes |
| API Entities | No | Yes |
| Composition Tracking | No | Yes |
| Caching | Basic | Advanced |
| Documentation | Basic | Extensive |

## Troubleshooting

### XRDs Not Discovered
1. Check label selector matches XRDs
2. Verify cluster connectivity
3. Check RBAC permissions

### Templates Not Generated
1. Verify XRD has valid schema
2. Check transformation logs
3. Validate with CLI tool

### Performance Issues
1. Enable caching in config
2. Increase discovery interval
3. Filter unnecessary XRDs

## Migration from kubernetes-ingestor

1. **Enable both plugins** initially
2. **Configure filters** to avoid duplication
3. **Test with subset** of XRDs
4. **Gradually migrate** using labels
5. **Disable kubernetes-ingestor** when complete

## Documentation

Detailed documentation available in:
- `plugins/crossplane-ingestor/docs/CLI-USAGE.md` - CLI tool guide
- `plugins/crossplane-ingestor/docs/DEVELOPER-GUIDE.md` - Development guide
- `plugins/crossplane-ingestor/docs/METADATA-FLOW.md` - Metadata processing
- `plugins/crossplane-ingestor/docs/XRD_INGESTION.md` - Ingestion process

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review test files for examples
3. Use CLI tools for debugging
4. Check logs with DEBUG enabled