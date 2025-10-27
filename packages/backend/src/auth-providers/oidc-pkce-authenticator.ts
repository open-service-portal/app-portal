/*
 * Custom OIDC Authenticator with PKCE Support
 *
 * This authenticator extends Backstage's OIDC provider to support
 * Authorization Code Flow with PKCE (Proof Key for Code Exchange)
 * for public clients that don't have a client secret.
 *
 * Based on @backstage/plugin-auth-backend-module-oidc-provider
 * Modified to support PKCE and make clientSecret optional.
 */

import crypto from 'crypto';
import { Issuer, Strategy, custom, generators } from 'openid-client';
import {
  createOAuthAuthenticator,
  PassportOAuthAuthenticatorHelper,
  PassportHelpers,
} from '@backstage/plugin-auth-node';
import { durationToMilliseconds } from '@backstage/types';
import { readDurationFromConfig } from '@backstage/config';

const HTTP_OPTION_TIMEOUT = 10000;

const createHttpOptionsProvider = ({ timeout }: { timeout?: number }) => (
  _url: string,
  options: any,
) => {
  return {
    ...options,
    timeout: timeout ?? HTTP_OPTION_TIMEOUT,
  };
};

export const oidcPkceAuthenticator = createOAuthAuthenticator({
  defaultProfileTransform: async (input: any) => ({
    profile: {
      email: input.fullProfile.userinfo.email,
      picture: input.fullProfile.userinfo.picture,
      displayName: input.fullProfile.userinfo.name,
    },
  }),
  scopes: {
    persist: true,
    required: ['openid', 'profile', 'email'],
  },

  initialize({ callbackUrl, config }) {
    const clientId = config.getString('clientId');
    // Make clientSecret optional - if not provided, use PKCE
    const clientSecret = config.getOptionalString('clientSecret');
    const usePkce = !clientSecret; // Use PKCE if no client secret

    const metadataUrl = config.getString('metadataUrl');
    const customCallbackUrl = config.getOptionalString('callbackUrl');
    const tokenEndpointAuthMethod = config.getOptionalString(
      'tokenEndpointAuthMethod',
    );
    const tokenSignedResponseAlg = config.getOptionalString(
      'tokenSignedResponseAlg',
    );
    const initializedPrompt = config.getOptionalString('prompt');

    // Get additional parameters (like organization for Rackspace)
    const additionalAuthParams = config.getOptionalConfigArray('additionalAuthParams')?.reduce((acc, param) => {
      const key = param.getString('key');
      const value = param.getString('value');
      acc[key] = value;
      return acc;
    }, {} as Record<string, string>) || {};

    if (config.has('scope')) {
      throw new Error(
        'The oidc provider no longer supports the "scope" configuration option. Please use the "additionalScopes" option instead.',
      );
    }

    const timeoutMilliseconds = config.has('timeout')
      ? durationToMilliseconds(readDurationFromConfig(config, { key: 'timeout' }))
      : undefined;

    const httpOptionsProvider = createHttpOptionsProvider({
      timeout: timeoutMilliseconds,
    });

    Issuer[custom.http_options] = httpOptionsProvider;

    const promise = Issuer.discover(metadataUrl).then(issuer => {
      issuer[custom.http_options] = httpOptionsProvider;
      (issuer.Client as any)[custom.http_options] = httpOptionsProvider;

      // Configure client based on whether we're using PKCE or client secret
      const clientConfig: any = {
        client_id: clientId,
        redirect_uris: [customCallbackUrl || callbackUrl],
        response_types: ['code'],
        id_token_signed_response_alg: tokenSignedResponseAlg || 'RS256',
      };

      if (usePkce) {
        // PKCE configuration for public clients
        console.log('[OIDC-PKCE] Configuring public client with PKCE');
        clientConfig.token_endpoint_auth_method = 'none'; // Public client
      } else {
        // Traditional OAuth with client secret
        console.log('[OIDC-PKCE] Configuring confidential client with secret');
        clientConfig.client_secret = clientSecret;
        clientConfig.token_endpoint_auth_method = tokenEndpointAuthMethod || 'client_secret_basic';
        clientConfig.access_type = 'offline'; // Request refresh token
      }

      const client = new issuer.Client(clientConfig);
      (client as any)[custom.http_options] = httpOptionsProvider;

      // Note: We DON'T use usePKCE option here because it requires Express sessions
      // Instead, we'll handle PKCE manually in the start() method below
      const strategy = new Strategy(
        {
          client,
          passReqToCallback: false,
          usePKCE: false, // Disable built-in PKCE (we handle it manually)
        },
        (tokenset: any, userinfo: any, done: any) => {
          if (typeof done !== 'function') {
            throw new Error(
              'OIDC IdP must provide a userinfo_endpoint in the metadata response',
            );
          }
          done(
            undefined,
            { tokenset, userinfo },
            { refreshToken: tokenset.refresh_token },
          );
        },
      );

      const helper = PassportOAuthAuthenticatorHelper.from(strategy);
      return { helper, client, strategy, usePkce, additionalAuthParams };
    });

    return { initializedPrompt, promise };
  },

  async start(input: any, ctx: any) {
    const { initializedPrompt, promise } = ctx;
    const { helper, client, usePkce, additionalAuthParams } = await promise;

    // For PKCE, we build the authorization URL manually to avoid session requirements
    if (usePkce) {
      const codeVerifier = generators.codeVerifier();
      const codeChallenge = generators.codeChallenge(codeVerifier);
      const nonce = crypto.randomBytes(16).toString('base64');

      // Parse existing state to add code verifier
      let stateData: any = {};
      if (input.state) {
        if (typeof input.state === 'string') {
          try {
            stateData = JSON.parse(input.state);
          } catch {
            stateData = {};
          }
        } else if (typeof input.state === 'object') {
          stateData = input.state;
        }
      }

      // Add code verifier to state
      stateData.codeVerifier = codeVerifier;
      const stateString = JSON.stringify(stateData);

      // Build authorization URL manually
      const authorizationUrl = client.authorizationUrl({
        scope: input.scope,
        state: stateString,
        nonce,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        ...additionalAuthParams,
      });

      console.log('[OIDC-PKCE] Generated authorization URL with PKCE:', {
        method: 'S256',
        challenge: codeChallenge.substring(0, 10) + '...',
      });

      return { url: authorizationUrl };
    }

    // For non-PKCE (with client secret), use the standard helper
    const options: any = {
      scope: input.scope,
      state: input.state,
      nonce: crypto.randomBytes(16).toString('base64'),
      ...additionalAuthParams,
    };

    const prompt = initializedPrompt || 'none';
    if (prompt !== 'auto') {
      options.prompt = prompt;
    }

    return helper.start(input, options);
  },

  async authenticate(input: any, ctx: any) {
    const { strategy, client, usePkce } = await ctx.promise;

    // Extract code verifier from state if using PKCE
    let codeVerifier: string | undefined;
    if (usePkce && input.req.query.state) {
      try {
        const state = JSON.parse(decodeURIComponent(input.req.query.state as string));
        codeVerifier = state.codeVerifier;
        console.log('[OIDC-PKCE] Retrieved PKCE code verifier from state');
      } catch (error) {
        console.warn('[OIDC-PKCE] Failed to parse state for code verifier:', error);
      }
    }

    // If we have a code verifier, we need to exchange the authorization code manually
    if (usePkce && codeVerifier && input.req.query.code) {
      console.log('[OIDC-PKCE] Performing manual token exchange with PKCE');

      const tokenset = await client.callback(
        client.redirect_uris[0],
        { code: input.req.query.code as string },
        { code_verifier: codeVerifier },
      );

      const userinfo = await client.userinfo(tokenset.access_token!);

      const result = { tokenset, userinfo };
      const privateInfo = { refreshToken: tokenset.refresh_token };

      return {
        fullProfile: result,
        session: {
          accessToken: tokenset.access_token,
          tokenType: tokenset.token_type ?? 'bearer',
          scope: tokenset.scope,
          expiresInSeconds: tokenset.expires_in,
          idToken: tokenset.id_token,
        },
        privateInfo,
      };
    }

    // Fallback to standard flow (for non-PKCE)
    const { result, privateInfo } = await PassportHelpers.executeFrameHandlerStrategy(
      input.req,
      strategy,
    );

    return {
      fullProfile: result,
      session: {
        accessToken: result.tokenset.access_token,
        tokenType: result.tokenset.token_type ?? 'bearer',
        scope: result.tokenset.scope,
        expiresInSeconds: result.tokenset.expires_in,
        idToken: result.tokenset.id_token,
        refreshToken: privateInfo.refreshToken,
      },
    };
  },

  async refresh(input: any, ctx: any) {
    const { client } = await ctx.promise;
    const tokenset = await client.refresh(input.refreshToken);

    if (!tokenset.access_token) {
      throw new Error('Refresh failed');
    }

    const userinfo = await client.userinfo(tokenset.access_token);

    return {
      fullProfile: { userinfo, tokenset },
      session: {
        accessToken: tokenset.access_token,
        tokenType: tokenset.token_type ?? 'bearer',
        scope: tokenset.scope,
        expiresInSeconds: tokenset.expires_in,
        idToken: tokenset.id_token,
        refreshToken: tokenset.refresh_token,
      },
    };
  },

  async logout(input: any, ctx: any) {
    const { client } = await ctx.promise;
    const issuer = client.issuer;

    if (issuer.metadata.end_session_endpoint) {
      const endSessionUrl = client.endSessionUrl({
        id_token_hint: input.idToken,
      });
      return { url: endSessionUrl };
    }

    return { url: '' };
  },
});
