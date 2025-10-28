/**
 * Cluster Authentication Token Validator
 *
 * Validates JWT tokens received from oidc-authenticator daemon.
 * Since the daemon handles the OAuth/PKCE flow, the backend just needs to:
 * 1. Decode the JWT id_token
 * 2. Verify the signature (optional but recommended)
 * 3. Extract user identity
 *
 * This is MUCH simpler than handling the full OAuth flow!
 */

import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { Logger } from 'winston';

export interface TokenValidationResult {
  valid: boolean;
  userIdentity?: {
    sub: string;           // Subject (user ID from OIDC provider)
    email?: string;        // Email address
    name?: string;         // Display name
    picture?: string;      // Avatar URL
  };
  error?: string;
}

export interface ClusterAuthValidatorOptions {
  /**
   * OIDC issuer URL (e.g., "https://login.spot.rackspace.com/")
   * Used to fetch JWKS for signature verification
   */
  issuer: string;

  /**
   * Whether to verify JWT signatures
   * Set to false for development/testing (not recommended for production)
   */
  verifySignature?: boolean;

  logger: Logger;
}

/**
 * Validates OIDC tokens from the oidc-authenticator daemon
 */
export class ClusterAuthValidator {
  private jwksClient?: jwksClient.JwksClient;
  private logger: Logger;
  private issuer: string;
  private verifySignature: boolean;

  constructor(options: ClusterAuthValidatorOptions) {
    this.logger = options.logger;
    this.issuer = options.issuer;
    this.verifySignature = options.verifySignature ?? true;

    if (this.verifySignature) {
      // Initialize JWKS client for signature verification
      const jwksUri = `${options.issuer.replace(/\/$/, '')}/.well-known/jwks.json`;
      this.jwksClient = jwksClient({
        jwksUri,
        cache: true,
        cacheMaxAge: 600000, // 10 minutes
        rateLimit: true,
        jwksRequestsPerMinute: 10,
      });

      this.logger.info('ClusterAuthValidator initialized', {
        issuer: options.issuer,
        jwksUri,
        verifySignature: this.verifySignature,
      });
    } else {
      this.logger.warn('ClusterAuthValidator: Signature verification DISABLED');
    }
  }

  /**
   * Validate an id_token JWT
   */
  async validateIdToken(idToken: string): Promise<TokenValidationResult> {
    try {
      // Decode token without verification first
      const decoded = jwt.decode(idToken, { complete: true });

      if (!decoded || typeof decoded === 'string') {
        return {
          valid: false,
          error: 'Invalid JWT format',
        };
      }

      // Extract payload
      const payload = decoded.payload as any;

      // Basic validation
      if (!payload.sub) {
        return {
          valid: false,
          error: 'Missing sub claim',
        };
      }

      if (!payload.iss || payload.iss !== this.issuer) {
        return {
          valid: false,
          error: `Invalid issuer: expected ${this.issuer}, got ${payload.iss}`,
        };
      }

      // Check expiration
      if (payload.exp && Date.now() >= payload.exp * 1000) {
        return {
          valid: false,
          error: 'Token expired',
        };
      }

      // Verify signature if enabled
      if (this.verifySignature && this.jwksClient) {
        await this.verifyTokenSignature(idToken, decoded.header.kid);
      }

      // Extract user identity
      const userIdentity = {
        sub: payload.sub,
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
      };

      this.logger.info('Token validated successfully', {
        sub: userIdentity.sub,
        email: userIdentity.email,
      });

      return {
        valid: true,
        userIdentity,
      };
    } catch (error) {
      this.logger.error('Token validation failed', error);
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Verify JWT signature using JWKS
   */
  private async verifyTokenSignature(token: string, kid?: string): Promise<void> {
    if (!this.jwksClient) {
      throw new Error('JWKS client not initialized');
    }

    return new Promise((resolve, reject) => {
      // Get signing key
      this.jwksClient!.getSigningKey(kid, (err, key) => {
        if (err) {
          reject(new Error(`Failed to get signing key: ${err.message}`));
          return;
        }

        const signingKey = key?.getPublicKey();
        if (!signingKey) {
          reject(new Error('No public key found'));
          return;
        }

        // Verify signature
        jwt.verify(
          token,
          signingKey,
          {
            issuer: this.issuer,
            algorithms: ['RS256', 'RS384', 'RS512', 'ES256', 'ES384', 'ES512'],
          },
          err => {
            if (err) {
              reject(new Error(`Signature verification failed: ${err.message}`));
            } else {
              resolve();
            }
          }
        );
      });
    });
  }

  /**
   * Extract user email from id_token (without full validation)
   * Useful for quick identity lookups
   */
  static extractEmail(idToken: string): string | null {
    try {
      const decoded = jwt.decode(idToken) as any;
      return decoded?.email || null;
    } catch {
      return null;
    }
  }

  /**
   * Check if token is expired (without full validation)
   */
  static isExpired(idToken: string): boolean {
    try {
      const decoded = jwt.decode(idToken) as any;
      if (!decoded?.exp) return true;
      return Date.now() >= decoded.exp * 1000;
    } catch {
      return true;
    }
  }
}
