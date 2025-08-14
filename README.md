# Open Service Portal - Backstage Application

A [Backstage](https://backstage.io) based Internal Developer Platform for self-service cloud-native infrastructure.

## 🚀 Quick Start

### Prerequisites
- Node.js 20 or 22
- Yarn package manager
- [direnv](https://direnv.net/) (for automatic environment loading)
- [SOPS](https://github.com/getsops/sops) (for secret decryption)
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

```bash
yarn start    # Start both frontend and backend
yarn build    # Build for production
yarn test     # Run tests
yarn lint     # Lint code
```

## 📦 Project Structure

```
packages/
├── app/          # Frontend application
└── backend/      # Backend services
```

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📄 License

Apache 2.0