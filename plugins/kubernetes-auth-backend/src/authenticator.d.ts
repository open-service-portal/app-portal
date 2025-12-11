import { PassportOAuthAuthenticatorHelper } from '@backstage/plugin-auth-node';
/**
 * Kubernetes OIDC Authenticator
 *
 * Implements OAuth2/OIDC authentication flow with:
 * - OIDC Discovery
 * - PKCE support (no client secret)
 * - User profile extraction from ID token
 *
 * @public
 */
export declare const kubernetesAuthenticator: import("@backstage/plugin-auth-node").OAuthAuthenticator<PassportOAuthAuthenticatorHelper, import("@backstage/plugin-auth-node").PassportProfile>;
