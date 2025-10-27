import { createFrontendModule, createExtension, coreExtensionData } from '@backstage/frontend-plugin-api';
import { CustomAuthProviders } from '../../components/CustomAuthProviders';

/**
 * Extension that provides custom authentication provider settings
 * to the user-settings page. This extension attaches to the
 * 'providerSettings' input of the user-settings page.
 *
 * This allows custom authentication providers (like OIDC) to appear
 * in the Settings > Authentication Providers page, which by default
 * only shows a hardcoded list of standard providers.
 */
const customProviderSettingsExtension = createExtension({
  namespace: 'app',
  name: 'custom-provider-settings',
  attachTo: {
    id: 'page:user-settings',
    input: 'providerSettings',
  },
  output: [coreExtensionData.reactElement],
  factory() {
    return [coreExtensionData.reactElement(<CustomAuthProviders />)];
  },
});

/**
 * Frontend module that customizes the user-settings plugin
 * with custom authentication providers (OIDC, etc.)
 *
 * This module must be added to the app's features array alongside
 * the base userSettingsPlugin to enable custom provider settings.
 */
export const userSettingsModule = createFrontendModule({
  pluginId: 'user-settings',
  extensions: [customProviderSettingsExtension],
});
