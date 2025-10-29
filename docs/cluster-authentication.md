# Cluster Authentication with OIDC Authenticator

This guide explains how to use the OIDC Authenticator daemon to authenticate with Kubernetes clusters from Backstage.

## Overview

The OIDC Authenticator provides a secure way to obtain OIDC tokens for accessing Kubernetes clusters without requiring Backstage to have a public callback URL. This is especially useful when:

- Backstage runs on a private network (laptop, internal network)
- You need user-scoped Kubernetes access (not service account)
- Your Kubernetes clusters use OIDC authentication
- You want a kubectl-oidc-login-like experience for Backstage

## Architecture

```
┌──────────────────┐         ┌───────────────────┐         ┌────────────────┐
│  Backstage UI    │         │ OIDC Authenticator│         │ OIDC Provider  │
│  (Browser)       │         │  (localhost:8000) │         │ (Auth0/Okta)   │
└──────────────────┘         └───────────────────┘         └────────────────┘
         │                            │                             │
         │ 1. Click "Sign In" on K8s  │                             │
         │    Cluster auth provider   │                             │
         │───────────────────────────>│                             │
         │                            │                             │
         │ 2. Open localhost:8000     │                             │
         │    in popup window         │                             │
         │───────────────────────────>│                             │
         │                            │                             │
         │                            │ 3. Redirect to OIDC         │
         │                            │────────────────────────────>│
         │                            │                             │
         │                            │ 4. User authenticates       │
         │<─────────────────────────────────────────────────────────│
         │                            │                             │
         │                            │ 5. Callback with auth code  │
         │                            │<────────────────────────────│
         │                            │                             │
         │                            │ 6. Exchange code for tokens │
         │                            │────────────────────────────>│
         │                            │<────────────────────────────│
         │                            │                             │
┌──────────────────┐                  │                             │
│ Backstage Backend│                  │                             │
│                  │<─────────────────│ 7. Send tokens to backend   │
└──────────────────┘  POST /api/cluster-auth/tokens                 │
         │                                                           │
         │ 8. Tokens stored for user session                        │
         │                                                           │
```

## Components

### 1. OIDC Authenticator Daemon

**Location:** `/Users/felix/work/open-service-portal/portal-workspace/oidc-authenticator/`

A standalone Node.js daemon that:
- Runs on `http://localhost:8000`
- Handles OIDC authentication with PKCE
- Exchanges authorization codes for tokens
- Sends tokens to Backstage backend

### 2. Backend Cluster Auth Plugin

**Location:** `packages/backend/src/plugins/cluster-auth.ts`

Provides three endpoints:

- **`POST /api/cluster-auth/tokens`** - Receives tokens from daemon
- **`GET /api/cluster-auth/status`** - Check if user has valid tokens
- **`GET /api/cluster-auth/token`** - Get access token for K8s API calls

### 3. Frontend Cluster Auth Provider

**Location:** `packages/app/src/components/CustomAuthProviders.tsx`

A custom authentication provider that:
- Appears in Settings > Authentication Providers tab
- Shows authentication status (Authenticated / Not Authenticated)
- Opens authentication window to `localhost:8000?mode=return-tokens`
- Receives tokens via postMessage from daemon
- Sends tokens to backend API
- Supports Sign In, Sign Out, and Re-authenticate actions

### 4. User Profile Component

**Location:** `packages/app/src/components/UserProfile.tsx`

A sidebar component that:
- Shows authenticated user's name with PersonIcon
- Collapses properly with sidebar
- Links to user's catalog profile page
- Updates automatically based on authentication state

## Setup

### Prerequisites

```bash
# Install Node.js 20+ if not already installed
brew install node@20

# Clone or have access to oidc-authenticator
cd /Users/felix/work/open-service-portal/portal-workspace/oidc-authenticator
```

### Configuration

1. **Configure OIDC Authenticator**

Create `config.json` in the oidc-authenticator directory:

