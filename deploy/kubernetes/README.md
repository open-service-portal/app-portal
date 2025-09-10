# Kubernetes Deployment for App Portal (Backstage)

This directory contains Kubernetes manifests for deploying the App Portal (Backstage) application.

## Structure

- `base/` - Base Kubernetes manifests using Kustomize
  - `namespace.yaml` - Namespace definition
  - `secret.yaml` - Secrets for GitHub App and configuration
  - `deployment.yaml` - Main application deployment
  - `service.yaml` - ClusterIP service
  - `ingress.yaml` - Ingress for external access
  - `kustomization.yaml` - Kustomize configuration

## Prerequisites

1. Kubernetes cluster with:
   - NGINX Ingress Controller (or modify ingress.yaml for your controller)
   - cert-manager with ClusterIssuer `letsencrypt-prod` configured (for TLS certificates)
   - DNS configured to point `app.openportal.dev` to your ingress IP
     - If using ExternalDNS, it will automatically manage the DNS record via annotations

2. GitHub App credentials:
   - App ID
   - Client ID
   - Client Secret
   - Installation ID
   - Private Key (PEM format)

3. Docker image pushed to registry:
   ```bash
   ./build-backend.sh
   ./docker-build.sh
   ./docker-push.sh
   ```

## Configuration

### 1. Update Secrets

The secrets use environment variable placeholders. You can either:

**Option A: Use envsubst (recommended)**
```bash
# Export your GitHub App credentials (same as .env.enc)
export AUTH_GITHUB_APP_ID="your-app-id"
export AUTH_GITHUB_CLIENT_ID="your-client-id"
export AUTH_GITHUB_CLIENT_SECRET="your-client-secret"
export AUTH_GITHUB_APP_INSTALLATION_ID="your-installation-id"
export GITHUB_APP_PRIVATE_KEY="$(cat github-app-key.pem)"

# Apply with substitution
envsubst < kubernetes/base/secret.yaml | kubectl apply -f -
```

**Option B: Edit the file directly**
Replace the placeholders in `base/secret.yaml`:
- `${AUTH_GITHUB_APP_ID}` → your GitHub App ID
- `${AUTH_GITHUB_CLIENT_ID}` → your Client ID
- `${AUTH_GITHUB_CLIENT_SECRET}` → your Client Secret
- `${AUTH_GITHUB_APP_INSTALLATION_ID}` → your Installation ID
- `${GITHUB_APP_PRIVATE_KEY}` → contents of your private key file

### 2. Update Base URLs (if needed)

If deploying to a different domain, update in `base/secret.yaml`:

```yaml
APP_BASE_URL: "https://your-domain.com"
BACKEND_BASE_URL: "https://your-domain.com"
```

And update the host in `base/ingress.yaml`:

```yaml
rules:
- host: your-domain.com
```

### 3. Update Image Tag

In `base/deployment.yaml`, update the image tag to match your build:

```yaml
image: ghcr.io/open-service-portal/backstage:dev-sqlite-XXXXXXX
```

## Deployment

### Using Kustomize

```bash
# Deploy to cluster
kubectl apply -k kubernetes/base/

# Or preview first
kubectl kustomize kubernetes/base/
```

### Direct Apply

```bash
# Apply all manifests
kubectl apply -f kubernetes/base/
```

## Verify Deployment

```bash
# Check if pod is running
kubectl get pods -n app-portal

# Check logs
kubectl logs -n app-portal -l app.kubernetes.io/name=app-portal

# Check service
kubectl get svc -n app-portal

# Check ingress
kubectl get ingress -n app-portal
```

## Access the Application

Once deployed, access the application at:
- https://app.openportal.dev

## Troubleshooting

### Pod not starting
```bash
# Check pod events
kubectl describe pod -n app-portal -l app.kubernetes.io/name=app-portal

# Check logs
kubectl logs -n app-portal -l app.kubernetes.io/name=app-portal --previous
```

### GitHub App authentication issues
- Verify the private key is correctly formatted in the secret
- Check that all GitHub App environment variables are set
- Ensure the Installation ID matches your GitHub organization

### Ingress not working
- Verify DNS is pointing to your ingress controller's external IP
  - If using ExternalDNS, check logs: `kubectl logs -n external-dns deployment/external-dns`
- Check ingress controller logs
- Ensure the ingress class matches your controller

## Security Notes

1. **Never commit real secrets** to the repository
2. Consider using:
   - Sealed Secrets
   - External Secrets Operator
   - SOPS for secret encryption
3. The GitHub private key is mounted as read-only with restricted permissions (0400)

## Production Considerations

1. **Database**: Currently using in-memory SQLite. For production, configure PostgreSQL
2. **Replicas**: Increase replica count for high availability
3. **Resources**: Adjust resource requests/limits based on load
4. **TLS**: Already configured with Let's Encrypt via cert-manager
5. **Monitoring**: Add Prometheus metrics and alerts
6. **Backup**: Implement backup strategy for persistent data