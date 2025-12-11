import {
  createApiRef,
  OAuthApi,
  ProfileInfoApi,
  BackstageIdentityApi,
  SessionApi,
} from '@backstage/core-plugin-api';

/**
 * API reference for the Kubernetes Auth API
 *
 * Use this reference to access the Kubernetes Auth API in components:
 *
 * @example
 * ```typescript
 * const kubernetesAuthApi = useApi(kubernetesAuthApiRef);
 * const token = await kubernetesAuthApi.getAccessToken();
 * ```
 *
 * @public
 */
export const kubernetesAuthApiRef = createApiRef<
  OAuthApi & ProfileInfoApi & BackstageIdentityApi & SessionApi
>({
  id: 'plugin.kubernetes.auth',
});
