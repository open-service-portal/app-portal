import { ApiBlueprint } from '@backstage/frontend-plugin-api';
import { discoveryApiRef, fetchApiRef } from '@backstage/core-plugin-api';
import { oidcAuthApiRef } from '../../apis/oidcAuthApiRef';

/**
 * Custom OIDC Authentication API Extension
 *
 * Uses oidc-authenticator daemon (localhost:8000) for authentication.
 * This is Approach B - where we don't control the IdP directly.
 *
 * Flow:
 * 1. User clicks sign-in on login page
 * 2. Opens popup to localhost:8000 (oidc-authenticator daemon)
 * 3. Daemon handles OAuth2/PKCE flow with Auth0
 * 4. Daemon sends tokens to Backstage backend via POST /api/cluster-auth/tokens
 * 5. Backend creates Backstage identity and returns session token
 * 6. Frontend stores session token for subsequent requests
 */

class OidcAuthenticatorApi {
  private sessionToken: string | null = null;

  constructor(
    private discoveryApi: typeof discoveryApiRef.T,
    private fetchApi: typeof fetchApiRef.T,
  ) {}

  async signIn() {
    // Check if daemon is running
    const daemonRunning = await this.checkDaemonHealth();
    if (!daemonRunning) {
      throw new Error(
        'oidc-authenticator daemon is not running. Please start it with: node bin/cli.js start'
      );
    }

    // Open authentication window
    const authWindow = window.open(
      'http://localhost:8000',
      'cluster-auth',
      'width=600,height=700,resizable=yes,scrollbars=yes'
    );

    if (!authWindow) {
      throw new Error('Failed to open authentication window. Please allow popups.');
    }

    // Wait for authentication to complete via postMessage
    return new Promise<void>((resolve, reject) => {
      // Listen for postMessage from daemon with session token
      const messageHandler = (event: MessageEvent) => {
        // Security: Only accept messages from localhost:8000
        if (event.origin !== 'http://localhost:8000') {
          return;
        }

        if (event.data?.type === 'backstage-auth-complete') {
          window.removeEventListener('message', messageHandler);

          if (event.data.success && event.data.backstageToken) {
            // Store the Backstage session token
            this.sessionToken = event.data.backstageToken;
            authWindow.close();
            resolve();
          } else {
            reject(new Error('Authentication failed: No session token received'));
          }
        }
      };

      window.addEventListener('message', messageHandler);

      // Fallback: Check if window was closed without message
      const checkClosed = setInterval(() => {
        if (authWindow.closed) {
          clearInterval(checkClosed);
          window.removeEventListener('message', messageHandler);
          if (!this.sessionToken) {
            reject(new Error('Authentication window was closed'));
          }
        }
      }, 1000);

      // Timeout after 5 minutes
      setTimeout(() => {
        clearInterval(checkClosed);
        window.removeEventListener('message', messageHandler);
        if (authWindow && !authWindow.closed) {
          authWindow.close();
        }
        reject(new Error('Authentication timeout'));
      }, 5 * 60 * 1000);
    });
  }

  async signOut() {
    try {
      const baseUrl = await this.discoveryApi.getBaseUrl('cluster-auth');
      await this.fetchApi.fetch(`${baseUrl}/tokens`, {
        method: 'DELETE',
        headers: this.sessionToken
          ? { Authorization: `Bearer ${this.sessionToken}` }
          : {},
      });
      this.sessionToken = null;
    } catch (err) {
      console.error('Failed to sign out:', err);
    }
  }

