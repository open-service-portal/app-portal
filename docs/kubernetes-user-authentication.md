# Kubernetes User Authentication

This document explains how user-level authentication works for Kubernetes resources in Backstage.

## Overview

By default, Backstage uses a shared service account token to access Kubernetes clusters. This means:
- ❌ All users see the same resources (everything the service account can access)
- ❌ All operations appear as `system:serviceaccount:backstage:backstage-sa` in audit logs
- ❌ No user-level RBAC enforcement

With **user-level authentication**, each user authenticates with their own credentials:
- ✅ Users only see resources they have RBAC permissions for
- ✅ Kubernetes audit logs show the actual user (e.g., `alice@example.com`)
- ✅ Cluster RBAC policies are enforced
- ✅ Better security and compliance

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ User Browser                                                │
│ ┌─────────────┐                                            │
│ │ Backstage UI│ → "Authenticate with Cluster" button       │
│ └──────┬──────┘                                            │
│        │ Opens localhost:8000                               │
└────────┼───────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ oidc-authenticator Daemon (localhost:8000)                  │
│ - Handles OAuth2/PKCE flow                                  │
│ - User logs in with OIDC provider (Auth0/Rackspace)        │
│ - Obtains access_token, id_token, refresh_token            │
│ - POSTs tokens to Backstage: /api/cluster-auth/tokens      │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ Backstage Backend - cluster-auth Plugin                     │
│ - Validates tokens (optional JWT verification)              │
│ - Extracts user identity from Backstage session            │
│ - Stores in database: cluster_tokens table                 │
│   {                                                         │
│     user_entity_ref: "user:default/alice",                 │
│     access_token: "eyJhbGc...",                            │
│     expires_at: "2025-11-06T..."                           │
│   }                                                         │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ Backstage Backend - kubernetes Plugin                       │
│ ┌─────────────────────────────────────────────────────┐    │
│ │ Custom Auth Provider: 'clusterAuth'                 │    │
│ │ 1. Extracts user from request context               │    │
│ │ 2. Fetches token from cluster_tokens table          │    │
│ │ 3. Decorates K8s client config with user's token    │    │
│ └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ Kubernetes Cluster                                          │
│ - Receives API calls with user's Bearer token              │
│ - Validates OIDC token against configured OIDC provider     │
│ - Enforces RBAC based on user's identity and groups        │
│ - Audit logs show: user=alice@example.com                  │
└─────────────────────────────────────────────────────────────┘
```

## Components

### 1. cluster-auth Plugin (Token Storage)

**Location:** `packages/backend/src/plugins/cluster-auth.ts`

**What it does:**
- Receives OIDC tokens from oidc-authenticator daemon
- Validates tokens (optional JWT signature verification)
- Stores tokens in `cluster_tokens` database table
- Provides API endpoints for token management

**API Endpoints:**
- `POST /api/cluster-auth/tokens` - Store tokens (called by daemon)
- `GET /api/cluster-auth/status` - Check if user has valid tokens
- `GET /api/cluster-auth/token` - Retrieve user's access token
- `DELETE /api/cluster-auth/tokens` - Logout (delete tokens)

### 2. ClusterAuthKubernetesProvider (Auth Provider)

**Location:** `packages/backend/src/plugins/kubernetes-auth-provider.ts`

**What it does:**
- Implements `KubernetesAuthProvider` interface
- Fetches user tokens from `cluster_tokens` table
- Decorates Kubernetes client with user's Bearer token
- Checks token expiration and provides helpful error messages

**Key Method:**
```typescript
async decorateClusterDetailsWithAuth(
  clusterDetails: any,
  requestContext: { credentials: any }
): Promise<any>
```

### 3. kubernetes-cluster-auth-module (Registration)

**Location:** `packages/backend/src/plugins/kubernetes-cluster-auth-module.ts`

**What it does:**
- Registers the custom auth provider with kubernetes-backend plugin
- Makes `authProvider: 'clusterAuth'` available in configuration
- Follows Backstage New Backend System patterns

## Configuration

### Step 1: Configure cluster-auth Plugin

In `app-config/auth.yaml`:

```yaml
clusterAuth:
  issuer: https://login.spot.rackspace.com/  # Optional: for JWT validation
  verifySignature: false  # Set to true for production
