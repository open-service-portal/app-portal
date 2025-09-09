# Modular Configuration Guide

This guide explains how the app-portal uses modular configuration to organize settings across multiple YAML files for better maintainability.

## Overview

Instead of a single monolithic `app-config.yaml`, configuration is split into focused modules in the `app-config/` directory. Each module handles a specific aspect of the Backstage application.

## Directory Structure

```
app-portal/
├── app-config.yaml              # Legacy/reference configuration
├── app-config/                  # Modular configuration directory
│   ├── README.md               # Configuration documentation
│   ├── auth.yaml               # Authentication providers
│   ├── backend.yaml            # Backend service settings
│   ├── catalog.yaml            # Software catalog configuration
│   ├── ingestor.yaml           # Kubernetes and Crossplane ingestors
│   ├── integrations.yaml       # GitHub/GitLab integrations
│   ├── kubernetes.yaml         # Kubernetes cluster connections
│   ├── scaffolder.yaml         # Scaffolder template settings
│   └── techdocs.yaml           # TechDocs configuration
```

## Configuration Loading

The `start.js` script automatically loads all configuration modules:

```javascript
// start.js
const configPaths = [
  '--config', 'app-config.yaml',
  '--config', 'app-config/auth.yaml',
  '--config', 'app-config/backend.yaml',
  '--config', 'app-config/catalog.yaml',
  '--config', 'app-config/ingestor.yaml',
  '--config', 'app-config/integrations.yaml',
  '--config', 'app-config/kubernetes.yaml',
  '--config', 'app-config/scaffolder.yaml',
  '--config', 'app-config/techdocs.yaml'
];
```

## Module Descriptions

### auth.yaml
Authentication and authorization configuration:
- OAuth providers (GitHub, GitLab, Google)
- Session management
- Guest access policies
- API tokens

### backend.yaml
Core backend service settings:
- Server URLs and ports
- CORS configuration
- Database connections
- Cache settings
- Content security policies

### catalog.yaml
Software catalog discovery and processing:
- Entity locations
- GitHub/GitLab organization scanning
- Processing schedules
- Custom processors
- Entity rules

### ingestor.yaml
Kubernetes and Crossplane resource discovery:
- Kubernetes cluster connections
- XRD discovery filters
- Template generation settings
- Caching configuration
- Both kubernetes-ingestor and crossplane-ingestor settings

### integrations.yaml
Source control management integrations:
- GitHub credentials
- GitLab credentials
- Enterprise instances
- API endpoints

### kubernetes.yaml
Kubernetes plugin configuration:
- Cluster connections
- Authentication methods
- Service discovery
- Custom resource definitions

### scaffolder.yaml
Template scaffolding settings:
- Default values
- Git configuration
- Custom actions
- Template locations

### techdocs.yaml
Documentation platform configuration:
- Build settings
- Storage backends
- Publishing configuration
- MkDocs settings

## Environment-Specific Configuration

Override base configuration for different environments:

```bash
# Development (auto-detected by start.js)
app-config.rancher-desktop.local.yaml

# Production
app-config.production.yaml

# Custom environment
APP_CONFIG_ENV=staging yarn start
```

## Benefits

1. **Better Organization**: Related settings grouped together
2. **Easier Maintenance**: Smaller, focused files
3. **Reduced Conflicts**: Teams can work on different modules
4. **Clear Ownership**: Modules can have designated owners
5. **Flexible Deployment**: Environment-specific overrides

## Migration from Monolithic Config

1. **Backup existing config**:
   ```bash
   cp app-config.yaml app-config.yaml.backup
   ```

2. **Split into modules**:
   - Move auth settings to `app-config/auth.yaml`
   - Move backend settings to `app-config/backend.yaml`
   - Continue for each module

3. **Test configuration**:
   ```bash
   yarn start
   ```

4. **Verify all settings loaded**:
   ```bash
   yarn backstage-cli config:print
   ```

## Best Practices

- Keep modules focused on single concerns
- Use environment variables for secrets
- Document module-specific settings
- Test configuration changes thoroughly
- Version control all config files (except local overrides)

## Troubleshooting

### Configuration not loading
```bash
# Check YAML syntax
yarn backstage-cli config:check

# Print merged configuration
yarn backstage-cli config:print
```

### Missing environment variables
```bash
# List required variables
grep -r '\${' app-config/ | grep -v '#'
```

### Module conflicts
- Later modules override earlier ones
- Check load order in `start.js`
- Use `config:print` to see final values

## Related Documentation

- [Backstage Configuration](https://backstage.io/docs/conf/)
- [Crossplane Ingestor Configuration](./crossplane-ingestor.md)
- [Environment Variables](./environment-variables.md)