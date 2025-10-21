# Local Development Guide

This guide explains how to work with local plugin development in this Backstage application.

## Switching Between npm Package and Local Plugin

The app-portal can use either the published npm package or a local development version of the ingestor plugin.

### Using npm Package (Default)

This is the default configuration and recommended for most users:

```typescript
// packages/backend/src/index.ts
backend.add(import('@open-service-portal/backstage-plugin-ingestor'));
```

### Switching to Local Plugin for Development

If you're developing the ingestor plugin itself:

**1. Clone the plugin into the workspace:**
```bash
cd /path/to/portal-workspace
git clone https://github.com/open-service-portal/ingestor.git plugins/ingestor
```

**2. Update the import in index.ts:**
```typescript
// packages/backend/src/index.ts
backend.add(import('@internal/plugin-ingestor'));
```

**3. Install dependencies:**
```bash
yarn install
```

**4. Build the plugin:**
```bash
cd ../../plugins/ingestor
yarn build
cd ../../app-portal
```

**5. Start Backstage:**
```bash
yarn start
```

### How This Works

Both dependencies are present in `package.json`:

```json
{
  "dependencies": {
    "@internal/plugin-ingestor": "link:../../plugins/ingestor",
    "@open-service-portal/backstage-plugin-ingestor": "^1.0.0"
  }
}
```

**Key points:**
- ✅ Yarn allows `link:` dependencies to non-existent paths without failing
- ✅ Only the import used in `index.ts` actually loads
- ✅ No need to edit `package.json` when switching
- ✅ Just comment/uncomment the appropriate line in `index.ts`

### Git Workflow Recommendation

When working on plugin development:

1. **Create a feature branch**
2. **Make plugin changes** in the ingestor repository
3. **Switch to local plugin** (comment/uncomment in `index.ts`)
4. **Test locally**
5. **Before committing**, ensure `index.ts` uses npm package (default)
6. **Push plugin changes** to the plugin repository
7. **Update app-portal** to use new plugin version (if needed)

## Template Customization Workflow

For customizing ingestor templates (different from plugin development):

```bash
# 1. Initialize custom templates
yarn ingestor:init

# 2. Configure template directory
# Add to app-config/ingestor.yaml:
ingestor:
  crossplane:
    xrds:
      templateDir: './ingestor-templates'

# 3. Customize templates
vim ingestor-templates/backstage/default.hbs

# 4. Test
yarn start
```

This workflow uses the **npm package** and only customizes the **templates**, not the plugin code itself.

## See Also

- [Template Customization](./docs/crossplane-ingestor.md#template-customization)
- [Ingestor Plugin Documentation](https://github.com/open-service-portal/ingestor)
