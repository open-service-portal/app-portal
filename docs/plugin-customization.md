# Backstage Plugin Customization Guide

This guide explains how to customize Backstage plugins in the app-portal, using the same patterns as the core Backstage team.

## Overview

Backstage plugins can be customized in several ways:
1. **Custom Actions** - Adding new scaffolder actions (like our `generateId` action)
2. **Custom Providers** - Extending entity providers to customize how resources are discovered
3. **Custom Modules** - Creating backend modules that replace or extend plugin functionality
4. **Component Overrides** - Replacing frontend components with custom implementations

## Folder Structure

The app-portal follows Backstage's recommended structure for customizations:

```
packages/backend/src/
├── index.ts                    # Main backend entry point
├── scaffolder/                 # Custom scaffolder actions
│   ├── index.ts               # Module definition
│   └── generateId.ts          # Custom action implementation
└── kubernetes-ingestor/        # Custom kubernetes ingestor (example)
    ├── index.ts               # Module definition  
    └── customXRDTemplateEntityProvider.ts  # Custom provider logic
```

## Pattern 1: Custom Scaffolder Actions

The scaffolder folder demonstrates how to add custom actions to the Backstage scaffolder.

### Implementation

1. **Create the action** (`scaffolder/generateId.ts`):
```typescript
import { createTemplateAction } from '@backstage/plugin-scaffolder-node';

export function createGenerateIdAction() {
  return createTemplateAction<{ prefix?: string }>({
    id: 'portal:utils:generateId',
    description: 'Generates a unique ID',
    async handler(ctx) {
      const { prefix = 'id' } = ctx.input;
      const id = `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      ctx.output('id', id);
    },
  });
}
```

2. **Create the module** (`scaffolder/index.ts`):
```typescript
import { createBackendModule } from '@backstage/backend-plugin-api';
import { scaffolderActionsExtensionPoint } from '@backstage/plugin-scaffolder-node/alpha';
import { createGenerateIdAction } from './generateId';

const scaffolderModuleCustomActions = createBackendModule({
  pluginId: 'scaffolder',
  moduleId: 'custom-actions',
  register(reg) {
    reg.registerInit({
      deps: {
        scaffolder: scaffolderActionsExtensionPoint,
      },
      async init({ scaffolder }) {
        scaffolder.addActions(
          createGenerateIdAction()
        );
      },
    });
  },
});

export default scaffolderModuleCustomActions;
```

3. **Register in backend** (`index.ts`):
```typescript
// Custom scaffolder actions
backend.add(import('./scaffolder'));
```

## Pattern 2: Extending Entity Providers

When you need to customize how entities are discovered or created (like XRDs from Kubernetes), you can extend entity providers.

### Challenge: Working with Compiled Packages

Many Backstage plugins (including Terasky plugins) are distributed as compiled JavaScript without TypeScript source files. This makes direct class extension challenging.

### Solutions

#### Option 1: Fork and Customize (Recommended for Major Changes)

1. Fork the plugin repository
2. Modify the source code directly
3. Publish to your own npm registry or use git dependencies
4. Import your customized version

```json
// package.json
{
  "dependencies": {
    "@your-org/backstage-plugin-kubernetes-ingestor": "1.0.0"
  }
}
```

#### Option 2: Wrapper Pattern (For Minor Changes)

Create a wrapper that intercepts and modifies the provider's behavior:

```typescript
// kubernetes-ingestor/wrapperProvider.ts
export class WrapperXRDProvider implements EntityProvider {
  private innerProvider: any;
  
  constructor(config: Config, logger: Logger) {
    // Use the original provider internally
    this.innerProvider = new OriginalProvider(config, logger);
  }
  
  async connect(connection: EntityProviderConnection) {
    // Intercept the connection
    const wrappedConnection = {
      ...connection,
      applyMutation: async (mutation: any) => {
        // Modify entities before they're saved
        const modifiedMutation = {
          ...mutation,
          entities: mutation.entities.map(this.transformEntity),
        };
        return connection.applyMutation(modifiedMutation);
      },
    };
    return this.innerProvider.connect(wrappedConnection);
  }
  
