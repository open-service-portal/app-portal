import { OAuth2 } from '@backstage/core-app-api';
import type { OAuthApi, ProfileInfoApi, BackstageIdentityApi, SessionApi, ConfigApi, OAuthRequestApi, DiscoveryApi } from '@backstage/core-plugin-api';

const DEFAULT_PROVIDER = {
  id: 'kubernetes',
  title: 'Kubernetes',
  icon: () => null,
};

type CreateOptions = {
  /**
   * Discovery API for finding backend endpoints
   */
  discoveryApi: DiscoveryApi;

  /**
   * Environment (development, production, etc.)
   */
  environment: string;

  /**
   * OAuth request API for handling OAuth flow
   */
  oauthRequestApi: OAuthRequestApi;

  /**
   * Config API for reading configuration
   */
  configApi: ConfigApi;
};

/**
 * Kubernetes OAuth2 Auth Provider
 *
 * Implements OAuth2/OIDC authentication flow with Kubernetes OIDC providers.
 * Uses the standard Backstage OAuth2 implementation with PKCE support.
 *
 * @public
 */
export class KubernetesOAuth2Provider implements OAuthApi, ProfileInfoApi, BackstageIdentityApi, SessionApi {
  private readonly oauth2: OAuth2;

  /**
   * Create a new Kubernetes OAuth2 provider
   *
   * @param options - Configuration options
   * @returns Promise resolving to KubernetesOAuth2Provider instance
   */
  static async create(options: CreateOptions): Promise<KubernetesOAuth2Provider> {
    const {
      environment,
      oauthRequestApi,
      discoveryApi,
      configApi,
    } = options;

    console.log('[KubernetesAuth] Creating OAuth2 provider for environment:', environment);

    // Create OAuth2 instance using standard Backstage OAuth2 implementation
    const oauth2 = OAuth2.create({
      discoveryApi,
      environment,
      provider: DEFAULT_PROVIDER,
      oauthRequestApi,
      defaultScopes: ['openid', 'profile', 'email', 'groups'],
      configApi,
    });

    return new KubernetesOAuth2Provider(oauth2);
  }

  private constructor(oauth2: OAuth2) {
    this.oauth2 = oauth2;
  }

  // Delegate all methods to the OAuth2 instance
  async getAccessToken(scope?: string | string[], options?: { optional?: boolean }) {
    return this.oauth2.getAccessToken(scope, options);
  }

  async getIdToken(options?: { optional?: boolean }) {
    return this.oauth2.getIdToken(options);
  }

  async getBackstageIdentity() {
    return this.oauth2.getBackstageIdentity();
  }

  async getProfile(options?: { optional?: boolean }) {
    return this.oauth2.getProfile(options);
  }

  async signIn() {
    return this.oauth2.signIn();
  }

  async signOut() {
    return this.oauth2.signOut();
  }

  sessionState$() {
    return this.oauth2.sessionState$();
  }
}
