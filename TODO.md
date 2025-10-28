# Cluster Authentication - TODO

## Current Status

✅ **Completed:**
- Backend token storage (cluster-auth-store.ts)
- JWT validation with JWKS (cluster-auth-validator.ts)
- Express API endpoints (cluster-auth.ts)
- Backend module registration (cluster-auth-module.ts)
- Frontend authentication button (ClusterAuthButton.tsx)
- Settings page integration
- Comprehensive documentation

🔄 **In Progress:**
- PR #58 ready for review: https://github.com/open-service-portal/app-portal/pull/58

---

## Phase 1: Testing & Integration (1-2 days)

### 1. ✅ Fix Module Loading & Test Basic Functionality
**Priority:** CRITICAL
**Estimated Time:** 15 minutes

```bash
# Restart Backstage (if not running)
cd app-portal
yarn start

# Test token storage API
curl http://localhost:7007/api/cluster-auth/stats
# Expected: {"total":0,"valid":0,"expired":0}

# Store test token
curl -X POST http://localhost:7007/api/cluster-auth/tokens \
  -H 'Content-Type: application/json' \
  -d '{
    "access_token": "test-access-token",
    "id_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiZW1haWwiOiJqb2huLmRvZUBleGFtcGxlLmNvbSIsImlzcyI6Imh0dHBzOi8vbG9naW4uc3BvdC5yYWNrc3BhY2UuY29tLyIsImV4cCI6OTk5OTk5OTk5OX0.fake",
    "token_type": "Bearer",
    "expires_in": 3600
  }'

# Retrieve token
curl 'http://localhost:7007/api/cluster-auth/token?user=user:default/john-doe'
```

**Success Criteria:**
- [ ] Backstage starts without errors
- [ ] `/api/cluster-auth/stats` returns JSON
- [ ] Token storage endpoint accepts tokens
- [ ] Token retrieval endpoint returns stored tokens

---

### 2. Test Frontend Button
**Priority:** HIGH
**Estimated Time:** 10 minutes

**Steps:**
1. Open http://localhost:3000/settings
2. Look for "Authenticate with Cluster" button
3. Click button and verify dialog opens
4. Check daemon health check logic

**Success Criteria:**
- [ ] Button appears in Settings page
- [ ] Dialog opens when clicked
- [ ] Health check detects daemon not running
- [ ] Instructions shown if daemon not available

---

### 3. Test End-to-End with oidc-authenticator Daemon
**Priority:** HIGH
**Estimated Time:** 30 minutes

**Setup:**
```bash
# Terminal 1: Start oidc-authenticator daemon
cd ../oidc-authenticator
node bin/cli.js start --verbose

# Terminal 2: Keep Backstage running
cd app-portal
yarn start
```

**Testing Flow:**
1. Open http://localhost:3000/settings
2. Click "Authenticate with Cluster" button
3. Complete OAuth flow in popup window
4. Verify tokens sent to backend
5. Check database has stored tokens

**Success Criteria:**
- [ ] Daemon starts on localhost:8000
- [ ] Health check detects daemon running
- [ ] OAuth popup opens successfully
- [ ] User completes authentication
- [ ] Backend receives tokens via POST /api/cluster-auth/tokens
- [ ] Tokens stored in database
- [ ] Dialog shows "Already Authenticated" after success

**Files to Check:**
- Backend logs: `yarn start --log` in app-portal
- Daemon logs: Run with `--verbose` flag
- Database: Check `cluster_tokens` table exists

---

## Phase 2: User Context Integration (1-2 days)

### 4. Get User from Backstage Auth Context
**Priority:** HIGH
**Estimated Time:** 3-4 hours

**Problem:** Currently uses `?user=` query parameter (INSECURE)

**Solution:** Extract user from Backstage authentication context

**Files to Modify:**
- `packages/backend/src/plugins/cluster-auth.ts`