```json
{
  "issuer": "https://login.spot.rackspace.com/",
  "clientId": "YOUR_CLIENT_ID",
  "organizationId": "org_xxxxx",
  "backendUrl": "http://localhost:7007",
  "callbackPort": 8000
}
```

Or use environment variables:
```bash
export OIDC_ISSUER_URL=https://login.spot.rackspace.com/
export OIDC_CLIENT_ID=YOUR_CLIENT_ID
export OIDC_ORGANIZATION_ID=org_xxxxx
```

2. **Start Backstage**

```bash
cd app-portal
yarn start
```

Backstage will run on:
- Frontend: http://localhost:3000
- Backend: http://localhost:7007

### Starting the Daemon

**Recommended: Daemon Mode (Production)**

```bash
cd oidc-authenticator
node bin/cli.js start --verbose
```

The daemon will:
- Start immediately and run in the background
- Listen on `http://localhost:8000`
- Wait for user to click "Authenticate" button in Backstage
- Handle authentication and send tokens to backend
- Stay running for future authentications

**Check Daemon Status:**

```bash
# Check if daemon is running
node bin/cli.js status

# Or use curl
curl http://localhost:8000/health
```

**Stop Daemon:**

```bash
node bin/cli.js stop
```

## Usage

### In Backstage UI

1. **Navigate to Settings > Authentication Providers**
   - Click Settings in the left sidebar
   - Navigate to the "Authentication Providers" tab
   - Find the "K8s Cluster" provider

2. **Click "Sign In"**
   - A popup window opens to `localhost:8000?mode=return-tokens`
   - If daemon is not running, the window will show an error

3. **Complete Authentication**
   - The popup window redirects to your OIDC provider
   - Log in with your credentials
   - After successful login, tokens are sent via postMessage
   - The popup window closes automatically
   - Tokens are stored in Backstage backend

4. **Verify Authentication**
   - The K8s Cluster provider status updates to "Authenticated"
   - Shows token expiration time
   - "Sign Out" and "Re-authenticate" buttons become available
   - Your Kubernetes access should now work

### User Profile

A new user profile link appears in the sidebar:
- Shows your username (e.g., "Guest")
- Click to view your catalog profile
- Automatically updates based on authentication state

### Troubleshooting

**Daemon Not Running**

If you see "OIDC Authenticator Not Running":

1. Start the daemon:
   ```bash
   cd oidc-authenticator
   node bin/cli.js start --verbose
   ```

2. Verify it's running:
   ```bash
   curl http://localhost:8000/health
   # Should return: {"status":"running","issuer":"https://..."}
   ```

3. Retry authentication in Backstage

**Popup Blocked**

If the authentication popup doesn't open:

1. Allow popups for `localhost:3000` in your browser
2. Try clicking "Authenticate" again

**Authentication Timeout**

If authentication takes too long:

1. Check daemon logs (if running with `--verbose`)
2. Verify OIDC provider configuration
3. Check network connectivity to OIDC provider

**Port Already in Use**

If port 8000 is already in use:

```bash
# Use a different port
node bin/cli.js start --port 8080

# Update config in oidc-authenticator/config.json
{
  "callbackPort": 8080
}

# Update frontend to check different port (modify ClusterAuthButton.tsx)
```

## Token Storage (TODO)

⚠️ **Current Status:** Token storage is not yet fully implemented.

The backend currently receives tokens but doesn't persist them. To complete the integration, you need to implement token storage in one of these ways:

### Option 1: Express Session (Simple)

Install session middleware:
```bash
cd packages/backend
yarn add express-session @types/express-session
```

Configure in `packages/backend/src/plugins/cluster-auth.ts`:
```typescript
// Store tokens in session
req.session.clusterTokens = {
  accessToken: tokens.access_token,
  idToken: tokens.id_token,
  refreshToken: tokens.refresh_token,
  expiresAt: Date.now() + (tokens.expires_in * 1000)
};
```

### Option 2: Database (Production)

Store tokens in PostgreSQL/SQLite with user association:

