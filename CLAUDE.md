# CLAUDE.md - app-portal

This file provides guidance to Claude Code when working with the app-portal Backstage application.

**🆕 Updated for Backstage v1.42.0 with New Frontend System and New Backend System**

## Prerequisites

```bash
# Install required tools
brew install node@20 direnv sops age
```

## Quick Start

```bash
# Enter directory (auto-loads environment and decrypts secrets)
cd app-portal
direnv allow

# Install and start
yarn install
yarn start
```

Frontend: http://localhost:3000  
Backend: http://localhost:7007

## Secret Management

This project uses SOPS for secret encryption with SSH keys:

- **Encrypted files:**
  - `.env.enc` - GitHub App credentials
  - `github-app-key.pem.enc` - GitHub App private key
- **Auto-decryption:** Via direnv when entering directory
- **SSH-based:** Uses your existing SSH key from GitHub

### Adding Team Members

```bash
# Get their SSH public key
ssh-add -L  # They run this

# Add to .sops.yaml, then:
sops updatekeys .env.enc
sops updatekeys github-app-key.pem.enc
```

## Development Commands

```bash
# Start development server (auto-detects kubectl context)
yarn start              # Loads app-config.{context}.local.yaml automatically
yarn start:log          # Same as above, with timestamped logging
yarn start --log        # Alternative syntax for logging

# Installation
yarn install
yarn install:log    # With timestamped logging (Unix/Linux/macOS only)

# Build for production
yarn build:backend
yarn build:all

# Testing
yarn test
yarn test:all
yarn test:e2e

# Linting and formatting
yarn lint
yarn lint:all
yarn prettier:check
yarn fix

# Clean build artifacts
yarn clean

# Create new plugin
yarn new
```

### Dynamic Start Script

The `yarn start` command uses a Node.js script (`start.js` in root) that:
1. Detects current kubectl context via `kubectl config current-context`
2. Looks for context-specific config: `app-config.{context}.local.yaml`
3. Automatically loads both base and context configs
4. Shows which configuration is being used
5. Falls back gracefully if no context or config found

**Example:**
- Context: `rancher-desktop` → Loads: `app-config.rancher-desktop.local.yaml`
- Context: `rackspace-openportal` → Loads: `app-config.rackspace-openportal.local.yaml`

### Logging Support
The start script supports logging via `--log` flag:
- Creates timestamped log files in `./logs/` directory
- Custom location: `BACKSTAGE_LOG_DIR=/path yarn start:log`
- Captures both stdout and stderr for debugging

## 🆕 New Frontend System Architecture (v1.42.0)

This app uses Backstage's **New Frontend System** with significant architecture changes:

### Key Differences from Legacy System

| Aspect | Legacy System | New Frontend System |
|--------|---------------|-------------------|
| **Main Import** | `@backstage/app-defaults` | `@backstage/frontend-defaults` |
| **Plugin Loading** | `plugins: [plugin]` | `features: [pluginAlpha]` |
| **Plugin Exports** | Default exports | Alpha subpath exports (`/alpha`) |
| **App Creation** | `createApp({...}).createRoot(<jsx>)` | `createApp({features}).createRoot()` |
| **Extensions** | Limited customization | Full extension system |
| **Route Binding** | Manual JSX routes | Extension-based routing |

### New Frontend System Features

- **Automatic Plugin Discovery**: via `app.packages: all`
- **Extension System**: PageBlueprint, SignInPageBlueprint, etc.
- **Alpha Plugin Exports**: All plugins use `/alpha` subpath exports
- **Modern Architecture**: Clean separation with extension tree

### Frontend Structure (New System)

```typescript
// packages/app/src/App.tsx
import { createApp } from '@backstage/frontend-defaults';

const app = createApp({
  features: [
    // All plugins use /alpha exports
    catalogPlugin,
    scaffolderPlugin,
    searchPlugin,
    // ... other plugins
  ],
});

export default app.createRoot();
```

## 🆕 New Backend System (v1.42.0)

The backend uses the **New Backend System** with:

### Backend Architecture Changes