```

### Step 2: Configure Kubernetes Cluster

In `app-config/kubernetes.yaml` or `app-config.openportal.local.yaml`:

```yaml
kubernetes:
  serviceLocatorMethod:
    type: 'multiTenant'
  clusterLocatorMethods:
    - type: 'config'
      clusters:
        # Production cluster with user-level auth
        - url: https://hcp-ebadc4bb-307d-482e-a9d9-fdca15fd5ff1.spot.rackspace.com/
          name: openportal
          authProvider: 'clusterAuth'  # ← Custom provider
          skipTLSVerify: false
          caData: ${KUBERNETES_OPENPORTAL_CA_DATA}

        # Local dev cluster with service account (no user auth)
        - url: https://127.0.0.1:6443
          name: rancher-desktop
          authProvider: 'serviceAccount'
          serviceAccountToken: ${K8S_SA_TOKEN}
          skipTLSVerify: true
```

### Step 3: Environment Variables

Add to `.env.openportal`:

```bash
# Kubernetes cluster CA certificate (base64 encoded)
KUBERNETES_OPENPORTAL_CA_DATA=LS0tLS1CRUdJTi...

# For local dev clusters (service account auth)
KUBERNETES_SERVICE_ACCOUNT_TOKEN=eyJhbGc...
```

Extract CA data from kubeconfig:
```bash
kubectl config view --raw -o jsonpath='{.clusters[?(@.name=="openportal")].cluster.certificate-authority-data}'
```

## User Workflow

### First-Time Setup

1. **User logs into Backstage** (via GitHub OAuth)
   - User: `user:default/alice`

2. **User navigates to cluster authentication**
   - Visit: Settings → Auth Providers → Kubernetes Cluster
   - Or visit: `/cluster-auth` page
   - Click: "Authenticate with Cluster" button

3. **Browser opens oidc-authenticator daemon**
   - Opens: `http://localhost:8000`
   - User completes OIDC login flow (Auth0/Rackspace)
   - Daemon POSTs tokens to `/api/cluster-auth/tokens`

4. **Backend stores tokens**
   - Tokens stored in database under user's entity ref
   - Expiration tracked (typically 3 days)

5. **User accesses Kubernetes resources**
   - Navigate to any entity with Kubernetes tab
   - Backend automatically uses user's token
   - User sees only resources they have RBAC access to

### Token Expiration

When tokens expire (after ~3 days):
- User receives error: "Cluster authentication expired"
- User must re-authenticate via Settings → Auth Providers
- Process repeats from step 2 above

## Security Considerations

### Token Storage

- ✅ Tokens stored encrypted in Backstage database
- ✅ Only the user who authenticated can retrieve their tokens
- ✅ Tokens automatically expire (respects JWT `exp` claim)
- ⚠️ No refresh tokens stored (must re-authenticate when expired)

### RBAC Enforcement

- ✅ Kubernetes enforces RBAC based on OIDC token claims
- ✅ Users cannot see resources they don't have access to
- ✅ Failed operations return proper 403 Forbidden errors
- ✅ Audit logs show actual user identity

### Cluster Configuration

- ✅ Per-cluster authentication strategy
- ✅ Can mix service account (dev) and user auth (prod) clusters
- ✅ TLS certificate validation enforced (skipTLSVerify: false)

## Troubleshooting

### Error: "No cluster authentication found"

**Cause:** User hasn't authenticated with the cluster yet

**Solution:**
1. Visit Settings → Auth Providers
2. Click "Authenticate with Cluster"
3. Complete OIDC login flow

### Error: "Cluster authentication expired"

**Cause:** User's OIDC tokens have expired (after ~3 days)

**Solution:**
1. Visit Settings → Auth Providers
2. Re-authenticate with the cluster

### Error: "User not authenticated or invalid credentials"

**Cause:** User isn't logged into Backstage

**Solution:**
1. Log in to Backstage (via GitHub)
2. Then authenticate with the cluster

### Error: "Forbidden (403)" when viewing resources

**Cause:** User's Kubernetes RBAC permissions don't allow access

**Solution:**
- Contact platform team to grant necessary RBAC permissions
- Example: Create RoleBinding for user's email in the namespace

### Resources not appearing in Kubernetes tab

**Possible Causes:**
1. User doesn't have RBAC permissions (expected behavior)
2. Token expired (re-authenticate)
3. Wrong cluster selected (check cluster name)

**Debug Steps:**
```bash
# Check user's RBAC permissions directly
kubectl auth can-i list pods --namespace=my-namespace --as=alice@example.com

# Check if user's token is valid
curl -H "Authorization: Bearer ${TOKEN}" https://k8s-api-url/api/v1/namespaces
```

## Testing

### Test Service Account Auth (Baseline)

```yaml
- name: rancher-desktop
  authProvider: 'serviceAccount'
  serviceAccountToken: ${K8S_SA_TOKEN}
```

**Expected:** All users see the same resources (service account permissions)

### Test User Auth (New Behavior)

```yaml
- name: openportal
  authProvider: 'clusterAuth'
```

**Expected:**
1. User must authenticate first
2. Each user sees different resources (based on their RBAC)
3. Audit logs show user identity

