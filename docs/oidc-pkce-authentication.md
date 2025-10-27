# OIDC Authentication with PKCE

**Version**: Backstage v1.42.0+
**Provider**: Rackspace Auth0
**Last Updated**: 2025-10-27

## Overview

This Backstage instance uses OIDC authentication with PKCE (Proof Key for Code Exchange) for secure authentication without requiring a client secret. This is ideal for public clients where storing secrets securely is not feasible.

### Key Features

- **PKCE Flow**: Enhanced security for public clients
- **No Client Secret**: Code verifier replaces client secret
- **Rackspace SSO**: Integrates with Rackspace Auth0
- **New Backend System**: Uses Backstage's new backend module architecture

## Configuration

### Backend Configuration

**File**: `app-config/auth.yaml`

```yaml
auth:
  environment: development
  providers:
    oidc-pkce:
      development:
        metadataUrl: https://login.spot.rackspace.com/.well-known/openid-configuration
        clientId: mwG3lUMV8KyeMqHe4fJ5Bb3nM1vBvRNa
        # No clientSecret - PKCE flow for public client
        prompt: auto
        additionalAuthParams:
          - key: organization
            value: org_zOuCBHiyF1yG8d1D
        signIn:
          resolvers:
            - resolver: emailMatchingUserEntityProfileEmail
```

**Key Settings:**
- `metadataUrl`: OIDC discovery endpoint for Rackspace Auth0
- `clientId`: Public client ID (safe to commit)
- No `clientSecret`: PKCE replaces client secret authentication
- `organization`: Rackspace organization ID for multi-tenant Auth0

### Frontend Configuration

**File**: `packages/app/src/App.tsx`

The sign-in page includes the OIDC provider:

```typescript
import { oidcPkceAuthApiRef } from './apis/oidcPkceAuthApiRef';

const signInPage = SignInPageBlueprint.make({
  params: {
    loader: async () => props => (
      <SignInPage
        {...props}
        providers={[
          'guest',
          {
            id: 'github-auth-provider',
            title: 'GitHub',
            message: 'Sign in using GitHub',
            apiRef: githubAuthApiRef,
          },
          {
            id: 'oidc-pkce-auth-provider',
            title: 'Rackspace OIDC',
            message: 'Sign in using Rackspace SSO',
            apiRef: oidcPkceAuthApiRef,
          },
        ]}
      />
    ),
  },
});
```

## Implementation Details

### Backend Module

**Location**: `packages/backend/src/auth-providers/`

The custom PKCE authenticator implements:

1. **Manual PKCE Flow**:
   - Generates random code verifier (43-128 characters)
   - Creates SHA256 hash as code challenge
   - Stores verifier in Backstage OAuth state (not Express sessions)

2. **Authorization Request**:
   - Adds `code_challenge` and `code_challenge_method=S256` to auth URL
   - Redirects to Auth0 authorization endpoint

3. **Token Exchange**:
   - Retrieves stored code verifier from OAuth state
   - Exchanges authorization code + code verifier for tokens
   - No client secret sent

**Key Files**:
- `oidc-pkce-authenticator.ts` - PKCE implementation
- `oidc-pkce-module.ts` - Backend module registration
- `oidc-pkce-resolvers.ts` - User identity mapping
- `index.ts` - Module exports

### Frontend API Reference

**Location**: `packages/app/src/apis/oidcPkceAuthApiRef.ts`

```typescript
import { createApiRef } from '@backstage/core-plugin-api';
import type {
  OAuthApi,
  OpenIdConnectApi,
  ProfileInfoApi,
  BackstageIdentityApi,
  SessionApi,
} from '@backstage/core-plugin-api';

export const oidcPkceAuthApiRef = createApiRef<
  OAuthApi & OpenIdConnectApi & ProfileInfoApi & BackstageIdentityApi & SessionApi
>({
  id: 'auth.oidc-pkce',  // Must match backend provider ID
});
```

**Important**: The API ref ID (`auth.oidc-pkce`) must match the backend provider ID in configuration.

## How It Works

### Authentication Flow

```
1. User clicks "Sign in using Rackspace SSO"
   ↓
2. Frontend redirects to /api/auth/oidc-pkce/start
   ↓
3. Backend generates PKCE challenge:
   - code_verifier = random(43-128 chars)
   - code_challenge = base64url(sha256(code_verifier))
   ↓
4. Backend redirects to Auth0 with:
   - code_challenge
   - code_challenge_method=S256
   - organization=org_zOuCBHiyF1yG8d1D
   ↓
5. User authenticates at Rackspace Auth0
   ↓
6. Auth0 redirects to /api/auth/oidc-pkce/handler/frame?code=...
   ↓
7. Backend exchanges code for tokens:
   - Sends: authorization code + code_verifier
   - Receives: access_token, id_token, refresh_token
   ↓
8. Backend resolves user identity via email matching
   ↓
9. Frontend stores session and displays app
```

### Frontend Transparency

The frontend OAuth2 implementation is **identical** whether the backend uses:
- PKCE (public client)
- Client secret (confidential client)
- Any other OAuth2 variant

The frontend only needs:
1. Provider ID (`oidc-pkce`)
2. API reference matching the provider ID
3. Standard OAuth2.create() implementation (provided by Backstage)

**Key Insight**: PKCE is 100% backend-transparent. No custom frontend code is needed.

## Testing

### Start the Application

