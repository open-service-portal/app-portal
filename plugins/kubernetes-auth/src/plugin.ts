import {
  createFrontendModule,
  ApiBlueprint,
  createExtensionBlueprintParams,
} from '@backstage/frontend-plugin-api';
import {
  oauthRequestApiRef,
  configApiRef,
  discoveryApiRef,
  createApiFactory,
} from '@backstage/core-plugin-api';
import { kubernetesAuthApiRef } from './api/ref';
import { KubernetesOAuth2Provider } from './api/KubernetesOAuth2Provider';

/**
 * Kubernetes Auth API Extension
 *
 * @public
 */
const kubernetesAuthApiExtension = ApiBlueprint.make({
  params: () =>
    createExtensionBlueprintParams(
      createApiFactory({
        api: kubernetesAuthApiRef,
        deps: {
          oauthRequestApi: oauthRequestApiRef,
          configApi: configApiRef,
          discoveryApi: discoveryApiRef,
        },
        factory: ({ oauthRequestApi, configApi, discoveryApi }) => {
          // Lazy initialization - only create provider when first accessed
          let providerPromise: Promise<KubernetesOAuth2Provider> | null = null;

          const getProvider = async () => {
            if (!providerPromise) {
              const environment = configApi.getString('auth.environment');

              console.log('[KubernetesAuth] Lazy-initializing provider with config:', {
                environment,
              });

              providerPromise = KubernetesOAuth2Provider.create({
                environment,
                oauthRequestApi,
                configApi,
                discoveryApi,
              });
            }
            return providerPromise;
          };

          // Return a proxy that delegates all calls to the lazy-loaded provider
          return {
            async getAccessToken(scope?: string | string[], options?: { optional?: boolean }) {
              const provider = await getProvider();
              return provider.getAccessToken(scope, options);
            },
            async getIdToken(options?: { optional?: boolean }) {
              const provider = await getProvider();
              return provider.getIdToken(options);
            },
            async getBackstageIdentity() {
              const provider = await getProvider();
              return provider.getBackstageIdentity();
            },
            async getProfile(options?: { optional?: boolean }) {
              const provider = await getProvider();
              return provider.getProfile(options);
            },
            async signIn() {
              const provider = await getProvider();
              return provider.signIn();
            },
            async signOut() {
              const provider = await getProvider();
              return provider.signOut();
            },
            sessionState$() {
              // Eagerly initialize provider for sessionState$ to ensure Observable is available
              if (!providerPromise) {
                getProvider(); // Start initialization
              }
              // Create a deferred Observable that waits for provider initialization
              return {
                subscribe: (observer: any) => {
                  getProvider().then(provider => {
                    const subscription = provider.sessionState$().subscribe(observer);
                    return subscription;
                  }).catch(error => {
                    observer.error(error);
                  });
                  // Return a no-op unsubscribe for now
                  return { unsubscribe: () => {} };
                }
              } as any;
            },
          };
        },
      }),
    ),
});

/**
 * Kubernetes Auth Plugin - Frontend Module
 *
 * Provides global Kubernetes OIDC authentication as an auth provider.
 *
 * Features:
 * - OAuth2/OIDC authentication with Dex (or other K8s OIDC providers)
 * - OIDC Discovery for automatic endpoint detection
 * - Token access for Kubernetes API calls
 * - Available in Settings > Authentication Providers (like GitHub)
 *
 * Usage:
 * 1. User logs in with Microsoft/Guest
 * 2. User goes to Settings > Authentication Providers
 * 3. User connects Kubernetes provider (one-time OAuth flow)
 * 4. Components can then use kubernetesAuthApiRef.getAccessToken() for K8s API calls
 *
 * @public
 */
export const kubernetesAuthPlugin = createFrontendModule({
  pluginId: 'app',
  extensions: [kubernetesAuthApiExtension],
});

/**
 * Default export for convenience
 *
 * @public
 */
export default kubernetesAuthPlugin;
