import { createBackendModule } from '@backstage/backend-plugin-api';
import {
  authProvidersExtensionPoint,
  commonSignInResolvers,
  createOAuthProviderFactory,
} from '@backstage/plugin-auth-node';
import { kubernetesAuthenticator } from './authenticator';

/**
 * Kubernetes Auth Backend Module
 *
 * Registers the Kubernetes OIDC authentication provider.
 *
 * @public
 */
export const authModuleKubernetesProvider = createBackendModule({
  pluginId: 'auth',
  moduleId: 'kubernetes-provider',
  register(reg) {
    reg.registerInit({
      deps: {
        providers: authProvidersExtensionPoint,
      },
      async init({ providers }) {
        console.log('[KubernetesAuth Backend] Registering Kubernetes auth provider');

        providers.registerProvider({
          providerId: 'kubernetes',
          factory: createOAuthProviderFactory({
            authenticator: kubernetesAuthenticator,
            signInResolverFactories: {
              ...commonSignInResolvers,
            },
          }),
        });
      },
    });
  },
});

export default authModuleKubernetesProvider;
