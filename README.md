# Open Service Portal - Backstage Application

A [Backstage](https://backstage.io) based Internal Developer Platform for self-service cloud-native infrastructure.

## 🚀 Quick Start

```bash
# Clone and install
git clone https://github.com/open-service-portal/app-portal.git
cd app-portal
yarn install

# Configure environment (see docs for GitHub App setup)
cp .envrc.example .envrc
# Edit .envrc with your credentials

# Start the application
yarn start
```

Frontend: http://localhost:3000  
Backend API: http://localhost:7007

## 📚 Documentation

For detailed setup instructions, see our [portal-workspace documentation](https://github.com/open-service-portal/portal-workspace):
- GitHub App configuration
- Environment setup with direnv
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