  private transformEntity(entity: any) {
    // Your custom transformation logic
    return entity;
  }
}
```

#### Option 3: Side-by-Side Implementation

Run your custom provider alongside the original:

```typescript
// kubernetes-ingestor/index.ts
const kubernetesIngestorModule = createBackendModule({
  pluginId: 'catalog',
  moduleId: 'custom-xrd-provider',
  register(reg) {
    reg.registerInit({
      deps: {
        catalog: catalogProcessingExtensionPoint,
        // ... other deps
      },
      async init({ catalog, config, logger }) {
        // Add your custom provider
        const customProvider = new CustomXRDProvider(config, logger);
        catalog.addEntityProvider(customProvider);
        
        // The original Terasky provider runs separately
      },
    });
  },
});
```

## Pattern 3: Custom Kubernetes Ingestor Example

Here's the structure we created for customizing XRD template generation:

### Files Created

1. **`kubernetes-ingestor/customXRDTemplateEntityProvider.ts`**
   - Contains the `translateXRDVersionsToTemplates` function
   - Implements custom logic for converting XRDs to Backstage templates
   - Enhances parameters, tags, and metadata

2. **`kubernetes-ingestor/index.ts`**
   - Creates a backend module for the catalog plugin
   - Would normally extend the Terasky provider (if source was available)
   - Registers with the catalog processing extension point

### Key Customizations Made

- **Better Template Names**: `crossplane-{resource}-{version}` format
- **Enhanced Tags**: Scope information, resource groups, cluster tags
- **Improved Parameters**:
  - Owner/System pickers with catalog integration
  - Namespace field for namespaced resources  
  - Labels and annotations with key-value widgets
  - Smart schema extraction from OpenAPI specs
- **Better UX**: Auto-focus, help text, validation patterns

## Best Practices

### 1. Module Naming

Follow Backstage conventions:
- Module ID: `{plugin}-{feature}` (e.g., `scaffolder-custom-actions`)
- Folder name: Match the plugin being customized

### 2. Configuration

Use the existing plugin's configuration namespace:
```yaml
# app-config.yaml
kubernetesIngestor:
  annotationPrefix: 'custom.backstage.io'  # Your custom config
  # Original plugin config still works
  crossplane:
    enabled: true
```

### 3. Logging

Always use the provided logger:
```typescript
logger.info('Custom provider initialized');
logger.debug(`Processing entity: ${entity.metadata.name}`);
logger.error('Failed to process entity', error);
```

### 4. Testing

Create unit tests for your customizations:
```typescript
// scaffolder/generateId.test.ts
describe('generateId action', () => {
  it('should generate unique IDs', async () => {
    const action = createGenerateIdAction();
    const context = createMockActionContext({ input: { prefix: 'test' } });
    await action.handler(context);
    expect(context.output).toHaveBeenCalledWith('id', expect.stringMatching(/^test-/));
  });
});
```

## Limitations and Workarounds

### NPM Package Limitations

When working with compiled npm packages:
- Source TypeScript files are not available
- Can't directly extend classes
- Type definitions may be incomplete

### Workarounds

1. **Use the Fork**: Work with the backstage-terasky-plugins-fork in the workspace
2. **Request Source Access**: Contact plugin maintainers for source code
3. **Runtime Patching**: Modify prototypes at runtime (not recommended)
4. **Contribute Upstream**: Submit PRs to make plugins more extensible

## Current Customizations in app-portal

### Active Customizations

1. **Scaffolder Custom Actions** (`/scaffolder`)
   - `portal:utils:generateId` - Generates unique IDs for resources
   - Status: ✅ Active and working

2. **Template Page** (`/packages/app/src/components/catalog/EntityPage.tsx`)
   - Added support for `kind: Template` entities
   - Custom layout for template entities
   - Status: ✅ Active and working

### Planned Customizations

1. **Kubernetes Ingestor** (`/kubernetes-ingestor`)
   - Custom XRD to template translation
   - Enhanced parameter generation
   - Status: ⏸️ Prepared but not active (needs source code access)

## Troubleshooting

### Common Issues

1. **"Class extends value undefined"**
   - Cause: Trying to extend a class that's not exported
   - Solution: Use wrapper pattern or fork the plugin

2. **"Module not found"**
   - Cause: Trying to import from source files in compiled package
   - Solution: Import from the package root or check exports

3. **"Cannot find extension point"**
   - Cause: Extension point not available in the version you're using
   - Solution: Check plugin documentation for correct import

### Debug Tips

1. Check available exports:
```bash
# See what's exported from a package
ls -la node_modules/@terasky/backstage-plugin-kubernetes-ingestor/
cat node_modules/@terasky/backstage-plugin-kubernetes-ingestor/package.json | grep -A5 '"exports"'
```

2. Enable debug logging:
```yaml
# app-config.yaml
backend:
  logger:
    level: debug
```

3. Use source maps:
```typescript
// tsconfig.json
{
  "compilerOptions": {
    "sourceMap": true
  }
}
```

## References

- [Backstage Backend System](https://backstage.io/docs/backend-system/)
- [Creating Backend Plugins](https://backstage.io/docs/plugins/backend-plugin)
- [Custom Scaffolder Actions](https://backstage.io/docs/features/software-templates/writing-custom-actions)
- [Entity Providers](https://backstage.io/docs/features/software-catalog/external-integrations)

## Future Improvements

1. **Type-Safe Customizations**: Create TypeScript interfaces for all customizations
2. **Plugin SDK**: Build a shared SDK for common customization patterns
3. **Dynamic Loading**: Implement dynamic plugin loading for easier customization
4. **Configuration UI**: Add UI for configuring plugin behavior without code changes