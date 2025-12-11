# Kubernetes Auth Backend Plugin

Backend authentication provider for Kubernetes OIDC authentication.

## Features

- 🔐 OAuth2/OIDC authentication with Dex (or other K8s OIDC providers)
- ✅ **OIDC Discovery** - Automatic endpoint detection
- ✅ **PKCE** - Proof Key for Code Exchange (no client secret needed)
- 🎯 User profile extraction from ID token
- 👥 Group information from OIDC claims

## Installation

This plugin is already installed in this Backstage app.

### Configuration

Configure in `app-config/auth.yaml`:

```yaml
auth:
  providers:
    kubernetes:
      development:
        issuer: ${AUTH_KUBERNETES_ISSUER}
        clientId: ${AUTH_KUBERNETES_CLIENT_ID}
        # Note: No clientSecret needed for PKCE (Public Client)
```

Set environment variables:

```bash
export AUTH_KUBERNETES_ISSUER="https://kkp.os01.dvint.cloud/dex"
export AUTH_KUBERNETES_CLIENT_ID="kubermaticIssuer"
```

### Backend Registration

The plugin is registered in `packages/backend/src/index.ts`:

```typescript
backend.add(import('@internal/plugin-kubernetes-auth-backend'));
```

## How It Works

1. **Frontend** requests authentication via `kubernetesAuthApiRef`
2. **Backend** redirects to Kubernetes OIDC provider (e.g., Dex)
3. **User** authenticates with OIDC provider
4. **Backend** receives OAuth callback with authorization code
5. **Backend** exchanges code for tokens (using PKCE)
6. **Backend** extracts user profile from ID token
7. **Frontend** receives access token for K8s API calls

## API Endpoints

The backend provides these endpoints:

- `GET /api/auth/kubernetes/start` - Initiate OAuth flow
- `GET /api/auth/kubernetes/handler/frame` - OAuth callback handler
- `GET /api/auth/kubernetes/refresh` - Refresh token

## Development

```bash
# Build plugin
cd plugins/kubernetes-auth-backend
yarn build

# Run tests (when added)
yarn test
```

## Troubleshooting

**Backend not registering provider:**
- Check backend logs for: `[KubernetesAuth Backend] Registering Kubernetes auth provider`
- Verify plugin is added in `packages/backend/src/index.ts`

**OIDC Discovery fails:**
- Check issuer URL is correct and accessible
- Check `.well-known/openid-configuration` endpoint exists
- Fallback endpoints will be used automatically

**OAuth callback fails:**
- Check callback URL matches configuration
- Default: `http://localhost:7007/api/auth/kubernetes/handler/frame`

## License

Apache-2.0
