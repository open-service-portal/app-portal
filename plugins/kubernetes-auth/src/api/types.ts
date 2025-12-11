import {
  OAuthApi,
  ProfileInfoApi,
  BackstageIdentityApi,
  SessionApi,
} from '@backstage/core-plugin-api';

/**
 * Kubernetes Auth API for authenticating users with Kubernetes clusters via OIDC
 *
 * This API provides OAuth2/OIDC authentication for Kubernetes clusters,
 * allowing users to authenticate with their Kubernetes OIDC provider (e.g., Dex)
 * and obtain tokens for accessing cluster resources with their own RBAC permissions.
 *
 * @public
 */
export type KubernetesAuthApi = OAuthApi &
  ProfileInfoApi &
  BackstageIdentityApi &
  SessionApi;