**Implementation:**
```typescript
// Add to cluster-auth.ts
import { getBearerTokenFromAuthorizationHeader } from '@backstage/plugin-auth-node';

// Helper function to get user from request
async function getUserEntityRef(req: Request): Promise<string> {
  // Option 1: From Backstage auth token
  const token = getBearerTokenFromAuthorizationHeader(req);
  // Decode token and extract user entity ref

  // Option 2: From Backstage identity API
  // const identity = await identityApi.getIdentity({ request: req });
  // return identity.userEntityRef;

  // For now, temporary fallback
  const userFromQuery = req.query.user as string;
  if (!userFromQuery) {
    throw new Error('User not authenticated');
  }
  return userFromQuery;
}

// Update all endpoints:
router.get('/status', async (req, res) => {
  const userEntityRef = await getUserEntityRef(req);
  const hasValid = await tokenStore.hasValidTokens(userEntityRef);
  res.json({ authenticated: hasValid });
});

router.get('/token', async (req, res) => {
  const userEntityRef = await getUserEntityRef(req);
  const tokens = await tokenStore.getTokens(userEntityRef);
  // ... rest of logic
});

router.delete('/tokens', async (req, res) => {
  const userEntityRef = await getUserEntityRef(req);
  await tokenStore.deleteTokens(userEntityRef);
  res.json({ status: 'ok' });
});
```

**Success Criteria:**
- [ ] Endpoints no longer require `?user=` parameter
- [ ] User automatically extracted from Backstage session
- [ ] Security improved (users can't access other users' tokens)
- [ ] Tests pass with authenticated requests

**Testing:**
```bash
# Get Backstage auth token
TOKEN=$(curl http://localhost:3000/... | jq -r '.token')

# Test with auth header
curl http://localhost:7007/api/cluster-auth/status \
  -H "Authorization: Bearer $TOKEN"
```

---

### 5. Update Frontend to Remove User Parameter
**Priority:** MEDIUM
**Estimated Time:** 1 hour

**Files to Modify:**
- `packages/app/src/components/ClusterAuthButton.tsx`

**Changes:**
```typescript
// Remove ?user= from all fetch calls
const response = await fetch('/api/cluster-auth/status');
const { authenticated } = await response.json();

// Token retrieval
const tokenResponse = await fetch('/api/cluster-auth/token');
const { access_token } = await tokenResponse.json();

// Logout
await fetch('/api/cluster-auth/tokens', { method: 'DELETE' });
```

**Success Criteria:**
- [ ] Frontend uses authenticated endpoints
- [ ] No manual user parameter needed
- [ ] Button works for logged-in users

---

## Phase 3: Token Refresh (2-3 days)

### 6. Implement Refresh Token Logic
**Priority:** MEDIUM
**Estimated Time:** 4-6 hours

**Problem:** Expired tokens require re-authentication

**Solution:** Automatically refresh using refresh_token

**Files to Modify:**
- `packages/backend/src/plugins/cluster-auth.ts`

**Implementation:**
```typescript
// Add refresh function
async function refreshOIDCToken(
  refreshToken: string,
  issuer: string,
  clientId: string
): Promise<OIDCTokens> {
  const response = await fetch(`${issuer}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
    }),
  });

  if (!response.ok) {
    throw new Error(`Token refresh failed: ${response.statusText}`);
  }

  return await response.json();
}

