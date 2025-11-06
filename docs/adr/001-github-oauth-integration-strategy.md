# ADR-001: GitHub OAuth Integration Strategy for User-Behalf Operations

## Status

Accepted

## Context

We are implementing a dual authentication system where:
- **Microsoft Entra ID** serves as the primary identity provider for user authentication and catalog management
- **GitHub OAuth** is needed to obtain user-specific tokens for operations like creating PRs and commits on behalf of users

The challenge is that users in our Backstage catalog come from Microsoft Entra ID, but we need them to authenticate with GitHub to get OAuth tokens for repository operations. The GitHub usernames don't match the Entra ID user identities, creating a mismatch problem.

### Problem Statement

When users try to connect their GitHub account in Backstage Settings → Authentication, the default sign-in resolver attempts to match the GitHub username to a Backstage User entity. However:

1. User entities are imported from Microsoft Entra ID (via Microsoft Graph provider)
2. GitHub usernames don't match Entra ID usernames or email addresses
3. This results in: "Failed to sign-in, unable to resolve user identity"

We need a way to allow GitHub OAuth connections without requiring user identity matching, since the user's identity is already established via Microsoft Entra ID.

## Decision

We will use the `dangerouslyAllowSignInWithoutUserInCatalog: true` configuration option for the GitHub OAuth provider.

### Configuration

```yaml
# app-config/auth.yaml
auth:
  providers:
    github:
      development:
        clientId: ${AUTH_GITHUB_CLIENT_ID}
        clientSecret: ${AUTH_GITHUB_CLIENT_SECRET}
        # GitHub is used for OAuth token access only (creating PRs, commits)
        # Users authenticate via Microsoft Entra ID for Backstage identity
        signIn:
          resolvers:
            - resolver: usernameMatchingUserEntityName
              dangerouslyAllowSignInWithoutUserInCatalog: true
```

### How It Works

1. User signs in with Microsoft Entra ID → establishes Backstage identity
2. User goes to Settings → Authentication → connects GitHub
3. GitHub OAuth succeeds and stores the access token
4. The resolver bypasses catalog user matching
5. User's Microsoft identity is used for all Backstage permissions
6. GitHub token is used solely for API operations (PRs, commits, etc.)

## Consequences

### Positive

- ✅ **Simple implementation** - No custom code required
- ✅ **Works immediately** - No user onboarding friction
- ✅ **Clear separation of concerns** - Microsoft = identity, GitHub = API access
- ✅ **Suitable for trusted environments** - Internal developer portal with known users
- ✅ **Fast iteration** - Allows us to prove the concept quickly

### Negative

- ⚠️ **No validation of GitHub account ownership** - Users can connect any GitHub account
- ⚠️ **Named "dangerously"** - Indicates potential security concerns
- ⚠️ **Audit trail limitations** - Harder to verify which GitHub account belongs to which user
- ⚠️ **Compliance considerations** - May not meet strict security audit requirements

### Risks and Mitigations

**Risk:** Users could connect unauthorized GitHub accounts
- **Mitigation:** Internal environment with trusted users; permissions still controlled by Microsoft identity
- **Impact:** Low - user can only use GitHub tokens for operations, not escalate privileges

**Risk:** Token confusion if user connects wrong GitHub account
- **Mitigation:** Clear UI messaging about which GitHub account is connected
- **Impact:** Medium - could result in operations attributed to wrong GitHub user

## Alternatives Considered

### Alternative 1: Custom Email Matching Resolver

**Description:** Create a custom sign-in resolver that:
1. Calls GitHub API `/user/emails` to get all verified emails
2. Matches any verified email against `spec.profile.email` in Entra ID user entities
3. Only allows connection if match found

**Pros:**
- ✅ Validates GitHub account belongs to the user
- ✅ No "dangerous" configuration
- ✅ Better audit trail and compliance
- ✅ Explicit user-to-GitHub mapping

**Cons:**
- ⚠️ Requires custom code (~50-100 lines)
- ⚠️ Users must add work email to GitHub and verify it
- ⚠️ More onboarding friction
- ⚠️ Maintenance burden

**Decision:** Rejected for now; documented for future consideration

### Alternative 2: GitHub App Installation

**Description:** Use GitHub App installation tokens instead of user OAuth

**Pros:**
- ✅ No user authentication needed
- ✅ Centralized token management

**Cons:**
- ⚠️ Operations not attributed to individual users
- ⚠️ Loses "on behalf of user" functionality
- ⚠️ Doesn't meet requirement for user-specific commits/PRs

**Decision:** Rejected; doesn't meet requirements

### Alternative 3: Remove GitHub Sign-in Resolver

**Description:** Configure GitHub provider without any sign-in resolver

**Pros:**
- ✅ Simplest configuration

**Cons:**
- ⚠️ Doesn't work with current Backstage auth architecture
- ⚠️ Still requires some form of resolver configuration

**Decision:** Rejected; not technically viable

## Implementation Details

### Required OAuth Scopes

GitHub OAuth app needs the following scopes:
- `repo` - Full control of private repositories
- `user:email` - Access user email addresses (for future custom resolver)
- `read:org` - Read organization membership
- `workflow` - Update GitHub Actions workflows (if needed)

### User Experience Flow

1. User navigates to http://localhost:3000
2. User clicks "Sign in using Microsoft Entra ID"
3. Microsoft OAuth flow → user authenticated
4. User sees Backstage interface with their Entra ID identity
5. User goes to Settings (top-right) → Authentication tab
6. User clicks "Connect" on GitHub provider
7. GitHub OAuth flow → token stored in Backstage
8. User can now use templates that create PRs/commits on their behalf

### Security Boundaries

- **Authentication** - Microsoft Entra ID only
- **Authorization** - Based on Microsoft identity and catalog relationships
- **API Access** - GitHub token used for repository operations
- **Audit** - Microsoft identity logged for all actions; GitHub operations use connected token

## Migration Path

If we need to migrate to the custom email resolver in the future:

### Phase 1: Preparation
1. Announce to users: Add work email to GitHub
2. Create migration documentation
3. Set deadline for email addition
4. Monitor compliance

### Phase 2: Implementation
1. Implement custom resolver (see Alternative 1)
2. Deploy to staging environment
3. Test with pilot users
4. Roll out to production

### Phase 3: Cleanup
1. Remove `dangerouslyAllowSignInWithoutUserInCatalog`
2. Update documentation
3. Remove users without verified emails from Settings

## Decision Criteria for Future Review

**Continue with current approach if:**
- Internal environment with trusted users remains
- No compliance audits require stricter controls
- User experience and speed remain priorities
- No incidents related to unauthorized GitHub connections

**Migrate to custom resolver if:**
- Compliance requires validated account ownership
- Need explicit audit trail of GitHub account mappings
- Organization grows beyond trusted internal team
- Security policy changes require stricter validation

## References

- [Backstage Sign-in Resolvers](https://backstage.io/docs/auth/identity-resolver/)
- [GitHub REST API - Emails](https://docs.github.com/en/rest/users/emails)
- [Backstage Auth Troubleshooting](https://backstage.io/docs/auth/troubleshooting/)
- Implementation details: `docs/auth-github-email-resolver.md`

## Notes

Date: 2025-01-06
Participants: Engineering Team
Related ADRs: None (first ADR)
