# Crossplane Backend Plugin

Backend plugin that provides API endpoints for querying Crossplane resources (XRs) from Kubernetes clusters.

## Features

- Query XR instances by apiVersion and kind
- Filter by namespace (optional)
- Filter by labels (optional)
- Multi-cluster support
- Status information (ready state, conditions)

## API Endpoints

### GET `/api/crossplane/xrs`

Query Crossplane XR instances.

**Query Parameters:**
- `apiVersion` (required) - API version (e.g., `openportal.dev/v1alpha1`)
- `kind` (required) - Resource kind (e.g., `ManagedNamespace`)
- `namespace` (optional) - Filter by namespace
- `cluster` (optional) - Filter by cluster name
- `labelSelector` (optional) - Kubernetes label selector

**Example:**
```bash
curl "http://localhost:7007/api/crossplane/xrs?apiVersion=openportal.dev/v1alpha1&kind=ManagedNamespace"
```

**Response:**
```json
{
  "items": [
    {
      "name": "my-namespace",
      "apiVersion": "openportal.dev/v1alpha1",
      "kind": "ManagedNamespace",
      "cluster": "rancher-desktop",
      "labels": {
        "managed-by": "backstage"
      },
      "status": {
        "ready": true,
        "conditions": [
          {
            "type": "Ready",
            "status": "True",
            "lastTransitionTime": "2025-01-15T10:30:00Z"
          }
        ]
      }
    }
  ]
}
```

## Configuration

### Kubernetes Configuration

The plugin uses the existing Kubernetes configuration from `app-config.yaml`:

```yaml
kubernetes:
  serviceLocatorMethod:
    type: 'multiTenant'
  clusterLocatorMethods:
    - type: 'config'
      clusters:
        - url: ${KUBERNETES_API_URL}
          name: ${KUBERNETES_CLUSTER_NAME}
          authProvider: 'serviceAccount'
          serviceAccountToken: ${KUBERNETES_SERVICE_ACCOUNT_TOKEN}
```

### Authentication Configuration

**Default (Production):** Requires user authentication

```yaml
# No configuration needed - authentication is required by default
```

**Development Mode:** Allow unauthenticated access

```yaml
crossplane:
  allowUnauthenticated: true  # ⚠️ ONLY for development!
```

**Security Notes:**
- **Default:** `allowUnauthenticated: false` - requires user authentication via cookie/token
- **Production:** Never set `allowUnauthenticated: true` in production environments
- **Development:** Only use `allowUnauthenticated: true` for local testing
- When authenticated, users access Crossplane resources based on their permissions

### How Authentication Works

**1. Browser-based (Recommended for Development)**

When using the CrossplaneXRPicker field in templates, authentication happens automatically:
- User logs into Backstage at http://localhost:3000
- Session cookie is automatically sent with API requests
- No additional configuration needed

**2. API Testing with Authentication**

For testing API endpoints directly, you have three options:

**Option A: Enable unauthenticated mode (Development only)**
```yaml
# app-config.local.yaml
crossplane:
  allowUnauthenticated: true
```

Then test with curl:
```bash
curl "http://localhost:7007/api/crossplane-backend/xrs?apiVersion=openportal.dev/v1alpha1&kind=ManagedNamespace"
```

**Option B: Use browser session cookie**
1. Log into Backstage in your browser
2. Open Developer Tools → Network tab
3. Copy the `Cookie` header from any request
4. Use it in curl:
```bash
curl -H "Cookie: <your-cookie-here>" \
  "http://localhost:7007/api/crossplane-backend/xrs?apiVersion=openportal.dev/v1alpha1&kind=ManagedNamespace"
```

**Option C: Use Backstage API token (if configured)**
```bash
curl -H "Authorization: Bearer <your-token>" \
  "http://localhost:7007/api/crossplane-backend/xrs?apiVersion=openportal.dev/v1alpha1&kind=ManagedNamespace"
```

## Installation

```typescript
// packages/backend/src/index.ts
backend.add(import('@internal/plugin-crossplane-backend'));
```

## RBAC Requirements

The Backstage service account needs read access to Crossplane resources:

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: backstage-crossplane-reader
rules:
  - apiGroups: ["openportal.dev"]
    resources: ["*"]
    verbs: ["get", "list"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: backstage-crossplane-reader
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: backstage-crossplane-reader
subjects:
  - kind: ServiceAccount
    name: backstage
    namespace: backstage
```
