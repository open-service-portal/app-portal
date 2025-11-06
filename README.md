# Open Service Portal - Backstage Application

A [Backstage](https://backstage.io) based Internal Developer Platform for self-service cloud-native infrastructure.

**🆕 Now running Backstage v1.42.0 with New Frontend System architecture!**

## 🚀 Quick Start

### Prerequisites
- Node.js 20
- Yarn package manager
- [direnv](https://direnv.net/) (for automatic environment loading)
- [SOPS](https://github.com/getsops/sops) (for secret decryption)
- [age](https://github.com/FiloSottile/age) (SOPS dependency for SSH key support)
- SSH key configured in GitHub

### Setup

```bash
# Clone and install
git clone https://github.com/open-service-portal/app-portal.git
cd app-portal
yarn install

# Allow direnv to load environment (auto-decrypts secrets)
direnv allow

# Start the application (auto-detects kubectl context)
yarn start        # Using yarn (traditional Node.js way)
# OR
./start.js        # Direct execution (Unix-style) 🚀
```

The application automatically detects your current kubectl context and loads the appropriate configuration file (e.g., `app-config.rancher-desktop.local.yaml` for local development).

The secrets are automatically decrypted using SOPS when you enter the directory with direnv. Your SSH key is used for decryption - no additional configuration needed!

Frontend: http://localhost:3000  
Backend API: http://localhost:7007

## 🆕 Key Features

### Modular Configuration
Configuration is now split into focused modules for better maintainability:
- `app-config/auth.yaml` - Authentication providers
- `app-config/backend.yaml` - Backend settings
- `app-config/catalog.yaml` - Catalog configuration
- `app-config/ingestor.yaml` - Kubernetes/Crossplane ingestors
- `app-config/integrations.yaml` - GitHub/GitLab integrations
- See [Modular Config Documentation](./docs/modular-config.md) for details

### Crossplane Ingestor Plugin
Advanced Crossplane integration with 16,000+ lines of code:
- Discovers XRDs from Kubernetes clusters
- Generates Backstage templates automatically
- Creates API documentation entities
- Includes CLI tools for debugging
- See [Crossplane Ingestor Documentation](./docs/crossplane-ingestor.md) for details

## 🔐 Secret Management

This project uses [SOPS](https://github.com/getsops/sops) for secret encryption. Secrets are stored encrypted in the repository and automatically decrypted when you enter the directory.

### Adding Team Members

To grant a new team member access to decrypt secrets:

1. Get their SSH public key:
   ```bash
   ssh-add -L  # They run this to get their public key
   ```

2. Add it to `.sops.yaml`:
   ```yaml
   creation_rules:
     - age: >-
         existing-key,
         ssh-ed25519 NEW_PUBLIC_KEY_HERE
   ```

3. Re-encrypt the secrets:
   ```bash
   sops updatekeys .env.enc
   sops updatekeys github-app-key.pem.enc
   ```

## 📚 Documentation

For detailed setup instructions, see our [portal-workspace documentation](https://github.com/open-service-portal/portal-workspace):
- GitHub App configuration
- SOPS secret management
- Creating service templates
- Troubleshooting

## 🎨 Service Templates

Templates are auto-discovered from repositories matching `service-*-template` pattern.

Example: [service-nodejs-template](https://github.com/open-service-portal/service-nodejs-template)

## 🧑‍💻 Development

### Commands

```bash
# Development - Choose your style!

# Traditional Node.js style
yarn start          # Start with auto-detected kubectl context config
yarn start:log      # Same as above, with timestamped logging

# Direct execution (Unix-style)
./start.js          # Start with auto-detected config
./start.js --log    # With timestamped logging

# Build commands
yarn build:backend  # Build backend only
yarn build:all      # Build everything for production

# Installation
yarn install        # Standard installation
yarn install:log    # Install with timestamped logging (Unix/Linux/macOS only)

# Testing
yarn test           # Run tests
yarn test:all       # Run tests with coverage
yarn test:e2e       # Run E2E tests

# Code Quality
yarn lint           # Lint changed files
yarn lint:all       # Lint all files
yarn prettier:check # Check formatting
yarn fix            # Auto-fix issues

# Utilities
yarn clean          # Clean build artifacts
yarn new            # Create new Backstage plugin
```

#### Dynamic Configuration Loading

Both `yarn start` and `./start` automatically detect your current kubectl context and load the matching configuration:
- Detects context via `kubectl config current-context`
- Loads `app-config.{context}.local.yaml` if it exists
- Falls back to base `app-config.yaml` if no context-specific config found
- Shows which configuration is being used during startup

#### Logging Scripts

Logging can be enabled through multiple methods:
- `yarn start:log` - Using yarn script
- `./start.js --log` - Direct execution with flag
- `yarn install:log` - For installation logging

These commands capture timestamped logs for debugging:

```bash
# Default: logs to ./logs directory
yarn install:log
yarn start:log

# Custom log directory via environment variable
BACKSTAGE_LOG_DIR=/tmp yarn start:log
BACKSTAGE_LOG_DIR=~/debugging yarn install:log
```

**Note:** These logging scripts use shell-specific syntax and are only compatible with Unix-based systems (Linux, macOS). Windows users should use the standard `yarn start` and `yarn install` commands.


### Environment Variables

All secrets are managed through SOPS encryption. The `.envrc` file automatically:
1. Loads Node.js version via nvm
2. Decrypts `.env.enc` to load authentication credentials (GitHub, Microsoft, etc.)
3. Decrypts `github-app-key.pem.enc` for GitHub App authentication

#### Required Variables for Authentication

**GitHub Authentication:**
- `AUTH_GITHUB_CLIENT_ID` - GitHub OAuth App Client ID
- `AUTH_GITHUB_CLIENT_SECRET` - GitHub OAuth App Client Secret

**Microsoft Entra ID Authentication & Catalog:**
- `AUTH_MICROSOFT_CLIENT_ID` - Microsoft Application (client) ID
- `AUTH_MICROSOFT_CLIENT_SECRET` - Microsoft Client Secret
- `AUTH_MICROSOFT_TENANT_ID` - Microsoft Tenant ID

These credentials are used for both:
- User authentication (sign-in)
- Microsoft Graph catalog provider (importing users/groups from Entra ID)

No manual environment variable setup needed when using direnv!

#### GitHub Integration Strategy

**Current approach:** GitHub OAuth with `dangerouslyAllowSignInWithoutUserInCatalog: true`
- Users authenticate with Microsoft Entra ID for Backstage identity
- GitHub OAuth is used solely for API access (creating PRs, commits on behalf of users)
- No validation that GitHub account belongs to the Microsoft user
- Simple, works immediately, suitable for trusted internal environments

**For details on this decision and alternative approaches, see:**
- [ADR-001: GitHub OAuth Integration Strategy](docs/adr/001-github-oauth-integration-strategy.md)

## 📦 Project Structure

```
packages/
├── app/                    # Frontend React application (New Frontend System)
│   ├── src/
│   │   ├── App.tsx        # Main app with createApp (New System)
│   │   └── components/    # Shared UI components
│   └── package.json
└── backend/                # Backend Node.js services (New Backend System)
    ├── src/
    │   ├── index.ts       # Backend plugin setup (New System)
    │   └── scaffolder/    # Custom scaffolder actions
    └── package.json
```

### Configuration Files

- `app-config.yaml` - Base configuration (Updated for v1.42.0)
- `app-config.production.yaml` - Production overrides
- `app-config.{context}.local.yaml` - Context-specific overrides (gitignored, auto-loaded by yarn start)
- `.sops.yaml` - SOPS encryption configuration
- `.envrc` - Direnv auto-loader with SOPS decryption

## 🆕 New Frontend System Features (v1.42.0)

This app uses Backstage's **New Frontend System** with:

- **Automatic Plugin Discovery**: Plugins are auto-discovered via `packages: all`
- **Extension System**: Custom extensions for routing and components
- **Alpha Plugin Exports**: All plugins use `/alpha` subpath exports
- **Modern Architecture**: Clean separation of concerns with the new system

### Key Updates from Legacy System:
- Uses `@backstage/frontend-defaults` instead of `@backstage/app-defaults`
- Plugin loading via `features: [pluginAlpha]` instead of `plugins: [plugin]`
- Extension-based routing instead of manual JSX routes
- New Backend System with automatic plugin registration

## ⚙️ New Backend System Configuration (v1.42.0)

**Breaking Change:** The Kubernetes plugin now requires additional configuration:

```yaml
# app-config.yaml
kubernetes:
  serviceLocatorMethod:
    type: 'multiTenant'        # NEW: How services are located
  clusterLocatorMethods:       # EXISTING: Where clusters are found
    - type: 'config'
      clusters: [...]
```

**Why this change?**
- `serviceLocatorMethod: multiTenant` enables **multi-cluster, multi-namespace** service discovery
- **Supports distributed services** across different clusters (local dev + production)
- **Required for New Backend System** - Kubernetes plugin won't work without it
- **Backward compatible** with existing `clusterLocatorMethods` configuration

## 🐛 Troubleshooting

### Secrets Not Loading

If you see authentication errors:

```bash
# Check if SSH key is loaded
ssh-add -L

# If "The agent has no identities", add your SSH key:
ssh-add ~/.ssh/id_ed25519  # or ~/.ssh/id_rsa

# Test SOPS decryption manually
sops -d --input-type dotenv --output-type dotenv .env.enc

# Re-allow direnv
direnv allow
```

### SSH Key with Passphrase

If your SSH key is protected with a passphrase, SOPS behavior can be inconsistent:

**Try adding your key to ssh-agent first:**
```bash
ssh-add ~/.ssh/id_ed25519
# Enter passphrase once

cd app-portal
# May work without passphrase prompt, or may still ask once
```

**If you still get passphrase prompts:**
- You might need to enter it once per terminal session
- Sometimes SOPS uses ssh-agent, sometimes it doesn't
- This is a known SOPS limitation

**Most reliable solution - Dedicated key without passphrase:**
```bash
# Create a separate key for SOPS (development only)
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_sops -N ""

# Add the public key to .sops.yaml
cat ~/.ssh/id_ed25519_sops.pub
# Give this to your team lead to add to .sops.yaml
```

### Port Already in Use

If ports 3000 or 7007 are in use:

```bash
# Find process using port
lsof -i :3000
lsof -i :7007

# Or use different ports in app-config.yaml
```

### Build Failures

```bash
# Clean everything and rebuild
yarn clean
rm -rf node_modules
yarn install
yarn build:backend
```

## 📚 Documentation

### Configuration Guides
- [Modular Configuration](./docs/modular-config.md) - How configuration is organized
- [Environment Variables](./docs/environment-variables.md) - Required environment variables
- [Secret Management](./docs/secret-management.md) - SOPS encryption setup

### Plugin Documentation
- [Crossplane Ingestor](./docs/crossplane-ingestor.md) - Advanced XRD discovery and transformation
- [Kubernetes Ingestor](./docs/kubernetes-ingestor.md) - Basic Kubernetes resource discovery
- [Custom Scaffolder Actions](./docs/scaffolder-actions.md) - Custom template actions

### Development Guides
- [CLAUDE.md](./CLAUDE.md) - AI assistant guidance for this repository
- [Testing Guide](./docs/testing.md) - Running tests and writing new ones
- [Troubleshooting](./docs/troubleshooting.md) - Common issues and solutions

### Crossplane Ingestor Documentation
Detailed guides in `plugins/crossplane-ingestor/docs/`:
- [CLI Usage](./plugins/crossplane-ingestor/docs/CLI-USAGE.md) - Using CLI tools
- [Developer Guide](./plugins/crossplane-ingestor/docs/DEVELOPER-GUIDE.md) - Architecture and development
- [Metadata Flow](./plugins/crossplane-ingestor/docs/METADATA-FLOW.md) - How metadata is processed
- [XRD Ingestion](./plugins/crossplane-ingestor/docs/XRD_INGESTION.md) - Ingestion pipeline

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📄 License

Apache 2.0