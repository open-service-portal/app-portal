# CLAUDE.md - app-portal

This file provides guidance to Claude Code when working with the app-portal Backstage application.

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
# Start development server
yarn start

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

## Project Structure

```
app-portal/
├── packages/
│   ├── app/                    # Frontend React application
│   │   ├── src/
│   │   │   ├── App.tsx         # Main app component
│   │   │   └── components/     # UI components
│   │   └── package.json
│   └── backend/                 # Backend Node.js services
│       ├── src/
│       │   ├── index.ts        # Backend entry point
│       │   └── scaffolder/     # Custom scaffolder actions
│       │       ├── index.ts
│       │       └── generateId.ts
│       └── package.json
├── examples/                    # Example data for development
│   ├── entities.yaml           # Example catalog entities
│   ├── org.yaml                # Example users/groups
│   └── template/               # Example template
├── app-config.yaml             # Base configuration
├── app-config.production.yaml  # Production overrides
├── app-config.local.yaml       # Local overrides (gitignored)
├── .envrc                      # Direnv config (auto-loads secrets)
├── .sops.yaml                  # SOPS encryption config
└── backstage.json              # Backstage version
```

## Configuration

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

### Scaffolder Actions

Custom action for unique ID generation:
- Location: `packages/backend/src/scaffolder/generateId.ts`
- Generates unique resource identifiers

### Integrations

- GitHub (primary)
- Kubernetes (optional, configured in app-config.local.yaml)
- TechDocs (local builder)

## Troubleshooting

### Secrets not loading

```bash
# Check SSH key
ssh-add -L

# Manually test decryption
sops -d .env.enc

# Re-allow direnv
direnv allow
```

### Build issues

```bash
# Clean and rebuild
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

## Deployment

See [deploy-backstage](https://github.com/open-service-portal/deploy-backstage) repository for Kubernetes deployment.

## Contributing

1. Create feature branch from `main`
2. Make changes
3. Run tests: `yarn test`
4. Run linter: `yarn lint`
5. Create PR with semantic commit message

## Related Repositories

- [portal-workspace](https://github.com/open-service-portal/portal-workspace) - Parent workspace with documentation
- [service-nodejs-template](https://github.com/open-service-portal/service-nodejs-template) - Node.js service template
- [deploy-backstage](https://github.com/open-service-portal/deploy-backstage) - Kubernetes deployment (coming soon)