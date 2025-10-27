import { ApiBlueprint } from '@backstage/frontend-plugin-api';
import { configApiRef, discoveryApiRef, oauthRequestApiRef } from '@backstage/core-plugin-api';
import { OAuth2 } from '@backstage/core-app-api';
import { oidcAuthApiRef } from '../../apis/oidcAuthApiRef';
import LockIcon from '@material-ui/icons/Lock';

/**
 * OIDC Authentication API Extension
 *
 * Uses OAuth2.create() which automatically provides:
 * - Access token management
 * - ID token support
 * - User profile retrieval
 * - Sign-in/sign-out functionality (SessionApi)
 * - Automatic token refresh
 *
 * The SessionApi interface ensures that the logout button
 * and authentication status work exactly like GitHub auth.
 */
export const oidcAuthApi = ApiBlueprint.make({
  name: 'oidc',
  params: defineParams =>
    defineParams({
      api: oidcAuthApiRef,
      deps: {
        configApi: configApiRef,
        discoveryApi: discoveryApiRef,
        oauthRequestApi: oauthRequestApiRef,
      },
      factory: ({ configApi, discoveryApi, oauthRequestApi }) =>
        OAuth2.create({
          configApi,
          discoveryApi,
          oauthRequestApi,
          provider: {
            id: 'oidc',  // Must match backend provider ID in auth config
            title: 'K8s Cluster',
            icon: LockIcon,
          },
          defaultScopes: ['openid', 'profile', 'email'],
        }),
    }),
});
