# Catalog Backend Module: Location Fixer

Custom Backstage catalog processor module that ensures all location-related annotations have the required `url:` prefix.

## Problem

The GitHub catalog provider sometimes sets location annotations without the `url:` prefix:

```json
{
  "backstage.io/source-location": "https://github.com/org/repo/tree/main/template.yaml"
}
```

The Scaffolder backend requires the `url:` prefix when parsing location references:

```json
{
  "backstage.io/source-location": "url:https://github.com/org/repo/tree/main/template.yaml"
}
```

Without this prefix, template execution fails with:

```
Invalid location ref 'https://github.com/...', please prefix it with 'url:'
```

## Solution

This module registers a `CatalogProcessor` that automatically adds the `url:` prefix to location annotations **after** the GitHub provider has set them.

## Annotations Fixed

The processor fixes the following annotations:

- `backstage.io/managed-by-location`
- `backstage.io/managed-by-origin-location`
- `backstage.io/source-location`
- `backstage.io/view-url`
- `backstage.io/edit-url`

## Installation

The module is already registered in `packages/backend/src/index.ts`:

```typescript
backend.add(import('../../../plugins/catalog-backend-module-location-fixer/src/index.ts'));
```

## How It Works

1. GitHub provider imports template and sets annotations **without** `url:` prefix
2. This processor runs during entity preprocessing
3. Detects HTTP(S) URLs in location annotations
4. Adds `url:` prefix if missing
5. Entity is stored in catalog with corrected annotations
6. Scaffolder backend can now successfully parse the location references

## Logging

The processor logs its activity:

- **DEBUG**: Individual annotation fixes
- **INFO**: Summary when any annotation was fixed

## Testing

To verify the processor is working:

1. Import a template from GitHub
2. Check the entity annotations in the catalog API:
   ```bash
   curl http://localhost:7007/api/catalog/entities/by-name/template/default/your-template
   ```
3. All location annotations should have `url:` prefix
4. Template execution should work without location ref errors

## Development

The processor is implemented in:

- `src/processor/LocationAnnotationFixer.ts` - Processor implementation
- `src/module.ts` - Backend module registration
- `src/index.ts` - Module exports
