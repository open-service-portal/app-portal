# Local Development Guide

This guide explains how to work with local plugin development in this Backstage application.

## Switching Between npm Package and Local Plugin

The app-portal can use either the published npm package or a local development version of the ingestor plugin.

### Using npm Package (Default)

This is the default configuration and recommended for most users:

```json
// packages/backend/package.json
{
  "dependencies": {
    "@open-service-portal/backstage-plugin-ingestor": "^1.0.0"
  }
}
```

```typescript
// packages/backend/src/index.ts
backend.add(import('@open-service-portal/backstage-plugin-ingestor'));
```

### Switching to Local Plugin for Development

If you're developing the ingestor plugin itself:

**1. Clone the plugin into the workspace:**
```bash
cd /path/to/portal-workspace
git clone https://github.com/open-service-portal/ingestor.git
```

**2. Link the local plugin in package.json:**
```json
// packages/backend/package.json
{
  "dependencies": {
    "@internal/plugin-ingestor": "link:../../plugins/ingestor"
  }
}
```

**Note:** You'll need to **remove** the npm package line when using local development:
```diff
- "@open-service-portal/backstage-plugin-ingestor": "^1.0.0",
+ "@internal/plugin-ingestor": "link:../../plugins/ingestor",
```

**3. Update the import in index.ts:**
```typescript
// packages/backend/src/index.ts
backend.add(import('@internal/plugin-ingestor'));
```

**4. Install dependencies:**
```bash
yarn install
```

**5. Build the plugin:**
```bash
cd ../../ingestor
yarn build
cd ../../app-portal
```

**6. Start Backstage:**
```bash
yarn start
```

### Why Can't We Use Comments for Switching?

Unlike TypeScript files, **JSON does not support comments**. This means we cannot have both lines present with one commented out like we originally tried:

```json
// ❌ This doesn't work - JSON doesn't support comments!
{
  "dependencies": {
    "@open-service-portal/backstage-plugin-ingestor": "^1.0.0",
    // "@internal/plugin-ingestor": "link:../../plugins/ingestor"
  }
}
```

Instead, you must **manually replace** the dependency line when switching between npm package and local development.

### Git Workflow Recommendation

When working on plugin development:

1. **Create a feature branch**
2. **Make plugin changes**
3. **Switch to local plugin** (update package.json)
4. **Test locally**
5. **Before committing**, revert package.json back to npm package
6. **Push plugin changes** to the plugin repository
7. **Update app-portal** to use new plugin version

### Automated Switching (Advanced)

You can create a script to switch between modes:

```bash
# scripts/use-local-plugin.sh
#!/bin/bash
# Switch to local plugin development

# Update package.json
sed -i.bak 's|"@open-service-portal/backstage-plugin-ingestor".*|"@internal/plugin-ingestor": "link:../../plugins/ingestor",|' \
  packages/backend/package.json

# Update index.ts
sed -i.bak "s|import('@open-service-portal/backstage-plugin-ingestor')|import('@internal/plugin-ingestor')|" \
  packages/backend/src/index.ts

echo "✓ Switched to local plugin development"
echo "Run: yarn install"
```

```bash
# scripts/use-npm-package.sh
#!/bin/bash
# Switch back to npm package

# Update package.json
sed -i.bak 's|"@internal/plugin-ingestor".*|"@open-service-portal/backstage-plugin-ingestor": "^1.0.0",|' \
  packages/backend/package.json

# Update index.ts
sed -i.bak "s|import('@internal/plugin-ingestor')|import('@open-service-portal/backstage-plugin-ingestor')|" \
  packages/backend/src/index.ts

echo "✓ Switched to npm package"
echo "Run: yarn install"
```

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
