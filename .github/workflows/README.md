# GitHub Actions Workflows

## Overview

The CI/CD pipeline is split into two separate workflows for better modularity:

1. **`build-release.yml`** - Builds Docker images and creates GitHub releases
2. **`deploy.yml`** - Deploys images to Kubernetes (can be moved to separate repo)

## Build & Release Workflow (`build-release.yml`)

### Triggers
- **On tag push**: Automatically runs when pushing tags matching `v*` 
- **Manual dispatch**: Can be triggered manually with a specific tag

### Flow
1. **Build & Push** - Builds application, runs tests, creates Docker image
2. **Create Release** - Generates changelog and creates GitHub release  
3. **Trigger Deployment** - Optionally triggers the deployment workflow

## Deploy Workflow (`deploy.yml`)

### Triggers
- **Manual dispatch**: Deploy any image/version to any environment
- **Workflow call**: Can be called from other workflows or repositories
- **External trigger**: Can be triggered via API from external systems

### Features
- Environment-specific deployments (production, staging, development)
- Smoke tests after deployment
- Deployment annotations for tracking
- Can be moved to a separate repository without changing build workflow

### Required GitHub Secrets

Configure these secrets in your repository settings under Settings → Secrets and variables → Actions:

#### Kubernetes Configuration
- `KUBECONFIG` - Base64-encoded kubeconfig file for cluster access
  ```bash
  # Generate from your kubeconfig:
  cat ~/.kube/config | base64
  ```

- `APP_HOSTNAME` - Application hostname (e.g., `app.openportal.dev`)

#### Kubernetes Cluster Access
- `KUBERNETES_API_URL` - Kubernetes API server URL
  ```bash
  kubectl config view --minify -o jsonpath='{.clusters[0].cluster.server}'
  ```

- `KUBERNETES_CLUSTER_NAME` - Kubernetes cluster name
  ```bash
  kubectl config current-context
  ```

- `KUBERNETES_SERVICE_ACCOUNT_TOKEN` - Backstage service account token
  ```bash
  kubectl get secret backstage-k8s-sa-token -n default -o jsonpath='{.data.token}' | base64 -d
  ```

#### GitHub App Configuration
- `AUTH_GITHUB_APP_ID` - GitHub App ID
- `AUTH_GITHUB_CLIENT_ID` - GitHub OAuth App Client ID
- `AUTH_GITHUB_CLIENT_SECRET` - GitHub OAuth App Client Secret
- `AUTH_GITHUB_APP_INSTALLATION_ID` - GitHub App Installation ID
- `AUTH_GITHUB_APP_PRIVATE_KEY_B64` - Base64-encoded GitHub App private key
  ```bash
  # Generate from your private key file:
  cat github-app-key.pem | base64
  ```

### Usage

#### Automatic Deployment

1. Create and push a version tag:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

2. The workflow will automatically:
   - Build the application
   - Run type checks and linting
   - Build and push Docker image to GitHub Container Registry
   - Deploy to Kubernetes cluster
   - Wait for deployment to be ready

#### Manual Deployment

1. Go to Actions tab in GitHub
2. Select "Deploy to Kubernetes" workflow
3. Click "Run workflow"
4. Enter the tag to deploy (e.g., `v1.0.0`)
5. Click "Run workflow"

### Docker Images

Images are pushed to GitHub Container Registry with these tags:
- `ghcr.io/open-service-portal/app-portal:v1.0.0` (exact version)
- `ghcr.io/open-service-portal/app-portal:1.0` (minor version)
- `ghcr.io/open-service-portal/app-portal:1` (major version)
- `ghcr.io/open-service-portal/app-portal:latest` (latest from main branch)
- `ghcr.io/open-service-portal/app-portal:main-<sha>` (commit SHA)

### Deployment Environment

The workflow uses a `production` environment which can be configured in GitHub repository settings to:
- Require approval before deployment
- Restrict who can approve deployments
- Add deployment protection rules

### Monitoring

After deployment:
- Check pod status: `kubectl get pods -n app-portal`
- View logs: `kubectl logs -n app-portal -l app.kubernetes.io/name=app-portal`
- Access application: `https://<APP_HOSTNAME>`

### Rollback

To rollback to a previous version:
```bash
# View deployment history
kubectl rollout history deployment/app-portal -n app-portal

# Rollback to previous version
kubectl rollout undo deployment/app-portal -n app-portal

# Or rollback to specific revision
kubectl rollout undo deployment/app-portal -n app-portal --to-revision=2
```