// Update GET /token endpoint
router.get('/token', async (req, res) => {
  const userEntityRef = await getUserEntityRef(req);
  let tokens = await tokenStore.getTokens(userEntityRef);

  if (!tokens) {
    return res.status(401).json({
      error: 'Not authenticated',
      message: 'No cluster tokens found. Please authenticate first.',
    });
  }

  // Check expiration and refresh if needed
  if (tokens.expiresAt.getTime() < Date.now()) {
    if (!tokens.refreshToken) {
      return res.status(401).json({
        error: 'Token expired',
        message: 'Cluster token has expired. Please re-authenticate.',
      });
    }

    try {
      logger.info('Refreshing expired token', { user: userEntityRef });
      const newTokens = await refreshOIDCToken(
        tokens.refreshToken,
        tokens.issuer,
        config.clientId
      );

      // Update stored tokens
      await tokenStore.saveTokens({
        userEntityRef,
        accessToken: newTokens.access_token,
        idToken: newTokens.id_token,
        refreshToken: newTokens.refresh_token || tokens.refreshToken,
        issuer: tokens.issuer,
        expiresAt: new Date(Date.now() + newTokens.expires_in * 1000),
      });

      tokens = await tokenStore.getTokens(userEntityRef);
      logger.info('Token refreshed successfully', { user: userEntityRef });
    } catch (error) {
      logger.error('Token refresh failed', error);
      return res.status(401).json({
        error: 'Token refresh failed',
        message: 'Unable to refresh expired token. Please re-authenticate.',
      });
    }
  }

  res.json({
    access_token: tokens.accessToken,
    token_type: 'Bearer',
    expires_at: tokens.expiresAt.toISOString(),
  });
});
```

**Configuration:**
```yaml
# app-config.yaml
clusterAuth:
  issuer: https://login.spot.rackspace.com/
  clientId: ${OIDC_CLIENT_ID}
```

**Success Criteria:**
- [ ] Expired tokens automatically refreshed
- [ ] New tokens stored in database
- [ ] Refresh failures trigger re-authentication
- [ ] Logging shows refresh attempts
- [ ] Users don't experience interruptions

---

## Phase 4: Kubernetes Plugin Integration (3-5 days)

### 7. Use Stored Tokens in Kubernetes Operations
**Priority:** HIGH
**Estimated Time:** 6-8 hours

**Goal:** Replace service account tokens with user OIDC tokens for K8s operations

**Option A: Custom Scaffolder Action**

Create custom scaffolder action that uses cluster tokens:

```typescript
// packages/backend/src/scaffolder/actions/kube-apply-with-user-token.ts
import { createTemplateAction } from '@backstage/plugin-scaffolder-node';

export function createKubeApplyWithUserTokenAction() {
  return createTemplateAction({
    id: 'portal:kube:apply',
    description: 'Apply Kubernetes manifest with user OIDC token',
    schema: {
      input: {
        required: ['manifest', 'cluster'],
        type: 'object',
        properties: {
          manifest: { type: 'string' },
          cluster: { type: 'string' },
        },
      },
    },
    async handler(ctx) {
      // Get user from context
      const userEntityRef = ctx.user?.entity?.metadata?.name;

      // Fetch cluster token
      const tokenResponse = await fetch(
        `/api/cluster-auth/token?user=${userEntityRef}`
      );
      const { access_token } = await tokenResponse.json();

      // Use token for K8s operation
      const k8sClient = new KubernetesClient({
        cluster: ctx.input.cluster,
        token: access_token,
      });

      await k8sClient.apply(ctx.input.manifest);
      ctx.logger.info('Manifest applied with user token');
    },
  });
}
```

**Option B: Modify Kubernetes Plugin**

Modify existing K8s plugin to use cluster tokens instead of service account.

**Files to Create/Modify:**
- `packages/backend/src/scaffolder/actions/kube-apply-with-user-token.ts` (new)
- `packages/backend/src/scaffolder/index.ts` (register action)

**Success Criteria:**
- [ ] Scaffolder actions use user OIDC tokens
- [ ] K8s operations attributed to user identity
- [ ] RBAC enforced at cluster level
- [ ] Audit logs show actual user, not service account

---

### 8. Test User-Scoped RBAC
**Priority:** HIGH
**Estimated Time:** 2-3 hours

**Kubernetes RBAC Setup:**
```yaml
# Create RoleBinding for OIDC users
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: oidc-users-edit
  namespace: default
subjects:
- kind: User
  name: john.doe@example.com  # From OIDC email claim
  apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: ClusterRole
  name: edit
  apiGroup: rbac.authorization.k8s.io
