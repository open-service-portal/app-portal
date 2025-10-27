import { createApiRef } from '@backstage/frontend-plugin-api';
import type {
  OAuthApi,
  OpenIdConnectApi,
  ProfileInfoApi,
  BackstageIdentityApi,
  SessionApi,
} from '@backstage/core-plugin-api';

/**
 * API Reference for OIDC authentication.
 *
 * Implements all standard auth interfaces:
 * - OAuthApi: Access tokens
 * - OpenIdConnectApi: ID tokens
 * - ProfileInfoApi: User profile
 * - BackstageIdentityApi: Backstage identity
 * - SessionApi: Sign-in/sign-out (provides logout button functionality)
 *
 * @public
 */
export const oidcAuthApiRef = createApiRef<
  OAuthApi & OpenIdConnectApi & ProfileInfoApi & BackstageIdentityApi & SessionApi
>({
  id: 'auth.oidc',
});
