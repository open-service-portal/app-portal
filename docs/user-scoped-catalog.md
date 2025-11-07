### **⚠️ IMPORTANT: Read This First!**

## User-Scoped Catalog: Architectural Decision

I've created the code for user-scoped catalog fetching, but **I strongly recommend NOT using it** unless you have a specific requirement.

## Why This Is Non-Standard

### Standard Backstage Catalog

```
┌─────────────────────────────────────────────────────────────┐
│ EntityProvider (Background Task)                            │
│ - Runs every 60s                                            │
│ - No user context                                           │
│ - Fetches ALL resources                                     │
│ - Stores in catalog database                                │
└──────────────┬───────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│ Catalog Database                                            │
│ - All entities stored                                       │
│ - Fast queries                                              │
│ - Cached data                                               │
└──────────────┬───────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│ User Queries /api/catalog/entities                          │
│ - Fast (database query)                                     │
│ - All users see same data                                   │
│ - Optional: Filter with Permission Plugin                   │
└─────────────────────────────────────────────────────────────┘
```

### User-Scoped Catalog (What I Created)

```
┌─────────────────────────────────────────────────────────────┐
│ User Queries /api/user-catalog/entities                     │
└──────────────┬───────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│ UserScopedKubernetesFetcher                                 │
│ - Gets user's OIDC token from database                      │
│ - Calls Kubernetes API with user's token                    │
│ - K8s enforces user's RBAC                                  │
│ - Returns only accessible resources                         │
└──────────────┬───────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│ Returns Fresh Data (No Database)                            │
│ - No caching                                                │
│ - Each user sees different results                          │
│ - Slow (K8s API call per request)                           │
└─────────────────────────────────────────────────────────────┘
```

## Comparison

| Aspect | Standard Catalog | User-Scoped Catalog |
|--------|-----------------|-------------------|
| **Speed** | ✅ Fast (database) | ❌ Slow (K8s API) |
| **Caching** | ✅ Yes | ❌ No |
| **Scalability** | ✅ Good | ❌ Poor |
| **Multi-tenancy** | ⚠️ Via permissions | ✅ Native |
| **Real-time** | ❌ 60s delay | ✅ Immediate |
| **K8s API Load** | ✅ Low | ❌ High |
| **Complexity** | ✅ Simple | ❌ Complex |
| **Maintainability** | ✅ Standard pattern | ❌ Custom solution |

## Recommended Approach

### Option 1: Kubernetes Plugin Only (Recommended) ✅

**What you already have:**
- Standard catalog with XRDs, Templates (from ingestor)
- Kubernetes plugin shows Pods/Deployments (with user RBAC)

**How it works:**
```
1. Catalog shows: Templates, APIs, Systems (public info)
2. User clicks entity → "Kubernetes" tab
3. Kubernetes plugin uses user's token (clusterAuth)
4. Shows only Pods/Deployments user can access
```

**Pros:**
- ✅ Standard Backstage architecture
- ✅ Fast catalog queries
- ✅ User RBAC enforced where it matters (Kubernetes tab)
- ✅ Easy to maintain

**Cons:**
- ⚠️ Catalog itself shows all entities (but K8s tab filters)

**This is what most Backstage users do!**

### Option 2: Permission Plugin (Standard Backstage Way)

Add permission-based filtering to catalog queries:

```typescript
// In catalog backend
const decision = await permissions.authorize({
  permission: catalogEntityReadPermission,
  resourceRef: entityRef,
});

if (decision.result === AuthorizeResult.DENY) {
  // Hide entity from user
}
```

**Pros:**
- ✅ Standard Backstage pattern
- ✅ Keeps catalog performance
- ✅ Well-documented
- ✅ Community support

**Cons:**
- ⚠️ Requires permission rules configuration
- ⚠️ Permissions checked against catalog, not K8s RBAC
- ⚠️ Need to sync permissions with K8s RBAC

### Option 3: User-Scoped Catalog (What I Created)

Use the custom `/api/user-catalog/entities` endpoint.

**Pros:**
- ✅ True K8s RBAC enforcement
- ✅ Users NEVER see inaccessible entities
- ✅ Real-time data (no cache staleness)

**Cons:**
- ❌ Slow (K8s API call per catalog query)
- ❌ High K8s API load
- ❌ Non-standard architecture
- ❌ Harder to maintain
- ❌ Doesn't work with standard Backstage UI
- ❌ Requires custom frontend changes

## My Recommendation

**Use Option 1** (what you already have):

1. Catalog shows Templates, APIs, Systems (public/discoverable)
2. Kubernetes plugin enforces user RBAC (Pods, Deployments)
3. Simple, fast, maintainable