| Component | Legacy | New System |
|-----------|---------|------------|
| **Plugin Registration** | Manual router setup | `backend.add(import('plugin'))` |
| **Modules** | Custom setup | `createBackendModule()` |
| **Plugin Loading** | Individual imports | Automatic discovery |
| **Config Structure** | `clusterLocatorMethods` only | `serviceLocatorMethod` + `clusterLocatorMethods` |

### Backend Structure (New System)

```typescript
// packages/backend/src/index.ts
import { createBackend } from '@backstage/backend-defaults';

const backend = createBackend();

// Core plugins
backend.add(import('@backstage/plugin-app-backend'));
backend.add(import('@backstage/plugin-scaffolder-backend'));

// Custom modules
backend.add(import('./scaffolder')); // Custom scaffolder actions

backend.start();
```

### Custom Backend Modules (New System)

Custom scaffolder actions are now modules:

```typescript
// packages/backend/src/scaffolder/index.ts
const scaffolderModuleCustomActions = createBackendModule({
  pluginId: 'scaffolder',
  moduleId: 'custom-actions',
  register(reg) {
    reg.registerInit({
      deps: { scaffolder: scaffolderActionsExtensionPoint },
      async init({ scaffolder }) {
        scaffolder.addActions(createGenerateIdAction());
      },
    });
  },
});
```

## Project Structure

```
app-portal/
├── packages/
│   ├── app/                    # Frontend React application (New Frontend System)
│   │   ├── src/
│   │   │   ├── App.tsx         # Main app component (New System)
│   │   │   └── components/     # UI components
│   │   └── package.json
│   └── backend/                 # Backend Node.js services (New Backend System)
│       ├── src/
│       │   ├── index.ts        # Backend entry point (New System)
│       │   └── scaffolder/     # Custom scaffolder actions (New Module System)
│       │       ├── index.ts    # Module registration
│       │       └── generateId.ts # Custom action implementation
│       └── package.json
├── plugins/                    # Custom Backstage plugins
│   ├── crossplane-ingestor/   # Advanced Crossplane XRD discovery (16k+ lines)
│   │   ├── src/               # Source code
│   │   ├── tests/             # Comprehensive test suite
│   │   └── docs/              # Detailed documentation
│   └── ...                     # Other custom plugins
├── docs/                       # Application documentation
│   ├── modular-config.md      # Modular configuration guide
│   └── crossplane-ingestor.md # Crossplane ingestor guide
├── app-config/                 # Modular configuration directory (NEW!)
│   ├── auth.yaml              # Authentication providers
│   ├── backend.yaml           # Backend settings
│   ├── catalog.yaml           # Catalog configuration
│   ├── ingestor.yaml          # Ingestor plugins config
│   ├── integrations.yaml      # SCM integrations
│   ├── kubernetes.yaml        # K8s clusters
│   ├── scaffolder.yaml        # Scaffolder settings
│   └── techdocs.yaml          # Documentation platform
├── examples/                    # Example data for development
│   ├── entities.yaml           # Example catalog entities
│   ├── org.yaml                # Example users/groups
│   └── template/               # Example template
├── app-config.yaml             # Base configuration (legacy/reference)
├── app-config.production.yaml  # Production overrides
├── app-config.local.yaml       # Local overrides (gitignored) with serviceLocatorMethod
├── .envrc                      # Direnv config (auto-loads secrets)
├── .sops.yaml                  # SOPS encryption config
└── backstage.json              # Backstage version (v1.42.0+)
```

## Configuration

### 🆕 Modular Configuration Architecture

Configuration is now split into focused modules in the `app-config/` directory:

```yaml
# The start.js script loads all modules automatically:
yarn start  # Loads: app-config.yaml + app-config/*.yaml + app-config.{context}.local.yaml
```

**Configuration Modules:**
- `auth.yaml` - Authentication providers (GitHub, GitLab, OAuth)
- `backend.yaml` - Backend settings (ports, CORS, database)
- `catalog.yaml` - Catalog providers and locations
- `ingestor.yaml` - Kubernetes and Crossplane ingestors
- `integrations.yaml` - SCM integrations
- `kubernetes.yaml` - Cluster connections
- `scaffolder.yaml` - Template settings
- `techdocs.yaml` - Documentation platform

See [Modular Configuration Guide](./docs/modular-config.md) for details.

### New Backend System Requirements

The **kubernetes** section in `app-config.yaml` requires `serviceLocatorMethod` for the New Backend System:

