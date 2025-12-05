import { Config } from '@backstage/config';
import * as express from 'express';
import Router from 'express-promise-router';
import { LoggerService } from '@backstage/backend-plugin-api';

interface EntraIdUser {
  mail: string;
  userPrincipalName: string;
  displayName: string;
}

interface GraphApiResponse {
  value: EntraIdUser[];
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
}

export interface RouterOptions {
  logger: LoggerService;
  config: Config;
}

/**
 * EntraID User Search Router
 *
 * Provides API endpoint to search for users in Microsoft Entra ID (Azure AD)
 * using Microsoft Graph API.
 */
export async function createRouter(
  options: RouterOptions,
): Promise<express.Router> {
  const { logger, config } = options;

  const router = Router();
  router.use(express.json());

  // Get EntraID configuration
  const tenantId = config.getString('entraId.tenantId');
  const clientId = config.getString('entraId.clientId');
  const clientSecret = config.getString('entraId.clientSecret');

  // Token cache
  let cachedToken: string | null = null;
  let tokenExpiry: number = 0;

  /**
   * Get access token for Microsoft Graph API
   * Uses client credentials flow and caches the token
   */
  async function getAccessToken(): Promise<string> {
    const now = Date.now();

    // Return cached token if still valid (with 5 min buffer)
    if (cachedToken && tokenExpiry > now + 5 * 60 * 1000) {
      return cachedToken;
    }

    logger.info('Fetching new EntraID access token');

    const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    });

    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`Failed to get access token: ${errorText}`);
      throw new Error(`Failed to authenticate with EntraID: ${response.statusText}`);
    }

    const data: TokenResponse = await response.json();
    cachedToken = data.access_token;
    tokenExpiry = now + (data.expires_in * 1000);

    return cachedToken;
  }

  /**
   * Search for users in EntraID
   * Searches across mail, userPrincipalName, and displayName fields
   * Uses $search for better fuzzy matching instead of startswith
   */
  async function searchUsers(query: string): Promise<EntraIdUser[]> {
    if (!query || query.length < 2) {
      return [];
    }

    const token = await getAccessToken();

    // Use $search for fuzzy matching across multiple fields
    // This provides better user experience than startswith
    const searchQuery = `"displayName:${query}" OR "mail:${query}" OR "userPrincipalName:${query}"`;

    const graphUrl = new URL('https://graph.microsoft.com/v1.0/users');
    graphUrl.searchParams.set('$search', searchQuery);
    graphUrl.searchParams.set('$select', 'mail,userPrincipalName,displayName');
    graphUrl.searchParams.set('$top', '20');
    graphUrl.searchParams.set('$orderby', 'displayName');

    logger.debug(`Searching EntraID users with query: ${query}`);

    const response = await fetch(graphUrl.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ConsistencyLevel': 'eventual',  // Required for $search
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`Graph API error: ${errorText}`);
      throw new Error(`Failed to search users: ${response.statusText}`);
    }

    const data: GraphApiResponse = await response.json();

    // Filter out users without email addresses
    const users = data.value.filter(user => user.mail);

    logger.debug(`Found ${users.length} users for query: ${query}`);

    return users;
  }

  /**
   * GET /search?q=<query>
   *
   * Search for users by email, UPN, or display name
   * Returns array of users with email, UPN, and display name
   */
  router.get('/search', async (req, res) => {
    const query = req.query.q as string;

    if (!query) {
      res.status(400).json({ error: 'Query parameter "q" is required' });
      return;
    }

    try {
      const users = await searchUsers(query);
      res.json(users);
    } catch (error) {
      logger.error('Error searching users', error as Error);
      res.status(500).json({
        error: 'Failed to search users',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /health
   *
   * Health check endpoint
   */
  router.get('/health', (_, res) => {
    res.json({ status: 'ok' });
  });

  return router;
}
