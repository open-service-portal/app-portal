import { createFrontendModule } from '@backstage/frontend-plugin-api';
import { oidcAuthApi } from './oidcAuth';

/**
 * Auth Module
 *
 * Provides custom authentication providers.
 * Currently includes:
 * - OIDC authentication with sign-in/sign-out support
 */
export const customAuthModule = createFrontendModule({
  pluginId: 'app',
  extensions: [
    oidcAuthApi,
  ],
});