```yaml
kubernetes:
  serviceLocatorMethod:
    type: 'multiTenant'
  clusterLocatorMethods:
    - type: 'config'
      clusters:
        - url: ${KUBERNETES_API_URL}
          name: ${KUBERNETES_CLUSTER_NAME}
          authProvider: 'serviceAccount'
          skipTLSVerify: true
          serviceAccountToken: ${KUBERNETES_SERVICE_ACCOUNT_TOKEN}
```

### GitHub App Integration

The GitHub App provides:
- Repository discovery
- Template scaffolding
- Authentication

Credentials are stored encrypted in `.env.enc`.

### Catalog Providers

1. **GitHub Organization Scanner**
   - Org: `open-service-portal`
   - Frequency: 30 minutes

2. **Template Discovery**
   - Pattern: `service-*-template` repositories
   - Auto-imports templates from GitHub

### Authentication

- **Development:** GitHub OAuth + Guest auth
- **Production:** GitHub OAuth only

## Custom Features

### 🆕 Crossplane Ingestor Plugin

A comprehensive Crossplane integration plugin with 16,000+ lines of production code:

**Features:**
- Discovers XRDs from multiple Kubernetes clusters
- Generates Backstage template entities automatically
- Creates API documentation entities
- Tracks Composition relationships
- Includes CLI tools for debugging and testing

**CLI Tools:**
```bash
cd plugins/crossplane-ingestor
yarn cli discover --cluster local        # Discover XRDs
yarn cli transform --xrd ./xrd.yaml     # Transform XRD to template
yarn cli export --cluster local         # Export all entities
yarn cli validate --xrd ./xrd.yaml      # Validate XRD compatibility
```

**Configuration:** See `app-config/ingestor.yaml` for settings.
**Documentation:** See [Crossplane Ingestor Guide](./docs/crossplane-ingestor.md) and `plugins/crossplane-ingestor/docs/` for detailed documentation.

### Scaffolder Actions (New Module System)

Custom action for unique ID generation:
- **Location:** `packages/backend/src/scaffolder/generateId.ts`
- **Module:** `packages/backend/src/scaffolder/index.ts` 
- **Registration:** Via New Backend System in `packages/backend/src/index.ts`
- **Action ID:** `portal:utils:generateId`
- **Functionality:** Generates unique resource identifiers (hex or alphanumeric)

**Test Custom Actions:**
- Visit: http://localhost:3000/create/actions
- Look for: `portal:utils:generateId`
- Verify action appears with correct input/output schema

### Integrations

- **GitHub** (primary) - Repository discovery and authentication
- **Kubernetes** (configured in app-config.local.yaml with New Backend System)
- **TechDocs** (local builder)
- **TeraSky Crossplane Plugin** (@terasky/backstage-plugin-crossplane-resources-frontend)
- **TeraSky Kubernetes Ingestor** (@terasky/backstage-plugin-kubernetes-ingestor) - Optional, requires fork
- **TeraSky Scaffolder Utils** (@terasky/backstage-plugin-scaffolder-backend-module-terasky-utils)

### Optional Fork Plugins

The backend supports optional TeraSky fork plugins that are only loaded if their repositories are cloned:

**Setup (Optional):**
```bash
# Clone TeraSky forks (optional - backend works without them)
cd portal-workspace
git clone git@github.com:open-service-portal/backstage-plugins.git

# For customized version (optional)
git worktree add backstage-plugins-custom backstage-plugins/feat/open-service-portal-customizations
```

**Available Fork Plugins:**
- `@terasky/backstage-plugin-kubernetes-ingestor` - Upstream TeraSky version
- `@terasky/backstage-plugin-kubernetes-ingestor-custom` - Our customized fork

**Behavior:**
- If forks are cloned: Plugins load automatically, selectable via `ingestorSelector` config
- If forks are missing: Backend starts normally using internal ingestors only
- Check backend logs for `[Optional Plugin]` messages to see loading status

**Fallback Options:**
When forks aren't available, these internal ingestors still work:
- `kubernetes-ingestor-own` - Legacy internal version
- `crossplane-ingestor` - Refactored Crossplane-focused version

## Troubleshooting

### Secrets not loading