**Why:**
- Templates and APIs are meant to be discoverable (like a menu)
- Actual resources (Pods, Deployments) are RBAC-filtered
- This is how Backstage is designed to work
- You get both discoverability and security

## When to Use User-Scoped Catalog

Only if you have **strict regulatory requirements** like:
- HIPAA/SOC2 compliance requiring zero visibility of other resources
- Multi-tenant SaaS where customers must NEVER see each other's data
- Government/defense systems with clearance-based access

**For internal platform engineering: Option 1 is better!**

## Implementation (If You Really Need It)

If you decide to proceed with user-scoped catalog:

### 1. Register the Router

Create a new plugin in `packages/backend/src/plugins/user-scoped-catalog-module.ts`:

```typescript
import { createBackendPlugin } from '@backstage/backend-plugin-api';
import { createUserScopedCatalogRouter } from './user-scoped-catalog-router';
import { UserScopedKubernetesFetcher } from './user-scoped-kubernetes-catalog-provider';

export const userScopedCatalogPlugin = createBackendPlugin({
  pluginId: 'user-catalog',
  register(env) {
    env.registerInit({
      deps: {
        logger: coreServices.logger,
        http: coreServices.httpRouter,
        httpAuth: coreServices.httpAuth,
        database: coreServices.database,
        config: coreServices.rootConfig,
      },
      async init({ logger, http, httpAuth, database, config }) {
        const clusterAuthStore = await ClusterAuthStore.create(database, logger);

        const kubernetesFetcher = new UserScopedKubernetesFetcher({
          logger,
          config,
          clusterAuthStore,
        });

        const router = await createUserScopedCatalogRouter({
          logger,
          httpAuth,
          kubernetesFetcher,
        });

        http.use(router);
      },
    });
  },
});
```

### 2. Register in Backend

Add to `packages/backend/src/index.ts`:

```typescript
// User-scoped catalog (if using custom approach)
backend.add(import('./plugins/user-scoped-catalog-module'));
```

### 3. Update Frontend (Custom Implementation)

You'll need to create a custom catalog page that queries `/api/user-catalog/entities` instead of `/api/catalog/entities`.

This requires:
- Custom React components
- Custom catalog API client
- Bypassing standard Backstage catalog UI

**This is a LOT of work!**

## Testing User-Scoped Catalog

If you implement it:

```bash
# List entities user can access
curl http://localhost:7007/api/user-catalog/entities \
  -H "Cookie: ${SESSION_COOKIE}"

# Get stats
curl http://localhost:7007/api/user-catalog/stats \
  -H "Cookie: ${SESSION_COOKIE}"

# Get specific entity
curl http://localhost:7007/api/user-catalog/entities/by-name/Component/default/my-pod \
  -H "Cookie: ${SESSION_COOKIE}"
```

## Summary

**Files Created** (for reference, not deployment):
- `user-scoped-kubernetes-catalog-provider.ts` - Fetcher logic
- `user-scoped-catalog-router.ts` - Custom API endpoints
- `user-scoped-catalog.md` - This doc

**Recommendation:**
- ✅ Stick with standard Kubernetes plugin (clusterAuth) ← **DO THIS**
- ❌ Don't use user-scoped catalog unless absolutely necessary

**What You Already Have is Better:**
- Templates visible to all (discoverability) ✅
- Kubernetes resources filtered by user (security) ✅
- Fast, maintainable, standard Backstage ✅

## Questions to Ask Yourself

1. **Do users need to see templates?**
   - YES → Standard catalog is fine
   - NO → You have bigger UX issues

2. **Is catalog performance important?**
   - YES → Standard catalog (database)
   - NO → User-scoped (K8s API)

3. **Can you tolerate 60s delay for entity updates?**
   - YES → Standard catalog
   - NO → User-scoped (but consider cost)

4. **How many users will query catalog simultaneously?**
   - < 10 → Either works
   - > 50 → Standard catalog only

5. **Is this a strict multi-tenant SaaS?**
   - YES → Consider user-scoped
   - NO (internal platform) → Standard catalog

## Final Recommendation

**Keep what you have!**

Your current setup is:
- ✅ Standard Backstage architecture
- ✅ Fast and scalable
- ✅ User RBAC enforced via Kubernetes plugin
- ✅ Templates discoverable (good for UX)
- ✅ Actual resources filtered (good for security)

The user-scoped catalog I created is **architecturally interesting** but **practically unnecessary** for most use cases.

**Only implement it if you have a regulatory/compliance requirement that mandates zero visibility of other users' catalog entries.**

For internal platform engineering, the standard approach is better! 🎯
