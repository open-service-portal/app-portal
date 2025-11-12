import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import { Config } from '@backstage/config';

/**
 * Validates user identifiers against Microsoft Entra ID (Azure AD) and returns their exact email addresses
 *
 * This action:
 * 1. Accepts email addresses or usernames (case-insensitive search)
 * 2. Queries Microsoft Graph API to validate users exist
 * 3. Returns the exact email addresses as stored in Entra ID (preserving case)
 *
 * Configuration (app-config/scaffolder.yaml):
 * - scaffolder.entraId.tenantId: ${AUTH_MICROSOFT_TENANT_ID}
 * - scaffolder.entraId.clientId: ${AUTH_MICROSOFT_CLIENT_ID}
 * - scaffolder.entraId.clientSecret: ${AUTH_MICROSOFT_CLIENT_SECRET}
 * - scaffolder.entraId.defaultDomain: cloudpunks.de (optional)
 *
 * Required Graph API permissions:
 * - User.Read.All (Application permission)
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

/**
 * Get access token for Microsoft Graph API using client credentials flow
 */
async function getGraphAccessToken(
  tenantId: string,
  clientId: string,
  clientSecret: string,
): Promise<string> {
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
    const error = await response.text();
    throw new Error(`Failed to get access token: ${response.status} ${error}`);
  }

  const data = await response.json() as GraphApiTokenResponse;
  return data.access_token;
}

/**
 * Search for a user in Entra ID by email or username (case-insensitive)
 * Returns the user's exact email address as stored in Entra ID
 */
async function findUserInEntraId(
  userInput: string,
  accessToken: string,
  domain?: string,
): Promise<string> {
  // Normalize the input for search (lowercase)
  const normalizedInput = userInput.toLowerCase().trim();

  // Extract username from email if provided
  const username = normalizedInput.includes('@')
    ? normalizedInput.split('@')[0]
    : normalizedInput;

  // Build filter - search by userPrincipalName or mail (case-insensitive)
  const filter = domain
    ? `startsWith(userPrincipalName,'${username}@${domain}') or startsWith(mail,'${username}@${domain}')`
    : `startsWith(userPrincipalName,'${username}@') or startsWith(mail,'${username}@')`;

  const url = `https://graph.microsoft.com/v1.0/users?$filter=${encodeURIComponent(filter)}&$select=id,userPrincipalName,mail,displayName`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to query Microsoft Graph: ${response.status} ${error}`);
  }

  const data = await response.json();
  const users = data.value as EntraIdUser[];

  if (users.length === 0) {
    throw new Error(`User not found in Entra ID: ${userInput}`);
  }

  // If domain is specified, find exact match
  if (domain) {
    const expectedEmail = `${username}@${domain}`.toLowerCase();
    const user = users.find(u => {
      const userEmail = u.mail || u.userPrincipalName;
      return userEmail.toLowerCase() === expectedEmail;
    });

    if (!user) {
      throw new Error(`User not found in domain ${domain}: ${userInput}`);
    }

    return user.mail || user.userPrincipalName;
  }

  // No domain specified - return first match or ask for clarification
  if (users.length === 1) {
    return users[0].mail || users[0].userPrincipalName;
  }

  throw new Error(
    `Multiple users found for "${userInput}". Please provide the full email address. Found: ${users.map(u => u.mail || u.userPrincipalName).join(', ')}`
  );
}

/**
 * Create the Entra ID user validation scaffolder action
 */
export function createValidateEntraIdUsersAction(config: Config) {
  return createTemplateAction({
    id: 'openportal:entra:validate-users',
    description: 'Validates user identifiers against Microsoft Entra ID and returns their exact email addresses. Uses credentials from scaffolder.entraId configuration.',
    schema: {
      input: (z: any) => z.object({
        users: z.array(z.string()).min(1, 'At least one user is required'),
        domain: z.string().optional().describe('Optional email domain to restrict search (e.g., cloudpunks.de). If not provided, uses scaffolder.entraId.defaultDomain from config.'),
      }),
      output: (z: any) => z.object({
        validatedUsers: z.array(z.string()).describe('Validated user email addresses with exact casing from Entra ID'),
      }),
    },
    async handler(ctx) {
      const {
        users,
        domain: inputDomain,
      } = ctx.input;

      // Get Microsoft Graph credentials from config
      const tenantId = config.getOptionalString('scaffolder.entraId.tenantId');
      const clientId = config.getOptionalString('scaffolder.entraId.clientId');
      const clientSecret = config.getOptionalString('scaffolder.entraId.clientSecret');

      // Get domain from input or config
      const domain = inputDomain ||
        config.getOptionalString('scaffolder.entraId.defaultDomain') ||
        'cloudpunks.de'; // fallback default

      if (!tenantId || !clientId || !clientSecret) {
        throw new Error(
          'Microsoft Graph credentials not configured. Set scaffolder.entraId.tenantId, scaffolder.entraId.clientId, and scaffolder.entraId.clientSecret in app-config/scaffolder.yaml'
        );
      }

      ctx.logger.info(`Validating ${users.length} user(s) against Microsoft Entra ID...`);
      if (domain) {
        ctx.logger.info(`Restricting search to domain: ${domain}`);
      }

      try {
        // Get access token
        ctx.logger.info('Obtaining Microsoft Graph access token...');
        const accessToken = await getGraphAccessToken(tenantId, clientId, clientSecret);

        // Validate each user
        const validatedUsers: string[] = [];
        const errors: string[] = [];

        for (const user of users) {
          try {
            ctx.logger.info(`Validating user: ${user}`);
            const validatedEmail = await findUserInEntraId(user, accessToken, domain);
            validatedUsers.push(validatedEmail);
            ctx.logger.info(`✓ Validated: ${validatedEmail}`);
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            errors.push(`${user}: ${errorMessage}`);
            ctx.logger.error(`✗ Failed: ${user} - ${errorMessage}`);
          }
        }

        if (errors.length > 0) {
          throw new Error(`Failed to validate users:\n${errors.join('\n')}`);
        }

        // Set output
        ctx.output('validatedUsers', validatedUsers);
        ctx.logger.info(`✓ Successfully validated ${validatedUsers.length} user(s)`);

      } catch (error) {
        ctx.logger.error(`Failed to validate users: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
      }
    },
  });
}