  async getProfile() {
    if (!this.sessionToken) {
      return {};
    }

    try {
      // Decode the Backstage session token to get user info
      const payload = JSON.parse(atob(this.sessionToken.split('.')[1]));
      const userEntityRef = payload.sub; // e.g., "user:default/felix"
      const username = userEntityRef.split('/')[1];

      // Also get profile from cluster token if available
      const baseUrl = await this.discoveryApi.getBaseUrl('cluster-auth');
      const response = await this.fetchApi.fetch(`${baseUrl}/token`, {
        headers: { Authorization: `Bearer ${this.sessionToken}` },
      });

      if (response.ok) {
        const data = await response.json();
        const idToken = data.id_token;
        if (idToken) {
          const clusterPayload = JSON.parse(atob(idToken.split('.')[1]));
          return {
            email: clusterPayload.email,
            displayName: clusterPayload.name || clusterPayload.email || username,
            picture: clusterPayload.picture,
          };
        }
      }

      // Fallback to basic info from session token
      return {
        email: `${username}@unknown`,
        displayName: username,
      };
    } catch (err) {
      console.error('Failed to get profile:', err);
      return {};
    }
  }

  async getBackstageIdentity() {
    if (!this.sessionToken) {
      throw new Error('Not authenticated');
    }

    try {
      // Decode Backstage session token
      const payload = JSON.parse(atob(this.sessionToken.split('.')[1]));
      return {
        type: 'user' as const,
        userEntityRef: payload.sub, // Already in format "user:default/username"
        ownershipEntityRefs: payload.ent || [payload.sub],
      };
    } catch (err) {
      throw new Error('Not authenticated');
    }
  }

  async getAccessToken() {
    if (!this.sessionToken) {
      throw new Error('No session token available');
    }

    try {
      const baseUrl = await this.discoveryApi.getBaseUrl('cluster-auth');
      const response = await this.fetchApi.fetch(`${baseUrl}/token`, {
        headers: { Authorization: `Bearer ${this.sessionToken}` },
      });

      if (response.ok) {
        const data = await response.json();
        return data.access_token;
      }
    } catch (err) {
      console.error('Failed to get access token:', err);
    }
    throw new Error('No access token available');
  }

  async getIdToken() {
    if (!this.sessionToken) {
      throw new Error('No session token available');
    }

    try {
      const baseUrl = await this.discoveryApi.getBaseUrl('cluster-auth');
      const response = await this.fetchApi.fetch(`${baseUrl}/token`, {
        headers: { Authorization: `Bearer ${this.sessionToken}` },
      });

      if (response.ok) {
        const data = await response.json();
        return data.id_token;
      }
    } catch (err) {
      console.error('Failed to get ID token:', err);
    }
    throw new Error('No ID token available');
  }

  async getCredentials() {
    // Return the Backstage session token as credentials
    if (!this.sessionToken) {
      throw new Error('No credentials available');
    }
    return { token: this.sessionToken };
  }

  sessionState$() {
    // Return observable that emits session state
    return {
      subscribe: (observer: any) => {
        // Immediately emit current state
        observer.next(this.sessionToken ? 'SignedIn' : 'SignedOut');

        // Check session validity periodically
        const interval = setInterval(() => {
          if (this.sessionToken) {
            // Check if token is expired
            try {
              const payload = JSON.parse(atob(this.sessionToken.split('.')[1]));
              const now = Math.floor(Date.now() / 1000);
              if (payload.exp && payload.exp < now) {
                this.sessionToken = null;
                observer.next('SignedOut');
              } else {
                observer.next('SignedIn');
              }
            } catch {
              observer.next('SignedOut');
            }
          } else {
            observer.next('SignedOut');
          }
        }, 5000);

        return {
          unsubscribe: () => clearInterval(interval),
        };
      },
    };
  }

  private async checkDaemonHealth(): Promise<boolean> {
    try {
      const response = await fetch('http://localhost:8000/health');
      if (!response.ok) return false;
      const data = await response.json();
      return data.status === 'running';
    } catch {
      return false;
    }
  }
}

export const oidcAuthApi = ApiBlueprint.make({
  name: 'oidc',
  params: defineParams =>
    defineParams({
      api: oidcAuthApiRef,
      deps: {
        discoveryApi: discoveryApiRef,
        fetchApi: fetchApiRef,
      },
      factory: ({ discoveryApi, fetchApi }) =>
        new OidcAuthenticatorApi(discoveryApi, fetchApi) as any,
    }),
});