```sql
CREATE TABLE cluster_tokens (
  user_id VARCHAR(255) PRIMARY KEY,
  access_token TEXT NOT NULL,
  id_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Option 3: Redis (Scalable)

Use Redis for token caching with TTL:

```typescript
await redis.setex(
  `cluster:tokens:${userId}`,
  tokens.expires_in,
  JSON.stringify(tokens)
);
```

## Security Considerations

### PKCE Flow

The authenticator uses PKCE (Proof Key for Code Exchange) which:
- Protects against authorization code interception
- Doesn't require client secret (safe for public clients)
- Uses SHA256 code challenge

### Token Security

- Tokens are transmitted over HTTPS to OIDC provider
- Tokens are sent to Backstage backend over HTTP (localhost only)
- Tokens should be stored securely in backend (encrypted at rest)
- Tokens should never be logged or exposed in responses

### Network Security

- Daemon binds to `127.0.0.1` (localhost only)
- Not accessible from network
- OIDC provider must allow `http://localhost:PORT` redirects

### State Parameter

- Random state generated per authentication session
- Validated on callback to prevent CSRF attacks
- State mismatch blocks the authentication

## Integration with Kubernetes Plugin

Once tokens are stored, the Kubernetes plugin can use them:

```typescript
// In Kubernetes plugin or custom action
const response = await fetch('/api/cluster-auth/token');
const { access_token } = await response.json();

// Use token to authenticate with Kubernetes API
const k8sClient = new KubernetesClient({
  token: access_token,
  cluster: 'my-cluster',
});
```

## Comparison with Backstage OIDC Auth

| Feature | Backstage OIDC Auth | Cluster Auth via Daemon |
|---------|---------------------|------------------------|
| **Purpose** | Backstage user login | Kubernetes cluster access |
| **Token Scope** | Backstage session | Kubernetes API access |
| **Callback URL** | Backstage backend | Localhost daemon |
| **Public URL Required** | Yes | No |
| **Similar To** | Standard OAuth | kubectl oidc-login |

## Advanced Configuration

### Custom Scopes

Add additional OIDC scopes in `config.json`:

```json
{
  "scopes": "openid profile email groups"
}
```

### Token Refresh

Implement token refresh in backend:

```typescript
if (Date.now() > tokens.expiresAt && tokens.refreshToken) {
  const newTokens = await refreshOIDCToken(tokens.refreshToken);
  // Update stored tokens
}
```

### Multiple Clusters

To support multiple clusters with different OIDC providers:

1. Run multiple daemon instances on different ports
2. Add cluster selection to frontend
3. Configure backend to route tokens by cluster

## Development

### Testing the Integration

1. **Test daemon separately:**
   ```bash
   cd oidc-authenticator
   node bin/cli.js --verbose
   ```

2. **Test backend endpoint:**
   ```bash
   curl -X POST http://localhost:7007/api/cluster-auth/tokens \
     -H 'Content-Type: application/json' \
     -d '{
       "access_token": "test-token",
       "id_token": "test-id-token",
       "token_type": "Bearer",
       "expires_in": 3600
     }'
   ```

3. **Test frontend component:**
   - Open http://localhost:3000/settings
   - Look for "Authenticate with Cluster" button
   - Test with daemon running and not running

### Debugging

Enable verbose logging:

```bash
# Daemon
node bin/cli.js start --verbose

# Backstage backend (check logs for cluster-auth messages)
yarn start --log
```

## Related Documentation

- [OIDC Authenticator README](../../../oidc-authenticator/README.md)
- [Backstage OIDC PKCE Authentication](./oidc-pkce-authentication.md)
- [Kubernetes Authentication Concept](../../../concepts/2025-10-23-oidc-kubernetes-authentication.md)

## Contributing

To improve this integration:

1. Implement token storage (see Token Storage section)
2. Add token refresh logic
3. Integrate with Kubernetes plugin
4. Add tests for authentication flow
5. Improve error handling and user feedback
