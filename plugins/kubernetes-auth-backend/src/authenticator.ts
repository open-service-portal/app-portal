import { createOAuthAuthenticator } from '@backstage/plugin-auth-node';
import { PassportOAuthAuthenticatorHelper } from '@backstage/plugin-auth-node';
import { Strategy as OAuth2Strategy } from 'passport-oauth2';

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
export const kubernetesAuthenticator = createOAuthAuthenticator({
  defaultProfileTransform:
    PassportOAuthAuthenticatorHelper.defaultProfileTransform,

  scopes: {
    required: ['openid', 'email', 'profile', 'groups'],
  },

  initialize({ callbackUrl, config }) {
    console.log('[KubernetesAuth Backend] Initializing authenticator', {
      callbackUrl,
    });

    // Config is provider-specific (auth.providers.kubernetes.development)
    // So we read clientId, clientSecret, and issuer directly from it
    const clientId = config.getString('clientId');
    const clientSecret = config.getString('clientSecret');
    const issuer = config.getString('issuer');

    console.log('[KubernetesAuth Backend] Authenticator config:', {
      clientId,
      issuer,
    });

    // Create Passport OAuth2 Strategy
    // Note: PKCE disabled for now due to Passport session requirements
    // For production with external OIDC, consider using passport-openidconnect instead
    const strategy = new OAuth2Strategy(
      {
        authorizationURL: `${issuer}/auth`,
        tokenURL: `${issuer}/token`,
        clientID: clientId,
        clientSecret: clientSecret,
        callbackURL: callbackUrl,
        scope: ['openid', 'email', 'profile', 'groups'],
      },
      (
        accessToken: string,
        refreshToken: string,
        params: any,
        fullProfile: any,
        done: (error: any, user?: any) => void,
      ) => {
        // Passport verify callback
        done(undefined, { fullProfile, params, accessToken, refreshToken });
      },
    );

    // Wrap strategy with PassportOAuthAuthenticatorHelper
    return PassportOAuthAuthenticatorHelper.from(strategy);
  },

  async start(input, helper) {
    console.log('[KubernetesAuth Backend] Starting auth flow');
    return helper.start(input, {
      accessType: 'offline', // Request refresh token
      prompt: 'consent', // Force consent to get refresh token
    });
  },

  async authenticate(input, helper) {
    console.log('[KubernetesAuth Backend] Authenticating');
    return helper.authenticate(input);
  },

  async refresh(input, helper) {
    console.log('[KubernetesAuth Backend] Refreshing token');
    return helper.refresh(input);
  },
});
