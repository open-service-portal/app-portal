import {
  createBackendModule,
  coreServices,
} from '@backstage/backend-plugin-api';
import express from 'express';

/**
 * Backend proxy for Entra ID user search
 * Provides a secure endpoint for frontend autocomplete without exposing credentials
 * Reuses the same Microsoft Graph credentials as the catalog provider
 */

interface EntraIdUser {
  id: string;
  userPrincipalName: string;
  mail: string | null;
  displayName: string;
}

interface GraphApiTokenResponse {
  token_type: string;
  expires_in: number;
  access_token: string;
}

let cachedAccessToken: string | null = null;
let tokenExpiry: number | null = null;

async function getGraphAccessToken(
  tenantId: string,
  clientId: string,
  clientSecret: string,
): Promise<string> {
  // Return cached token if still valid
  if (cachedAccessToken && tokenExpiry && Date.now() < tokenExpiry) {
    return cachedAccessToken;
  }

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    throw new Error(`Failed to get access token: ${response.status}`);
  }

  const data = (await response.json()) as GraphApiTokenResponse;

  // Cache token (expires in seconds, convert to milliseconds and subtract 5 minutes for safety)
  cachedAccessToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 300) * 1000;

  return data.access_token;
}

async function searchEntraIdUsers(
  searchTerm: string,
  accessToken: string,
  domain?: string,
): Promise<EntraIdUser[]> {
  if (!searchTerm || searchTerm.length < 2) {
    return [];
  }

  const normalizedSearch = searchTerm.toLowerCase().trim();

  // Build filter for Microsoft Graph
  let filter: string;
  if (domain) {
    // Search within specific domain
    filter = `startsWith(userPrincipalName,'${normalizedSearch}@${domain}') or startsWith(mail,'${normalizedSearch}@${domain}') or startsWith(displayName,'${normalizedSearch}')`;
  } else {
    // Search across all users
    filter = `startsWith(userPrincipalName,'${normalizedSearch}') or startsWith(mail,'${normalizedSearch}') or startsWith(displayName,'${normalizedSearch}')`;
  }

  const url = `https://graph.microsoft.com/v1.0/users?$filter=${encodeURIComponent(
    filter,
  )}&$select=id,userPrincipalName,mail,displayName&$top=20`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to search users: ${response.status}`);
  }

  const data = await response.json();
  return data.value as EntraIdUser[];
}

const entraIdProxyModule = createBackendModule({
  pluginId: 'proxy',
  moduleId: 'entra-id',
  register(reg) {
    reg.registerInit({
      deps: {
        http: coreServices.httpRouter,
        config: coreServices.rootConfig,
        logger: coreServices.logger,
      },
      async init({ http, config, logger }) {
        const router = express.Router();

        // Get Microsoft Graph credentials from catalog provider config
        const tenantId = config.getOptionalString(
          'catalog.providers.microsoftGraphOrg.default.tenantId',
        );
        const clientId = config.getOptionalString(
          'catalog.providers.microsoftGraphOrg.default.clientId',
        );
        const clientSecret = config.getOptionalString(
          'catalog.providers.microsoftGraphOrg.default.clientSecret',
        );

        // Endpoint for searching users
        router.get('/search', async (req, res) => {
          // Check credentials at runtime (allows hot reload if config changes)
          if (!tenantId || !clientId || !clientSecret) {
            logger.error('Microsoft Graph credentials not configured');
            res.status(503).json({
              error: 'Service unavailable',
              message: 'Microsoft Graph credentials not configured. Configure catalog.providers.microsoftGraphOrg.default credentials.',
            });
            return;
          }

          try {
            const searchTerm = req.query.q as string;
            const domain = req.query.domain as string | undefined;

            if (!searchTerm) {
              res.json([]);
              return;
            }

            logger.debug(
              `Searching Entra ID for: ${searchTerm}${domain ? ` in domain ${domain}` : ''}`,
            );

            const accessToken = await getGraphAccessToken(
              tenantId,
              clientId,
              clientSecret,
            );
            const users = await searchEntraIdUsers(
              searchTerm,
              accessToken,
              domain,
            );

            logger.debug(`Found ${users.length} users`);

            res.json(users);
          } catch (error) {
            logger.error(
              `Failed to search Entra ID: ${error instanceof Error ? error.message : String(error)}`,
            );
            res.status(500).json({
              error: 'Failed to search users',
              message:
                error instanceof Error ? error.message : 'Unknown error',
            });
          }
        });

        // Always register the router (even if credentials are missing at startup)
        // The path will be /api/proxy/entra-id based on pluginId 'proxy' and moduleId 'entra-id'
        http.use(router);

        if (tenantId && clientId && clientSecret) {
          logger.info('Entra ID proxy endpoint registered at /api/proxy/entra-id/search with Microsoft Graph Org credentials');
        } else {
          logger.warn(
            'Entra ID proxy endpoint registered at /api/proxy/entra-id/search but Microsoft Graph credentials not configured. ' +
            'User search will not work until credentials are provided.',
          );
        }
      },
    });
  },
});

export default entraIdProxyModule;