```

**Testing:**
```bash
# Test user permissions
kubectl auth can-i list pods \
  --as=john.doe@example.com \
  --namespace=default

# Test with actual user token
TOKEN=$(curl http://localhost:7007/api/cluster-auth/token | jq -r '.access_token')

kubectl get pods \
  --token=$TOKEN \
  --server=https://kubernetes.api.example.com
```

**Success Criteria:**
- [ ] Users can only access allowed namespaces
- [ ] RBAC enforced based on OIDC identity
- [ ] Unauthorized actions properly denied
- [ ] Audit logs show actual user identity

---

## Phase 5: Production Hardening (Ongoing)

### 9. Security Enhancements
**Priority:** HIGH (before production)
**Estimated Time:** 2-3 days

**Tasks:**
- [ ] Enable JWT signature verification
  ```yaml
  # app-config.yaml
  clusterAuth:
    issuer: https://login.spot.rackspace.com/
    verifySignature: true  # Enable this!
  ```
- [ ] Add rate limiting to token endpoints
  ```typescript
  import rateLimit from 'express-rate-limit';

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
  });

  router.use('/api/cluster-auth', limiter);
  ```
- [ ] Implement audit logging
  ```typescript
  // Log all token access
  router.get('/token', async (req, res) => {
    const user = await getUserEntityRef(req);
    auditLogger.log({
      action: 'TOKEN_ACCESS',
      user,
      timestamp: new Date(),
      ip: req.ip,
    });
    // ... rest of handler
  });
  ```
- [ ] Add token revocation endpoint
  ```typescript
  router.post('/revoke', async (req, res) => {
    const user = await getUserEntityRef(req);
    await tokenStore.deleteTokens(user);
    // Optionally: revoke with OIDC provider
    res.json({ status: 'revoked' });
  });
  ```
- [ ] Encrypt sensitive data in database
  ```typescript
  // Use Backstage's encryption for tokens at rest
  import { encryptionService } from '@backstage/backend-common';
  ```

---

### 10. Monitoring & Observability
**Priority:** MEDIUM
**Estimated Time:** 2-3 days

**Metrics to Track:**
- [ ] Token storage operations (create/read/update/delete)
- [ ] Token expiration rates
- [ ] Refresh success/failure rates
- [ ] Authentication errors
- [ ] API endpoint latency

**Implementation:**
```typescript
// Add Prometheus metrics
import { register, Counter, Histogram } from 'prom-client';

const tokenAccessCounter = new Counter({
  name: 'cluster_auth_token_access_total',
  help: 'Total number of token access requests',
  labelNames: ['status'],
});

const tokenRefreshCounter = new Counter({
  name: 'cluster_auth_token_refresh_total',
  help: 'Total number of token refresh attempts',
  labelNames: ['status'],
});

// Add metrics endpoint
router.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

**Alerts:**
- [ ] High authentication failure rate
- [ ] Token refresh failures
- [ ] Database connection issues
- [ ] OIDC provider unavailable

---

### 11. Documentation Updates
**Priority:** MEDIUM
**Estimated Time:** 1-2 days

**Tasks:**
- [ ] Add troubleshooting guide
  - Common errors and solutions
  - Daemon setup issues
  - Token storage problems
  - RBAC configuration
- [ ] Document token lifecycle
  - Creation → Storage → Retrieval → Refresh → Expiration
  - Flowcharts and diagrams
- [ ] Create video walkthrough
  - End-to-end demo
  - Setup instructions
  - Common use cases
- [ ] Update architecture diagrams
  - Add sequence diagrams
  - Component interaction flows
  - Security boundaries

**Files to Update/Create:**
- `docs/cluster-authentication.md` (enhance existing)
- `docs/troubleshooting/cluster-auth.md` (new)
- `docs/architecture/cluster-auth-flow.md` (new)

---

## Quick Reference

### API Endpoints

