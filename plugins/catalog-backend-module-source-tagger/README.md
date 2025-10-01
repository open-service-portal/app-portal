# Catalog Backend Module: Source Tagger

A Backstage 1.42+ compatible backend module that automatically adds metadata tags to catalog entities based on their import source.

## Compatibility

- **Backstage Version**: 1.42.0+
- **Backend System**: New Backend System
- **Module Type**: Catalog Processor Module

## Features

Automatically adds tags to Templates and other entities:

**Source Tags (technical only):**
- `source:file` - for local file-based templates
- `source:github-discovered` - for entities discovered via GitHub discovery
- `source:github-url` - for entities imported via direct GitHub URLs
- `source:kubernetes-ingestor` - added by kubernetes-ingestor plugin (not by this processor)

**Additional Tags:**
- `org:<orgname>` - organization tags extracted from GitHub URLs
- `official` - for entities from the open-service-portal organization

Also adds annotations:
- `backstage.io/source-location` - the original import location (only for URL-based imports, not for kubernetes-ingestor)
- `backstage.io/discovered-at` - timestamp when the entity was discovered

## Installation

### 1. Add the module to your backend

```typescript
// packages/backend/src/index.ts
import { createBackend } from '@backstage/backend-defaults';

const backend = createBackend();

// ... other plugins

backend.add(import('@backstage/plugin-catalog-backend'));
backend.add(import('../../plugins/catalog-backend-module-source-tagger')); // Add this line

backend.start();
```

### 2. Configuration (Optional)

```yaml
# app-config.yaml
catalog:
  processors:
    sourceTagger:
      enabled: true  # Default: true, set to false to disable
```

## How it works

The `SourceTagProcessor` implements the Backstage `CatalogProcessor` interface and:
1. Examines the location spec of each entity being imported
2. Determines the source based on location type and URL patterns
3. Adds appropriate tags without modifying existing ones
4. Logs tag additions for debugging (when logger is in debug mode)
5. Removes duplicate tags in post-processing

### Location Types Handled

- **URL-based locations** (e.g., `url:https://github.com/...`):
  - Sets `backstage.io/source-location` annotation
  - Adds source tags like `source:github-discovered` or `source:github-url`
  - Extracts organization tags from URLs

- **Kubernetes-ingestor locations** (e.g., `cluster origin: rancher-desktop`):
  - Does NOT set `backstage.io/source-location` (prevents scaffolder errors)
  - Source tags handled by kubernetes-ingestor plugin itself
  - Only adds `backstage.io/discovered-at` timestamp

### Technical Implementation

- **Processor**: `SourceTagProcessor` class implementing `CatalogProcessor`
- **Module**: Uses `createBackendModule` (New Backend System)
- **Dependencies**: 
  - `catalogProcessingExtensionPoint` - to register the processor
  - `coreServices.logger` - for logging
  - `coreServices.rootConfig` - for configuration
- **Hooks**: `preProcessEntity` and `postProcessEntity`

## Extending

### Adding Custom Tagging Rules

Modify the `SourceTagProcessor.ts` file:

```typescript
// Add custom organization tags
if (org === 'your-org') {
  tags.add('your-custom-tag');
}

// Add tags based on location type
if (location.type === 'gitlab-discovery') {
  tags.add('source:gitlab-discovered');
}
```

### Creating Your Own Module

To create a similar module for your own use case:

```bash
# From your Backstage project root
yarn new
# Select: backend-module
# Plugin ID: catalog
# Module ID: your-processor-name
```

## Why not hardcode tags?

Hardcoding `source:github-discovered` in each template.yaml file:
- Requires manual maintenance
- Can be forgotten when creating new templates
- Doesn't scale well
- Can't be changed retroactively

With this processor:
- Tags are added automatically
- Consistent across all imports
- Can be changed centrally
- Works for future templates without modification

## Debugging

Enable debug logging to see when tags are added:

```yaml
# app-config.yaml
backend:
  logger:
    catalog: debug
```

Then check the logs:
```
[catalog] Added tags to Template:service-nodejs-template: source:github-discovered, org:open-service-portal
```

## Architecture

This module follows the Backstage 1.42+ New Backend System architecture:

```
Backend
  ├── Catalog Plugin
  │   ├── Processing Pipeline
  │   │   └── SourceTagProcessor (this module)
  │   └── Extension Points
  │       └── catalogProcessingExtensionPoint
  └── Core Services
      ├── Logger Service
      └── Config Service
```

## License

Apache 2.0