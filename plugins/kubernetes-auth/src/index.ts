/**
 * Kubernetes Auth Plugin for Backstage
 *
 * Provides Kubernetes OIDC authentication as a global auth provider.
 *
 * Features:
 * - OAuth2/OIDC authentication with Dex or other K8s OIDC providers
 * - OIDC Discovery for automatic endpoint detection
 * - PKCE for security (no client secret required)
 * - User-specific RBAC - each user sees only their K8s resources
 * - Global auth provider (one-time login, token available app-wide)
 *
 * @packageDocumentation
 */

// Plugin
export {
  kubernetesAuthPlugin,
  kubernetesAuthPlugin as default,
} from './plugin';

// API Reference
export { kubernetesAuthApiRef } from './api/ref';

// API Types
export type { KubernetesAuthApi } from './api/types';

// Provider (for advanced use cases)
export { KubernetesOAuth2Provider } from './api/KubernetesOAuth2Provider';
