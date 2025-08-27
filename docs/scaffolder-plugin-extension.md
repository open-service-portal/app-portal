# Scaffolder Plugin Extension - Custom Template Cards

## Overview

This document describes how we extended the Backstage scaffolder plugin to display version labels from Crossplane XRD metadata on template cards.

## Problem Statement

We needed to display `openportal.dev/version` labels from Crossplane XRD templates directly on the template cards in Backstage's `/create` page. For example, a template with version "1.0.2" should display as "DNSRecord v1.0.2" in the UI.

## Solution Architecture

### Approach: Local Plugin Copy with Minimal Modifications

After exploring various approaches, we implemented a solution using a local copy of the scaffolder plugin with minimal modifications:

1. **Local Plugin Copy** (`plugins/scaffolder/`)
   - Full copy of the Backstage scaffolder plugin
   - Renamed to `@internal/plugin-scaffolder` to avoid conflicts
   - Linked via Yarn workspaces

2. **CustomTemplateCard Component**
   - Extracts version from `openportal.dev/version` label
   - Modifies template title to include version
   - Adds XRD tags for Crossplane templates

3. **Router Integration**
   - Modified Router to use CustomTemplateCard as default
   - Fallback pattern ensures all templates use our custom card

## Implementation Details

### File Structure
```
plugins/scaffolder/
├── src/
│   ├── components/
│   │   ├── CustomTemplateCard.tsx  # New: Version display component
│   │   └── Router/
│   │       └── Router.tsx          # Modified: Uses CustomTemplateCard
│   └── internals/
│       └── index.ts                # New: Stub for experimental features
```

### Key Changes

#### 1. CustomTemplateCard Component
```typescript
// plugins/scaffolder/src/components/CustomTemplateCard.tsx
export const CustomTemplateCard = ({ template }) => {
  const version = template.metadata.labels?.['openportal.dev/version'];
  
  const modifiedTemplate = {
    ...template,
    metadata: {
      ...template.metadata,
      title: version 
        ? `${template.metadata.title || template.metadata.name} v${version.replace(/^v/, '')}`
        : template.metadata.title || template.metadata.name,
    },
  };
  
  return <TemplateCard template={modifiedTemplate} />;
};
```

#### 2. Router Modification
```typescript
// plugins/scaffolder/src/components/Router/Router.tsx
const FinalTemplateCardComponent = TemplateCardComponent || CustomTemplateCard;
```

#### 3. Package Configuration
- Updated package name to `@internal/plugin-scaffolder`
- Fixed dependency versions to match app requirements
- Added internals stub for experimental features

## Challenges and Learnings

### 1. Extension System Limitations

**Challenge:** Backstage's new frontend extension system (v1.42.0) has limitations with `PageBlueprint.makeWithOverrides`.

**Learning:** The extension system's inputs/outputs pattern doesn't reliably pass custom components through the scaffolder page blueprint. Direct modification of the plugin was more reliable.

### 2. Dependency Conflicts

**Challenge:** Nested dependencies caused "useEntityList must be used within EntityListProvider" errors.

**Solution:** Added Yarn resolutions to force consistent package versions:
```json
"resolutions": {
  "@backstage/plugin-catalog-react": "^1.14.5"
}
```

**Learning:** Yarn workspaces can create duplicate React contexts when packages have nested dependencies. Always check for nested node_modules folders.

### 3. API Blueprint Changes

**Challenge:** ApiBlueprint structure changed between Backstage versions.

**Learning:** The scaffolder API requires callback form for parameters:
```typescript
ApiBlueprint.make({
  params: defineParams => defineParams({ /* ... */ })
})
```

### 4. Import Path Issues

**Challenge:** Internal imports failed with "@internal/scaffolder" references.

**Solution:** Created stub implementations and updated imports to use relative paths.

## Maintenance Considerations

### Pros of This Approach
- Full control over template card rendering
- Minimal changes to core functionality
- Easy to extend with additional features
- Clear separation from upstream Backstage

### Cons of This Approach
- Requires maintaining a plugin copy
- Manual updates when upgrading Backstage
- Potential for version drift with upstream

### Future Improvements
1. **Upstream Contribution:** Consider contributing a template card customization API to Backstage
2. **Plugin Isolation:** Extract only the necessary components instead of copying the entire plugin
3. **Extension API:** Monitor Backstage development for improved extension APIs

## Troubleshooting

### Common Issues

1. **Build Errors with Missing Exports**
   - Check if experimental features need stub implementations
   - Verify all imports use correct paths (relative vs package)

2. **Duplicate React Context Errors**
   - Check for nested node_modules: `ls node_modules/@backstage/*/node_modules`
   - Add resolutions to root package.json
   - Clean and reinstall: `rm -rf node_modules && yarn install`

3. **Version Mismatch Errors**
   - Ensure frontend-plugin-api versions match across packages
   - Check that all Backstage packages use compatible versions

### Debug Commands
```bash
# Check for nested dependencies
ls node_modules/@backstage/plugin-scaffolder-react/node_modules

# Verify package resolutions
yarn why @backstage/plugin-catalog-react

# Clean Yarn cache and reinstall
rm -rf node_modules/.yarn-state.yml && yarn install
```

## Version Compatibility

Tested with:
- Backstage: v1.42.0
- Frontend System: New Frontend System
- Node.js: v20
- Yarn: v4.4.1

## Summary

The custom scaffolder plugin approach provides a pragmatic solution for displaying version labels on template cards. While it requires maintaining a local plugin copy, it offers complete control over the template card rendering and has proven stable in production use.

The key insight is that sometimes a direct modification is more maintainable than complex workarounds with an evolving extension system. This approach balances customization needs with maintainability concerns.