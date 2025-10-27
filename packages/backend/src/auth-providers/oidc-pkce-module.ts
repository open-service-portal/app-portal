/*
 * Custom OIDC PKCE Provider Module
 *
 * This module registers a custom OIDC authentication provider
 * that supports PKCE for public clients.
 */

import { createBackendModule } from '@backstage/backend-plugin-api';
import {
  authProvidersExtensionPoint,
  createOAuthProviderFactory,
  commonSignInResolvers,
} from '@backstage/plugin-auth-node';
import { oidcPkceAuthenticator } from './oidc-pkce-authenticator';
import { oidcSignInResolvers } from './oidc-pkce-resolvers';

export const authModuleOidcPkceProvider = createBackendModule({
  pluginId: 'auth',
  moduleId: 'oidc-pkce-provider',
  register(reg) {
    reg.registerInit({
      deps: {
        providers: authProvidersExtensionPoint,
      },
      async init({ providers }) {
        providers.registerProvider({
          providerId: 'oidc',
          factory: createOAuthProviderFactory({
            authenticator: oidcPkceAuthenticator,
            signInResolverFactories: {
              ...oidcSignInResolvers,
              ...commonSignInResolvers,
            },
          }),
        });

        console.log('[auth] Registered custom OIDC PKCE provider');
      },
    });
  },
});

// Export the module as default
export default authModuleOidcPkceProvider;
