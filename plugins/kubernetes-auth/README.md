# Kubernetes Auth Plugin

Backstage plugin providing Kubernetes OIDC authentication as a global auth provider.

## Features

- 🔐 OAuth2/OIDC authentication with Dex (or other K8s OIDC providers)
- 🌐 Global auth provider (like Microsoft Auth, Google Auth)
- 🎯 One-time login - token available app-wide
- 👥 User-specific RBAC - each user sees only their K8s resources
- ✅ **OIDC Discovery** - Automatic endpoint detection
- ✅ **PKCE** - Proof Key for Code Exchange (no client secret needed)
- ✅ **Safe JWT decoding** - Proper base64url handling

## Installation

This plugin is already installed in this Backstage app.

### Configuration

Set environment variables:

```bash
# For Kubermatic/Dex
export AUTH_KUBERNETES_ISSUER="https://kkp.os01.dvint.cloud/dex"
export AUTH_KUBERNETES_CLIENT_ID="kubermaticIssuer"
```

Configuration is in `app-config/auth.yaml`:

```yaml
auth:
  providers:
    kubernetes:
      development:
        issuer: ${AUTH_KUBERNETES_ISSUER}
        clientId: ${AUTH_KUBERNETES_CLIENT_ID}
```

## Usage

### In Components

```typescript
import { useApi } from '@backstage/core-plugin-api';
import { kubernetesAuthApiRef } from '../../../plugins/kubernetes-auth/src';

export const MyComponent = () => {
  const kubernetesAuthApi = useApi(kubernetesAuthApiRef);

  const fetchData = async () => {
    // Get K8s access token
    const token = await kubernetesAuthApi.getAccessToken();

    // Use token in API calls
    const response = await fetch('/api/kubernetes/resources', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
  };

  // ...
};
```

### User Flow

1. User opens Backstage → SignIn page appears
2. User clicks "Kubernetes" provider
3. OAuth2 popup opens with Dex login
4. User authenticates → token stored globally
5. All features can now use the token via `kubernetesAuthApiRef`

## Phase 1 MVP Implementation

This is the **Phase 1 MVP** with critical security fixes:

✅ **OIDC Discovery** - Fetches `.well-known/openid-configuration`
✅ **PKCE** - No client secret required (public client)
✅ **Safe JWT Decoding** - Proper base64url handling
✅ **signOut()** - Clear session support
✅ **Logging** - Console logs for debugging

## API Reference

### KubernetesAuthApi

```typescript
interface KubernetesAuthApi extends OAuthApi {
  getAccessToken(
    scope?: string | string[],
    options?: { optional?: boolean },
  ): Promise<string>;

  getProfile(
    options?: { optional?: boolean }
  ): Promise<ProfileInfo>;

  signOut(): Promise<void>;
}
```

## Development

```bash
# Build plugin
cd plugins/kubernetes-auth
yarn build

# Run tests (when added)
yarn test
```

## Testing

### 1. Check Token Format

After login, check the browser console for:
```
[KubernetesAuth] Token payload: {
  email: "user@example.com",
  groups: 2,
  aud: ["kubernetes", ...]
}
```

### 2. Verify Token Works with K8s

```bash
# Get token from browser (after login)
# Open DevTools → Application → Storage → Session Storage
# Look for kubernetes-oidc-session

# Test with kubectl
kubectl --token="<your-token>" get namespaces
```

## Troubleshooting

**OIDC Discovery fails:**
- Check issuer URL is correct
- Check `.well-known/openid-configuration` endpoint is accessible
- Fallback endpoints will be used automatically

**Token not valid for K8s API:**
- Check `aud` (audience) claim in token
- May need token exchange if audience doesn't match
- Check K8s API server OIDC configuration

**Browser console errors:**
- Check environment variables are set
- Check auth.yaml configuration
- Look for `[KubernetesAuth]` prefixed log messages

## Next Phases

**Phase 2: Production-Ready**
- Token refresh handling
- Better error messages
- Token expiry notifications

**Phase 3: Polish**
- Observable token changes
- Multi-cluster support
- K8s icon for provider
- Unit tests

## License

Apache-2.0
