# Kubernetes Plugin Setup

This document describes how to configure the Backstage Kubernetes plugin to connect to your cluster.

## Prerequisites

- Kubernetes cluster (Rancher Desktop, minikube, or any other)
- kubectl configured and working
- Backstage service account created (done via setup script)

## Configuration Methods

### Method 1: Service Account Token (Recommended)

The setup script automatically creates a service account with the necessary permissions:

```bash
# Run the setup script (already done)
../scripts/setup-rancher-k8s.sh
```

This creates:
- Service account: `backstage-k8s-sa`
- ClusterRoleBinding with cluster-admin permissions
- Token with 1-year expiration

The token is automatically configured in `app-config.local.yaml`:

```yaml
kubernetes:
  serviceLocatorMethod:
    type: 'multiTenant'
  clusterLocatorMethods:
    - type: 'config'
      clusters:
        - url: https://127.0.0.1:6443
          name: rancher-desktop
          authProvider: 'serviceAccount'
          skipTLSVerify: true
          serviceAccountToken: <your-token-here>
```

### Method 2: kubectl Proxy (Alternative)

If you prefer not to use service account tokens, you can use kubectl proxy:

1. Start kubectl proxy in a separate terminal:
```bash
kubectl proxy --port=8001
```

2. Update `app-config.local.yaml`:
```yaml
kubernetes:
  serviceLocatorMethod:
    type: 'multiTenant'
  clusterLocatorMethods:
    - type: 'localKubectlProxy'
```

## Adding Kubernetes Support to Entities

To enable the Kubernetes tab for your catalog entities, add these annotations:

```yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: my-service
  annotations:
    # Required: Kubernetes ID to match resources
    backstage.io/kubernetes-id: my-service
    # Optional: Specify namespace (defaults to 'default')
    backstage.io/kubernetes-namespace: production
spec:
  type: service
  # ... rest of your entity spec
```

## Labeling Kubernetes Resources

Your Kubernetes resources must have matching labels:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-service
  labels:
    backstage.io/kubernetes-id: my-service
spec:
  template:
    metadata:
      labels:
        backstage.io/kubernetes-id: my-service
    # ... rest of your deployment
```

## Testing the Integration

1. Ensure Backstage is running:
```bash
yarn start
```

2. Navigate to a catalog entity with Kubernetes annotations
3. Click on the "Kubernetes" tab
4. You should see associated pods, services, and other resources

## Troubleshooting

### Token Expired

If the service account token expires, regenerate it:

```bash
# Delete old token
kubectl delete secret backstage-k8s-sa-token -n default

# Run setup script again
../scripts/setup-rancher-k8s.sh
```

### Connection Refused

- Verify cluster is running: `kubectl cluster-info`
- Check the cluster URL in app-config.local.yaml matches your cluster
- For Rancher Desktop, ensure the API server is accessible at `https://127.0.0.1:6443`

### No Resources Showing

- Verify entity has correct annotations
- Check Kubernetes resources have matching labels
- Ensure namespace matches between entity annotation and resources
- Check Backstage backend logs for errors

## Security Considerations

The service account has cluster-admin permissions for development. In production:
- Use more restrictive RBAC permissions
- Consider using separate service accounts per namespace
- Rotate tokens regularly
- Use proper TLS certificates instead of skipTLSVerify