```bash
cd app-portal
yarn start
```

### Test Sign-In Flow

1. Navigate to http://localhost:3000
2. Click "Sign in using Rackspace SSO"
3. Verify redirect to https://login.spot.rackspace.com
4. Authenticate with Rackspace credentials
5. Verify redirect back to Backstage
6. Check that user profile is loaded

### Verify Backend Logs

Look for these log messages:

```
[auth] Registered provider: oidc-pkce
[auth] Authorization request with PKCE challenge
[auth] Token exchange with code_verifier
[auth] User authenticated: user@example.com
```

## Troubleshooting

### Sign-In Button Not Appearing

**Symptom**: "Rackspace OIDC" button missing from sign-in page

**Check**:
1. API ref is imported in `App.tsx`
2. Provider is added to SignInPage providers array
3. Backend module is loaded in `packages/backend/src/index.ts`

**Solution**: Verify all three components are correctly configured.

### "No implementation available" Error

**Symptom**: `NotImplementedError: No implementation available for apiRef{auth.oidc-pkce}`

**Cause**: API ref ID doesn't match backend provider ID

**Check**:
- API ref: `id: 'auth.oidc-pkce'`
- Config: `auth.providers.oidc-pkce`
- Backend: `providerId: 'oidc-pkce'`

**Solution**: Ensure all three use the same provider ID.

### Infinite Redirect Loop

**Symptom**: Browser keeps redirecting between Backstage and Auth0

**Causes**:
1. Callback URL misconfigured in Auth0
2. Organization parameter incorrect
3. CORS issues

**Check Auth0 Configuration**:
- Allowed Callback URLs: `http://localhost:7007/api/auth/oidc-pkce/handler/frame`
- Allowed Web Origins: `http://localhost:3000`
- Organization ID: `org_zOuCBHiyF1yG8d1D`

### Token Exchange Fails

**Symptom**: Authentication fails after redirect from Auth0

**Possible Causes**:
1. Code verifier not stored correctly
2. State parameter mismatch
3. Code already used (replay)

**Check Backend Logs**:
```
[auth] Token exchange error: <error message>
```

**Solution**: Verify PKCE implementation stores and retrieves code_verifier correctly.

## Security Considerations

### Why PKCE?

**Public Client**: This Backstage instance runs in the browser. Client secrets cannot be stored securely in browser applications.

**PKCE Benefits**:
- Prevents authorization code interception attacks
- No client secret to leak
- Industry standard for SPAs and public clients

### Auth0 Configuration

**Required Settings**:
- Application Type: Single Page Application
- Token Endpoint Authentication Method: None
- Allowed Callback URLs: Only trusted domains
- Organization requirement: Enabled

**Do NOT**:
- Enable client secret authentication
- Allow wildcard callback URLs
- Disable organization requirement

## Development vs Production

### Development Configuration

```yaml
auth:
  providers:
    oidc-pkce:
      development:
        metadataUrl: https://login.spot.rackspace.com/.well-known/openid-configuration
        clientId: mwG3lUMV8KyeMqHe4fJ5Bb3nM1vBvRNa
        prompt: auto
```

**Callback URL**: `http://localhost:7007/api/auth/oidc-pkce/handler/frame`

### Production Configuration

```yaml
auth:
  providers:
    oidc-pkce:
      production:
        metadataUrl: https://login.spot.rackspace.com/.well-known/openid-configuration
        clientId: ${OIDC_CLIENT_ID}  # Use environment variable
        prompt: login  # Force re-authentication
        additionalAuthParams:
          - key: organization
            value: ${OIDC_ORGANIZATION}
```

**Callback URL**: `https://backstage.example.com/api/auth/oidc-pkce/handler/frame`

**Important**: Update Auth0 allowed callback URLs for production domain.

## References

### General OIDC/PKCE Pattern

See workspace documentation for the general implementation pattern:
- **[Auth Providers Guide](../../../docs/backstage/new-frontend-system/05-auth-providers.md)** - Complete OIDC/PKCE pattern
- **[INDEX](../../../docs/backstage/new-frontend-system/INDEX.md)** - All answered questions about auth providers

### Backstage Documentation

- [Auth Providers](https://backstage.io/docs/auth/)
- [New Backend System](https://backstage.io/docs/backend-system/)
- [OAuth2 Providers](https://backstage.io/docs/auth/oauth2/)

### Auth0 Documentation

- [PKCE Flow](https://auth0.com/docs/get-started/authentication-and-authorization-flow/authorization-code-flow-with-proof-key-for-code-exchange-pkce)
- [Organizations](https://auth0.com/docs/manage-users/organizations)

## Maintenance

### Updating Client Configuration

If Auth0 configuration changes (client ID, organization, etc.):

1. Update `app-config/auth.yaml`
2. Restart backend: `yarn start`
3. Clear browser cache
4. Test sign-in flow

### Updating PKCE Implementation

If Backstage releases official PKCE support:

1. Review `@backstage/plugin-auth-backend-module-oidc-provider` changelog
2. Compare with custom implementation
3. Consider migrating to official module
4. Test thoroughly before deploying

### Monitoring

**Key Metrics**:
- Authentication success rate
- Token refresh failures
- User resolution errors (email matching)

**Backend Logs**:
```bash
# Watch auth logs
yarn start | grep '\[auth\]'
```

---

**Last Review**: 2025-10-27
**Next Review**: When upgrading Backstage to next major version
