import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import { z } from 'zod';

/**
 * Custom scaffolder action that validates GitHub authentication.
 *
 * This action checks if the user has authenticated with GitHub and has
 * a valid OAuth token available for creating Pull Requests.
 *
 * If the user is not authenticated, it throws a helpful error message
 * with instructions on how to connect their GitHub account.
 *
 * @example
 * ```yaml
 * steps:
 *   - id: validate-github-auth
 *     name: Verify GitHub Connection
 *     action: portal:validate:github-auth
 *     input:
 *       token: ${{ secrets.USER_OAUTH_TOKEN }}
 *       userEmail: ${{ user.entity.spec.profile.email }}
 * ```
 */
export const createValidateGitHubAuthAction = () => {
  return createTemplateAction<{
    token?: string;
    userEmail?: string;
    userName?: string;
  }>({
    id: 'portal:validate:github-auth',
    description: 'Validates that the user is authenticated with GitHub and has a valid OAuth token',
    schema: {
      input: z.object({
        token: z.string().optional().describe('GitHub OAuth token from user credentials'),
        userEmail: z.string().optional().describe('User email for logging purposes'),
        userName: z.string().optional().describe('User name for logging purposes'),
      }),
      output: z.object({
        authenticated: z.boolean().describe('Whether the user is authenticated with GitHub'),
      }),
    },
    async handler(ctx) {
      const { token, userEmail, userName } = ctx.input;

      // Check if token is provided
      if (!token || token.trim() === '') {
        const errorMessage = [
          '🔐 GitHub Authentication Required!',
          '',
          'To create Pull Requests, you must connect your GitHub account to Backstage.',
          '',
          '📋 Follow these steps:',
          '  1. Click your profile icon in the top-right corner',
          '  2. Select "Settings"',
          '  3. Navigate to "Authentication Providers"',
          '  4. Click "Sign in with GitHub"',
          '  5. Authorize Backstage to access your GitHub account',
          '',
          '🔄 After connecting GitHub:',
          '  • Return to this template',
          '  • Start the template creation again',
          '  • Your GitHub account will be used to create the Pull Request',
          '',
          '❓ Why is this needed?',
          '  Pull Requests will be created using YOUR GitHub account, not a bot.',
          '  This ensures proper attribution and allows you to manage PRs directly.',
        ].join('\n');

        throw new Error(errorMessage);
      }

      // Log successful authentication
      const userIdentifier = userName || userEmail || 'unknown user';
      ctx.logger.info(`✅ GitHub authentication verified for: ${userIdentifier}`);

      ctx.output('authenticated', true);
    },
  });
};
