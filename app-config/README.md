# Backstage Configuration Directory

This directory contains modular configuration files for Backstage. The configuration has been split from a single monolithic `app-config.yaml` into multiple focused files for better organization and maintainability.

## Configuration Files

- **backend.yaml** - Backend server configuration (URLs, ports, CORS, database, CSP)
- **auth.yaml** - Authentication providers and settings (GitHub, Guest auth)
- **catalog.yaml** - Software catalog configuration (providers, locations, rules)
- **integrations.yaml** - External service integrations (GitHub App settings)
- **kubernetes.yaml** - Kubernetes clusters configuration
- **ingestor.yaml** - Kubernetes and Crossplane ingestor settings
- **scaffolder.yaml** - Software template settings (default author, commit messages)
- **techdocs.yaml** - Technical documentation configuration

## How It Works

The configuration system is controlled by the `includes` section in `app-config.yaml`:

```yaml
# In app-config.yaml
includes:
  - app-config/backend.yaml
  - app-config/auth.yaml
  - app-config/catalog.yaml
  - app-config/integrations.yaml
  - app-config/kubernetes.yaml
  - app-config/ingestor.yaml
  # ... add or remove files as needed
```

When starting Backstage:

1. Base configuration (`app-config.yaml`) is loaded first
2. The `includes` section is read to determine which additional configs to load
3. Listed files are loaded in the order specified
4. Context-specific configs (`app-config.{context}.local.yaml`) are loaded last
5. Later files override earlier ones (deep merge for objects, replace for arrays/primitives)

## Loading Order

The exact loading order is controlled by the `includes` list in `app-config.yaml`:

```
1. app-config.yaml                      # Base configuration (always first)
2. [Files listed in includes section]   # In the order specified
3. app-config.{context}.local.yaml      # Context overrides (always last, if exists)
```

## Controlling Includes

To enable/disable specific configuration sections, edit the `includes` section in `app-config.yaml`:

```yaml
includes:
  - app-config/auth.yaml
  - app-config/catalog.yaml
  # - app-config/integrations.yaml  # Commented out to disable
  - app-config/kubernetes.yaml
  # Add new config files here
```

## Manual Loading

You can also manually specify which configs to load:

```bash
# Load specific configs
yarn backstage-cli repo start \
  --config app-config.yaml \
  --config app-config/auth.yaml \
  --config app-config/catalog.yaml

# Or use the start script (auto-loads everything)
yarn start
```

## Adding New Configuration

To add a new configuration section:

1. Create a new YAML file in this directory (e.g., `app-config/newfeature.yaml`)
2. Add your configuration with the appropriate top-level key
3. The file will be automatically loaded on next start

## Benefits

- **Modularity**: Each concern in its own file
- **Clarity**: Easy to find and modify specific settings
- **Team Collaboration**: Different teams can own different config files
- **Version Control**: Smaller, focused changes in git history
- **Environment Management**: Easier to see what changes between environments

## Environment Variables

All configuration files support environment variable substitution:

```yaml
github:
  token: ${GITHUB_TOKEN}
```

These are loaded from:
- `.env` file (decrypted from `.env.enc` via direnv)
- System environment variables
- Process environment variables