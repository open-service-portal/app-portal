# TeraSky Kubernetes Ingestor

The TeraSky Kubernetes Ingestor automatically discovers Kubernetes resources and Crossplane XRDs, importing them into Backstage and generating templates.

## Installation

1. **Install the plugins**:
```bash
yarn add @terasky/backstage-plugin-kubernetes-ingestor
yarn add @terasky/backstage-plugin-crossplane-resources-frontend
yarn add @terasky/backstage-plugin-scaffolder-backend-module-terasky-utils
```

2. **Add to backend** (`packages/backend/src/index.ts`):
```typescript
backend.add(import('@terasky/backstage-plugin-kubernetes-ingestor'));
backend.add(import('@terasky/backstage-plugin-scaffolder-backend-module-terasky-utils'));
```

3. **Run the setup script** to create Kubernetes service account:
```bash
./scripts/setup-cluster.sh
# This creates backstage-k8s-sa with necessary permissions
# AND automatically generates/updates app-config.local.yaml with the token
# Note: app-config.local.yaml is in .gitignore for security - never commit tokens!
```

## Configuration

### Minimal app-config.yaml
```yaml
kubernetesIngestor:
  components:
    enabled: true
    taskRunner:
      frequency: 10  # Scan every 10 seconds
  
  crossplane:
    enabled: true
    xrds:
      enabled: true
      ingestAllXRDs: true  # Generate templates from all labeled XRDs
```

### Cluster Configuration

The setup script automatically generates `app-config.local.yaml` with:
```yaml
kubernetes:
  clusterLocatorMethods:
    - type: 'config'
      clusters:
        - url: https://127.0.0.1:6443  # Your actual cluster URL
          name: rancher-desktop         # Your actual cluster name
          authProvider: 'serviceAccount'
          skipTLSVerify: true
          serviceAccountToken: <AUTO_GENERATED_TOKEN>
```

**Security Note:** `app-config.local.yaml` is gitignored (via `*.local.yaml` pattern) to prevent accidentally committing tokens.

Alternatively, use environment variables:
```bash
export KUBERNETES_API_URL=https://127.0.0.1:6443
export KUBERNETES_CLUSTER_NAME=rancher-desktop
export KUBERNETES_SERVICE_ACCOUNT_TOKEN=<your-token>
```

## Getting Your Services Into Backstage

### Option A: Auto-generate Templates from XRDs ✨
Add this label to your XRDs and templates are created automatically:

```yaml
apiVersion: apiextensions.crossplane.io/v2
kind: CompositeResourceDefinition
metadata:
  name: xclusters.platform.example.com
  labels:
    terasky.backstage.io/generate-form: "true"  # ← This triggers template generation
spec:
  group: platform.example.com
  versions:
    - name: v1alpha1  # Results in template: xclusters.platform.example.com-v1alpha1
```

**Result**: Template appears in `/create` page within 10 minutes

### Option B: Auto-import Kubernetes Workloads
Label your Kubernetes resources:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  labels:
    backstage.io/kubernetes-id: my-service
```

**Result**: Automatically imported as Component (if `components.enabled: true`)

### Option C: Add Kubernetes to Existing Entities
Annotate your catalog entities:

```yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: my-service
  annotations:
    backstage.io/kubernetes-id: my-service
    backstage.io/kubernetes-namespace: default
```

**Result**: Kubernetes tab shows resources matching the ID

## Troubleshooting

### "numOfCustomResources=0" in logs
**This is normal!** It refers to Kubernetes workloads (Deployments, Services), not XRDs. Check if templates are being generated instead.

### Templates not generating from XRDs
1. **Check the label**: Must be exactly `terasky.backstage.io/generate-form: "true"`
2. **Check Crossplane version**: We use v2, XRDs must be `apiextensions.crossplane.io/v2`
3. **Wait 10 minutes**: XRD scanning runs every 600 seconds
4. **Check with auth**: 
   ```bash
   # Get auth token
   TOKEN=$(curl -s -X POST http://localhost:7007/api/auth/guest/refresh -H "Content-Type: application/json" -d '{}' | jq -r '.backstageIdentity.token')
   # Check templates
   curl -s http://localhost:7007/api/catalog/entities?filter=kind%3Dtemplate -H "authorization: Bearer $TOKEN" | jq '[.[] | .metadata.name]'
   ```

### Service account token expired
```bash
# Option 1: Re-run the setup script (it will update app-config.local.yaml)
./scripts/setup-cluster.sh

# Option 2: Manually generate new token
kubectl create token backstage-k8s-sa --duration=365d
# Then update app-config.local.yaml or set KUBERNETES_SERVICE_ACCOUNT_TOKEN
```

### XRDs not found
```bash
# Verify XRDs exist
kubectl get xrds

# Check labels
kubectl get xrds -o json | jq '.items[].metadata.labels'

# Apply example XRD (create one based on the example above)
```

## How It Works

1. **KubernetesEntityProvider** runs every 10 seconds, scanning for labeled Kubernetes resources
2. **XRDTemplateEntityProvider** runs every 600 seconds, finding XRDs with the magic label
3. Templates are generated from XRD OpenAPI schemas
4. Templates are registered in catalog with origin: `cluster origin: rancher-desktop`

## Examples

### XRD that generates a template
Example XRD with the required label:
- Has label `terasky.backstage.io/generate-form: "true"`
- Uses Crossplane v2 API
- Results in template `xmongodbs.platform.example.com-v1alpha1`

```yaml
apiVersion: apiextensions.crossplane.io/v2
kind: CompositeResourceDefinition
metadata:
  name: xmongodbs.platform.example.com
  labels:
    terasky.backstage.io/generate-form: "true"
spec:
  group: platform.example.com
  # ... rest of XRD spec
```

### Entity with Kubernetes
```yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: my-app
  annotations:
    backstage.io/kubernetes-id: my-app
    backstage.io/kubernetes-namespace: production
spec:
  type: service
  owner: team-a
```

### Crossplane annotations for entities
```yaml
# For v2 XRs (Crossplane 2.0)
annotations:
  crossplane.terasky.io/xr-name: my-cluster-xyz
  crossplane.terasky.io/xr-apiversion: v1alpha1
  crossplane.terasky.io/xr-kind: XCluster
```

## Status Pages

- **Kubernetes Status**: http://localhost:3000/kubernetes
- **Crossplane Status**: http://localhost:3000/crossplane-resources
- **Generated Templates**: http://localhost:3000/create?filters%5Bkind%5D=template

## API Endpoints

- Clusters: `http://localhost:7007/api/kubernetes/clusters` (requires auth)
- Templates: `http://localhost:7007/api/catalog/entities?filter=kind=template` (requires auth)

## Tips

- Templates are named `{xrd-name}-{version}` (e.g., `xclusters.platform.example.com-v1alpha1`)
- Each XRD version gets its own template
- The Ingestor uses the Kubernetes plugin's cluster configuration
- Check `/crossplane-resources` page for current status and what's working