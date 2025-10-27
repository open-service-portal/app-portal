import React from 'react';
import { ProviderSettingsItem } from '@backstage/plugin-user-settings';
import { oidcAuthApiRef } from '../apis/oidcAuthApiRef';
import { githubAuthApiRef, useApi, configApiRef } from '@backstage/core-plugin-api';
import LockIcon from '@material-ui/icons/Lock';
import Star from '@material-ui/icons/Star';

/**
 * Custom Authentication Provider Settings
 *
 * Extends the default provider list to include custom providers like OIDC.
 * The default Backstage settings page only includes a hardcoded list of providers,
 * so custom providers need to be explicitly added here.
 *
 * This component is used in the user-settings extension to override the default
 * provider settings in the Settings > Authentication Providers page.
 */
export const CustomAuthProviders = () => {
  const configApi = useApi(configApiRef);
  const providersConfig = configApi.getOptionalConfig('auth.providers');
  const configuredProviders = providersConfig?.keys() || [];

  return (
    <>
      {configuredProviders.includes('github') && (
        <ProviderSettingsItem
          title="GitHub"
          description="Provides authentication towards GitHub APIs and identities"
          apiRef={githubAuthApiRef}
          icon={Star}
        />
      )}
      {configuredProviders.includes('oidc') && (
        <ProviderSettingsItem
          title="K8s Cluster"
          description="Provides authentication for Kubernetes cluster access"
          apiRef={oidcAuthApiRef}
          icon={LockIcon}
        />
      )}
    </>
  );
};