```bash
# Check if SSH key is loaded
ssh-add -L

# If "The agent has no identities", add your SSH key:
ssh-add ~/.ssh/id_ed25519  # or ~/.ssh/id_rsa

# Manually test decryption
sops -d --input-type dotenv --output-type dotenv .env.enc

# Re-allow direnv
direnv allow
```

### SSH key with passphrase

If using a passphrase-protected SSH key, you'll be prompted when entering the directory:
- Enter the passphrase once per terminal session
- Or add key to ssh-agent: `ssh-add ~/.ssh/id_ed25519`
- Alternative: Use a dedicated key without passphrase for development

### New Frontend System Issues

**Plugin not found:**
- Check if plugin has `/alpha` export
- Verify plugin is included in `features` array in `App.tsx`
- Check `app-config.yaml` has `packages: all`

**Extension errors:**
- Verify extension imports use correct paths
- Check PageBlueprint and SignInPageBlueprint usage
- Ensure proper extension tree structure

### New Backend System Issues

**Module registration errors:**
- Check `createBackendModule` syntax in custom modules
- Verify extension points are imported correctly
- Ensure modules are added via `backend.add(import('./module'))`

**Config errors:**
- Verify new backend config structure (kubernetes `serviceLocatorMethod`)
- Check module IDs don't conflict
- Ensure proper dependency injection

**Custom scaffolder action not appearing:**
- Check module registration in `packages/backend/src/index.ts`
- Verify action ID is unique: `portal:utils:generateId`
- Check action schema and handler implementation
- Visit http://localhost:3000/create/actions to verify registration

### Build issues

```bash
# Clean and rebuild (New System compatible)
yarn clean
yarn install
yarn build:backend
```

### Port conflicts

Default ports:
- Frontend: 3000
- Backend: 7007

Change in app-config.yaml if needed.

## Testing

```bash
# Unit tests
yarn test

# With coverage
yarn test:all

# E2E tests (requires running app)
yarn test:e2e
```

### Testing Custom Actions

1. **Start the app:**
   ```bash
   yarn start
   ```

2. **Verify action registration:**
   - Visit: http://localhost:3000/create/actions
   - Search for: `portal:utils:generateId`
   - Check input schema: `length` (number, default: 8), `type` (enum: hex/alphanumeric)
   - Check output schema: `id` (string)

3. **Test in template:**
   ```yaml
   steps:
     - id: generate-id
       name: Generate ID
       action: portal:utils:generateId
       input:
         length: 12
         type: hex
   ```

## Migration Notes

### From Legacy to New Frontend System

This app was migrated from Legacy System to New Frontend System v1.42.0:

**Completed:**
- ✅ Frontend migration to New Frontend System
- ✅ Backend migration to New Backend System  
- ✅ Custom scaffolder actions ported to module system
- ✅ All plugins using `/alpha` exports
- ✅ Extension system implemented (PageBlueprint, SignInPageBlueprint)
- ✅ Plugin discovery enabled via `packages: all`
- ✅ TeraSky plugins integrated

**Key Migration Changes:**
- `App.tsx` completely rewritten for New Frontend System
- All plugin imports changed to `/alpha` subpaths
- Backend modules converted to New Backend System with `createBackendModule()`
- Configuration updated for new backend requirements (`serviceLocatorMethod`)
- Custom scaffolder actions restructured as backend modules

**Breaking Changes Handled:**
- Plugin loading mechanism completely changed
- Extension system replaces manual JSX routing
- Backend plugin registration simplified
- Config structure updated for kubernetes integration

## Deployment

See [deploy-backstage](https://github.com/open-service-portal/deploy-backstage) repository for Kubernetes deployment.

## Contributing

1. Create feature branch from `main`
2. Make changes following New Frontend/Backend System patterns
3. Run tests: `yarn test`
4. Run linter: `yarn lint`
5. Test custom actions: Visit http://localhost:3000/create/actions
6. Create PR with semantic commit message

## Related Repositories

- [portal-workspace](https://github.com/open-service-portal/portal-workspace) - Parent workspace with documentation
- [service-nodejs-template](https://github.com/open-service-portal/service-nodejs-template) - Node.js service template  
- [deploy-backstage](https://github.com/open-service-portal/deploy-backstage) - Kubernetes deployment (coming soon)