| Endpoint | Method | Description | Status |
|----------|--------|-------------|--------|
| `/api/cluster-auth/tokens` | POST | Receive tokens from daemon | ✅ Done |
| `/api/cluster-auth/status` | GET | Check auth status | ✅ Done |
| `/api/cluster-auth/token` | GET | Get access token | ✅ Done |
| `/api/cluster-auth/stats` | GET | Get statistics | ✅ Done |
| `/api/cluster-auth/tokens` | DELETE | Delete tokens | ✅ Done |
| `/api/cluster-auth/refresh` | POST | Manually refresh | ⏳ TODO |
| `/api/cluster-auth/revoke` | POST | Revoke tokens | ⏳ TODO |
| `/api/cluster-auth/metrics` | GET | Prometheus metrics | ⏳ TODO |

### Key Files

**Backend:**
- `packages/backend/src/plugins/cluster-auth.ts` - Main plugin
- `packages/backend/src/plugins/cluster-auth-store.ts` - Database ops
- `packages/backend/src/plugins/cluster-auth-validator.ts` - JWT validation
- `packages/backend/src/plugins/cluster-auth-module.ts` - Module registration

**Frontend:**
- `packages/app/src/components/ClusterAuthButton.tsx` - Auth button
- `packages/app/src/modules/userSettings/index.tsx` - Settings integration

**Docs:**
- `docs/cluster-authentication.md` - User guide
- `docs/cluster-auth-backend-analysis.md` - Architecture analysis
- `docs/cluster-auth-implementation-summary.md` - Implementation summary

### Testing Checklist

- [ ] Unit tests for token store operations
- [ ] Integration tests for API endpoints
- [ ] E2E tests with oidc-authenticator daemon
- [ ] Security tests (JWT validation, SQL injection, XSS)
- [ ] Performance tests (token storage/retrieval latency)
- [ ] Load tests (concurrent authentication requests)

---

## Questions / Blockers

**Current Questions:**
1. Which Backstage API should we use to get current user from request?
2. Do we need to support multiple OIDC providers?
3. Should tokens be scoped per cluster or global?
4. What's the token expiration policy (1 hour, 24 hours)?

**Potential Blockers:**
1. OIDC provider rate limiting during refresh
2. Backstage auth context extraction complexity
3. Kubernetes RBAC configuration requirements
4. Database migration in production

---

## Progress Tracking

**Legend:**
- ✅ Done
- 🔄 In Progress
- ⏳ TODO
- 🔴 Blocked

### Overall Progress: ~40%

- ✅ **Token Storage** (100%)
- ✅ **JWT Validation** (100%)
- ✅ **Basic API** (100%)
- ✅ **Frontend Button** (100%)
- ⏳ **End-to-End Testing** (0%)
- ⏳ **User Context** (0%)
- ⏳ **Token Refresh** (0%)
- ⏳ **K8s Integration** (0%)
- ⏳ **Production Hardening** (0%)

---

## Timeline Estimate

| Phase | Tasks | Estimated Time | Status |
|-------|-------|----------------|--------|
| Phase 1 | Testing & Integration | 1-2 days | 🔄 In Progress |
| Phase 2 | User Context | 1-2 days | ⏳ TODO |
| Phase 3 | Token Refresh | 2-3 days | ⏳ TODO |
| Phase 4 | K8s Integration | 3-5 days | ⏳ TODO |
| Phase 5 | Production Hardening | Ongoing | ⏳ TODO |

**Total Estimated Time:** 7-12 days (1.5-2.5 weeks)

---

## Notes

- See PR #58 for current implementation: https://github.com/open-service-portal/app-portal/pull/58
- Backend is ~50% simpler than traditional OAuth because daemon handles OAuth/PKCE flow
- All token storage uses existing Backstage database infrastructure
- Frontend uses Material-UI for consistent UX

---

**Last Updated:** 2025-10-28
**Maintained By:** Development Team
**Status:** Active Development
