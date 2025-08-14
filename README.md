# Open Service Portal - Backstage Application

A [Backstage](https://backstage.io) based Internal Developer Platform for self-service cloud-native infrastructure.

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

# Start the application
yarn start
```

The secrets are automatically decrypted using SOPS when you enter the directory with direnv. Your SSH key is used for decryption - no additional configuration needed!

Frontend: http://localhost:3000  
Backend API: http://localhost:7007

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
# Development
yarn start          # Start both frontend and backend
yarn build:backend  # Build backend only
yarn build:all      # Build everything for production

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

### Environment Variables

All secrets are managed through SOPS encryption. The `.envrc` file automatically:
1. Loads Node.js version via nvm
2. Decrypts `.env.enc` to load GitHub App credentials
3. Decrypts `github-app-key.pem.enc` for GitHub App authentication

No manual environment variable setup needed!

## 📦 Project Structure

```
packages/
├── app/                    # Frontend React application
│   ├── src/
│   │   ├── App.tsx        # Main app component
│   │   └── components/    # Shared UI components
│   └── package.json
└── backend/                # Backend Node.js services
    ├── src/
    │   ├── index.ts       # Backend plugin setup
    │   └── scaffolder/    # Custom scaffolder actions
    └── package.json
```

### Configuration Files

- `app-config.yaml` - Base configuration
- `app-config.production.yaml` - Production overrides
- `app-config.local.yaml` - Local overrides (gitignored)
- `.sops.yaml` - SOPS encryption configuration
- `.envrc` - Direnv auto-loader with SOPS decryption

## 🐛 Troubleshooting

### Secrets Not Loading

If you see authentication errors:

```bash
# Verify SSH key is available
ssh-add -L

# Test SOPS decryption manually
sops -d .env.enc

# Re-allow direnv
direnv allow
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

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📄 License

Apache 2.0