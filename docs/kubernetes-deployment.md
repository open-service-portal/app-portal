# Kubernetes Deployment for App Portal (Backstage)

Automated deployment of App Portal (Backstage) to Kubernetes using environment variable substitution.

## Quick Start

```bash
# Source your environment variables (from portal-workspace)
source ../.env.rancher-desktop  # or your cluster-specific env file

# Deploy to cluster
./kubernetes-deploy.sh

# Or dry-run (generate manifests only)
./kubernetes-deploy.sh --dry-run
```

## Prerequisites

1. **Kubernetes cluster with:**
   - NGINX Ingress Controller
   - cert-manager with ClusterIssuer `letsencrypt-prod` (for TLS)
   - ExternalDNS configured (optional, for automatic DNS management)

2. **Environment variables set:**
   - `APP_HOSTNAME` - Application hostname (e.g., app.example.com)
   - `DOCKER_IMAGE` - Docker image to deploy
   - `AUTH_GITHUB_APP_ID` - GitHub App ID
   - `AUTH_GITHUB_CLIENT_ID` - GitHub App Client ID
   - `AUTH_GITHUB_CLIENT_SECRET` - GitHub App Client Secret
   - `AUTH_GITHUB_APP_INSTALLATION_ID` - GitHub App Installation ID
   - `GITHUB_APP_PRIVATE_KEY` - GitHub App private key (PEM format)

3. **Docker image built and pushed:**
   ```bash
   ./build-backend.sh
   ./docker-build.sh
   ./docker-push.sh
   ```

## Deployment Script

The `kubernetes-deploy.sh` script:
- Validates required environment variables
- Generates Kubernetes manifests from templates in `examples/kubernetes/base/`
- Applies manifests to your cluster (or dry-run)
- Constructs APP_BASE_URL and BACKEND_BASE_URL from APP_HOSTNAME if not set

### Usage

```bash
# Deploy to cluster (default behavior)
./kubernetes-deploy.sh

# Dry run - only generate manifests
./kubernetes-deploy.sh --dry-run

# Custom output directory
./kubernetes-deploy.sh -o ./my-manifests

# Show help
./kubernetes-deploy.sh --help
```

### Generated Files

The script creates these manifests in `kubernetes-manifests/`:
- `namespace.yaml` - app-portal namespace
- `secret.yaml` - GitHub App credentials and config
- `deployment.yaml` - Application deployment
- `service.yaml` - ClusterIP service
- `ingress.yaml` - Ingress with TLS and ExternalDNS annotations
- `kustomization.yaml` - Kustomize configuration

## Manual Deployment

If you prefer manual deployment:

```bash
# Export required variables
export APP_HOSTNAME=app.example.com
export DOCKER_IMAGE=ghcr.io/org/app:v1.0.0
# ... export other required vars ...

# Generate manifests
mkdir -p kubernetes-manifests
for file in examples/kubernetes/base/*.yaml; do
  envsubst < "$file" > "kubernetes-manifests/$(basename $file)"
done

# Apply to cluster
kubectl apply -f kubernetes-manifests/
```

## Verify Deployment

```bash
# Check pod status
kubectl get pods -n app-portal

# View logs
kubectl logs -n app-portal -l app.kubernetes.io/name=app-portal

# Check ingress
kubectl get ingress -n app-portal

# Access the application
curl https://${APP_HOSTNAME}
```

## Troubleshooting

### Pod not starting
```bash
kubectl describe pod -n app-portal -l app.kubernetes.io/name=app-portal
kubectl logs -n app-portal -l app.kubernetes.io/name=app-portal --previous
```

### GitHub App authentication issues
- Verify environment variables are set correctly
- Check private key format (should include header/footer)
- Ensure Installation ID matches your GitHub organization

### DNS/Ingress issues
- Verify DNS points to ingress controller IP
- For ExternalDNS: `kubectl logs -n external-dns deployment/external-dns`
- Check ingress: `kubectl describe ingress -n app-portal app-portal`

## Security Notes

- Never commit real secrets to the repository
- Environment variables should be sourced from secure storage
- GitHub private key is mounted read-only with 0400 permissions
- Consider using Sealed Secrets or External Secrets Operator for production

## Production Considerations

1. **Database**: Switch from SQLite to PostgreSQL
2. **High Availability**: Increase replica count
3. **Resources**: Adjust CPU/memory limits based on load
4. **Monitoring**: Add Prometheus metrics
5. **Backup**: Implement persistent data backup strategy