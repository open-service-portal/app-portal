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
yarn start:log      # Start with timestamped logging (Unix/Linux/macOS only)
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

#### Logging Scripts (Unix/Linux/macOS only)

The `yarn start:log` and `yarn install:log` commands capture timestamped logs for debugging:

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

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📄 License

Apache 2.0