### Verify RBAC Enforcement

```bash
# Create test user with limited permissions
kubectl create namespace team-a
kubectl create rolebinding alice-viewer \
  --clusterrole=view \
  --user=alice@example.com \
  --namespace=team-a

# Alice should only see team-a resources
# Bob should see nothing (no permissions)
```

## Migration Strategy

### Phase 1: Add User Auth (Non-Breaking)

1. Keep existing service account configuration
2. Add new cluster with `authProvider: 'clusterAuth'`
3. Test with volunteers
4. Gather feedback

### Phase 2: Production Rollout

1. Update production clusters to use `clusterAuth`
2. Communicate to users about authentication requirement
3. Monitor error rates and user feedback
4. Fine-tune error messages

### Phase 3: Deprecate Service Account (Future)

1. Remove service account auth for production clusters
2. Keep for local development only
3. All production access uses user tokens

## Comparison: Service Account vs User Auth

| Aspect | Service Account | User Auth (clusterAuth) |
|--------|----------------|-------------------------|
| **Setup** | Simple (one token) | Requires OIDC + daemon |
| **Visibility** | All users see same | Each user sees their resources |
| **RBAC** | Bypassed | Enforced |
| **Audit** | Shows service account | Shows actual user |
| **Security** | Single point of failure | Per-user credentials |
| **Compliance** | ❌ Poor | ✅ Good |
| **UX** | Zero friction | Requires authentication step |

## Implementation Details

### How Auth Provider Works

The kubernetes-backend plugin calls `decorateClusterDetailsWithAuth()` before each API call:

```typescript
// 1. User makes request to view pod logs
GET /api/kubernetes/proxy/pods/my-pod/log

// 2. kubernetes-backend extracts credentials from request
const credentials = await httpAuth.credentials(req);
// → { principal: { type: 'user', userEntityRef: 'user:default/alice' } }

// 3. kubernetes-backend calls our custom auth provider
const authenticatedCluster = await authProvider.decorateClusterDetailsWithAuth(
  clusterDetails,
  { credentials }
);
// → Fetches alice's token from cluster_tokens table
// → Returns: { ...clusterDetails, user: { token: 'eyJhbGc...' } }

// 4. kubernetes-backend creates K8s client with user's token
const k8sApi = new CoreV1Api({
  ...clusterConfig,
  headers: { Authorization: `Bearer ${authenticatedCluster.user.token}` }
});

// 5. K8s API validates token and enforces RBAC
// → Only returns resources alice has access to
```

### Token Lifecycle

```
1. User authenticates → Token stored (expires_at = now + 3 days)
2. Request arrives → Check if token expired
   - If expired: Return 401 "Token expired"
   - If valid: Use token for K8s API call
3. Token expiration → User must re-authenticate
```

No automatic refresh because:
- oidc-authenticator daemon handles refresh logic
- Keeps backend simple (no refresh token management)
- User re-authentication is infrequent (every 3 days)

## Future Enhancements

### Token Refresh (Phase 3)

Store refresh tokens and automatically refresh access tokens:

```typescript
// If access token expired but refresh token valid
if (isAccessTokenExpired() && hasRefreshToken()) {
  const newTokens = await refreshAccessToken(refreshToken);
  await store.saveTokens(newTokens);
}
```

### Multi-Cluster Support

Allow users to authenticate with multiple clusters:

```yaml
clusterAuth:
  clusters:
    - name: openportal
      issuer: https://login.spot.rackspace.com/
    - name: aws-prod
      issuer: https://login.aws.com/
```

### Catalog Filtering

Filter catalog entities based on user's K8s permissions:

```typescript
// Only show catalog entries for resources user can access
const entities = await catalog.getEntities();
const filtered = entities.filter(entity =>
  userHasK8sAccess(entity.metadata.namespace)
);
```

## Related Documentation

- [Cluster Authentication Concept](../../../concepts/2025-10-23-oidc-kubernetes-authentication.md)
- [Phase 4 Implementation Plan](../../../concepts/2025-10-30-phase4-kubernetes-user-authentication.md)
- [Backstage Kubernetes Plugin](https://backstage.io/docs/features/kubernetes/)
- [Kubernetes RBAC](https://kubernetes.io/docs/reference/access-authn-authz/rbac/)

## References

- Source: `packages/backend/src/plugins/cluster-auth.ts` - Token storage
- Source: `packages/backend/src/plugins/kubernetes-auth-provider.ts` - Auth provider
- Source: `packages/backend/src/plugins/kubernetes-cluster-auth-module.ts` - Registration
- Config: `app-config/auth.yaml` - cluster-auth settings
- Config: `app-config/kubernetes.yaml` - Cluster configuration
