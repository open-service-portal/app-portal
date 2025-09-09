# backstage-plugin-kubernetes-ingestor

Welcome to the backstage-plugin-kubernetes-ingestor backend plugin!

[![npm latest version](https://img.shields.io/npm/v/@terasky/backstage-plugin-kubernetes-ingestor/latest.svg)](https://www.npmjs.com/package/@terasky/backstage-plugin-kubernetes-ingestor)

The `@terasky/backstage-plugin-kubernetes-ingestor` backend plugin for Backstage is a catalog entity provider that creates catalog entities directly from Kubernetes resources. It has the ability to ingest by default all standard Kubernetes workload types, allows supplying custom GVKs, and has the ability to auto-ingest all Crossplane claims automatically as components. There are numerous annotations which can be put on the Kubernetes workloads to influence the creation of the component in Backstage. It also supports creating Backstage templates and registers them in the catalog for every XRD in your cluster for the Claim resource type. Currently, this supports adding via a PR to a GitHub/GitLab/Bitbucket/BitbucketCloud repo or providing a download link to the generated YAML without pushing to git. The plugin also generates API entities for all XRDs and defines the dependencies and relationships between all claims and the relevant APIs for easy discoverability within the portal.

For detailed docs go to https://terasky-oss.github.io/backstage-plugins/plugins/kubernetes-ingestor/overview

## Architecture

### Modular Transformer System (Refactored 2025)

The plugin has been refactored from a monolithic 2,602-line EntityProvider to a modular architecture with an 87% code reduction:

```
src/
├── provider/                   # Entity providers (329 lines, was 2,602)
│   ├── XRDTemplateEntityProvider.ts  # Refactored provider
│   ├── XrdDataProvider.ts     # XRD fetching logic
│   └── CRDDataProvider.ts     # CRD fetching logic
├── transformers/               # Core transformation logic
│   ├── XRDTransformer.ts      # Main orchestrator
│   ├── CrossplaneDetector.ts  # Version and scope detection
│   ├── ParameterExtractor.ts  # OpenAPI to form parameters
│   ├── StepGeneratorV1.ts     # v1 XRD steps (claims)
│   ├── StepGeneratorV2.ts     # v2 XRD steps (direct XRs)
│   ├── TemplateBuilder.ts     # Template assembly
│   └── ApiEntityBuilder.ts    # API entity generation (NEW)
├── types/                      # Type definitions
│   ├── xrd.types.ts           # Crossplane XRD types
│   ├── template.types.ts      # Backstage template types
│   ├── api.types.ts           # API entity types (NEW)
│   └── config.types.ts        # Configuration types
├── cli/                        # CLI for standalone usage
│   ├── index.ts               # CLI transformer interface
│   ├── ingestor.js            # Transform XRDs to entities
│   └── export.js              # Export from Backstage (NEW)
└── tests/                      # Comprehensive test suite (NEW)
    ├── provider/              # Provider tests
    ├── transformers/          # Transformer tests
    └── integration/           # End-to-end tests

```

### Key Components

- **XRDTransformer**: Main orchestrator that coordinates all transformation steps
- **CrossplaneDetector**: Detects Crossplane version (v1/v2) and resource scope
- **ParameterExtractor**: Converts OpenAPI schemas to Backstage form parameters
- **StepGeneratorV1/V2**: Version-specific step generation for scaffolder
- **TemplateBuilder**: Assembles final Backstage templates with metadata
- **ApiEntityBuilder**: Generates API entities with OpenAPI specs (NEW)
- **CLITransformer**: Enables standalone transformation outside Backstage

### Refactoring Benefits

- **87% Code Reduction**: From 2,602 to 329 lines in main provider
- **53% Smaller Output**: Generated templates are more concise
- **Dual Entity Generation**: Now creates both Templates and API entities
- **Better Testability**: Modular design with comprehensive test coverage
- **CLI Tools**: Standalone transformation and export utilities

## CLI Usage

The plugin includes CLI tools for transforming XRDs and exporting entities:

### Installation

```bash
# From the plugin directory
yarn build

# Use wrapper scripts from portal-workspace
./scripts/template-ingest.sh --help  # Transform XRDs
./scripts/template-export.sh --help  # Export from Backstage
```

### Transform XRDs to Entities

```bash
# Transform a single XRD file
./scripts/template-ingest.sh ./xrd.yaml -o ./output

# Transform with custom config
./scripts/template-ingest.sh ./xrd.yaml --config ./config.yaml

# Preview without writing files
./scripts/template-ingest.sh ./xrd.yaml --preview
```

### Export Entities from Backstage

```bash
# Export all templates and APIs
./scripts/template-export.sh -o ./exported

# Export specific template by pattern
./scripts/template-export.sh -k template -p "database" -o ./templates

# Export from custom Backstage URL
./scripts/template-export.sh -u http://backstage:7007 -o ./exported
```

### Template Ingest Options

- `--output, -o <dir>` - Output directory (default: ./output)
- `--preview, -p` - Preview mode without writing files
- `--validate, -v` - Validate XRDs only
- `--config, -c <file>` - Custom configuration file
- `--format, -f <type>` - Output format: yaml, json (default: yaml)

### Template Export Options

- `--output, -o <dir>` - Output directory (default: ./exported)
- `--url, -u <url>` - Backstage URL (default: http://localhost:7007)
- `--token, -t <token>` - API token (or set BACKSTAGE_TOKEN env)
- `--kind, -k <kind>` - Entity kind: template, api, all (default: all)
- `--pattern, -p <name>` - Name pattern to match

## Documentation

- [METADATA-FLOW.md](docs/METADATA-FLOW.md) - Complete information flow from XRD to Backstage template
- [REFACTORING-SUMMARY.md](docs/REFACTORING-SUMMARY.md) - Details of the 2025 refactoring
- [ENTITY-STORAGE-ANALYSIS.md](../../template-namespace/docs/backstage-templates/ENTITY-STORAGE-ANALYSIS.md) - How entities are stored and accessed
- [COMPARISON-REPORT.md](../../template-namespace/docs/backstage-templates/COMPARISON-REPORT.md) - Original vs refactored output comparison

## Contributing

Contributions are welcome! Please open an issue or submit a pull request on GitHub.

## License

This project is licensed under the Apache-2.0 License.