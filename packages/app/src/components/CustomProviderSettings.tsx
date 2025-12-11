import React, { Fragment } from 'react';
import {
  githubAuthApiRef,
  microsoftAuthApiRef,
  googleAuthApiRef,
  gitlabAuthApiRef,
  oktaAuthApiRef,
  oneloginAuthApiRef,
  atlassianAuthApiRef,
  bitbucketAuthApiRef,
  bitbucketServerAuthApiRef,
  useApi,
  configApiRef,
} from '@backstage/core-plugin-api';
import { ProviderSettingsItem } from '@backstage/plugin-user-settings';
import { kubernetesAuthApiRef } from '../../../../plugins/kubernetes-auth/src';
import GithubIcon from '@material-ui/icons/GitHub';
import AcUnitIcon from '@material-ui/icons/AcUnit';
import AccountTreeIcon from '@material-ui/icons/AccountTree';

/**
 * Custom Provider Settings component that extends the default Backstage providers
 * with our custom Kubernetes OIDC authentication provider.
 *
 * This component is used to override the default provider settings in the
 * user-settings plugin to make Kubernetes authentication visible in
 * Settings > Authentication Providers.
 */
export const CustomProviderSettings = () => {
  const configApi = useApi(configApiRef);
  const providersConfig = configApi.getOptionalConfig('auth.providers');
  const configuredProviders = providersConfig?.keys() || [];

  return (
    <Fragment>
      {/* Default Backstage providers */}
      {configuredProviders.includes('google') && (
        <ProviderSettingsItem
          title="Google"
          description="Provides authentication towards Google APIs and identities"
          icon={AcUnitIcon}
          apiRef={googleAuthApiRef}
        />
      )}
      {configuredProviders.includes('microsoft') && (
        <ProviderSettingsItem
          title="Microsoft"
          description="Provides authentication towards Microsoft APIs and identities"
          icon={AcUnitIcon}
          apiRef={microsoftAuthApiRef}
        />
      )}
      {configuredProviders.includes('github') && (
        <ProviderSettingsItem
          title="GitHub"
          description="Provides authentication towards GitHub APIs and repositories"
          icon={GithubIcon}
          apiRef={githubAuthApiRef}
        />
      )}
      {configuredProviders.includes('gitlab') && (
        <ProviderSettingsItem
          title="GitLab"
          description="Provides authentication towards GitLab APIs and identities"
          icon={AcUnitIcon}
          apiRef={gitlabAuthApiRef}
        />
      )}
      {configuredProviders.includes('okta') && (
        <ProviderSettingsItem
          title="Okta"
          description="Provides authentication towards Okta APIs and identities"
          icon={AcUnitIcon}
          apiRef={oktaAuthApiRef}
        />
      )}
      {configuredProviders.includes('onelogin') && (
        <ProviderSettingsItem
          title="OneLogin"
          description="Provides authentication towards OneLogin APIs and identities"
          icon={AcUnitIcon}
          apiRef={oneloginAuthApiRef}
        />
      )}
      {configuredProviders.includes('atlassian') && (
        <ProviderSettingsItem
          title="Atlassian"
          description="Provides authentication towards Atlassian APIs and identities"
          icon={AcUnitIcon}
          apiRef={atlassianAuthApiRef}
        />
      )}
      {configuredProviders.includes('bitbucket') && (
        <ProviderSettingsItem
          title="Bitbucket"
          description="Provides authentication towards Bitbucket APIs and identities"
          icon={AcUnitIcon}
          apiRef={bitbucketAuthApiRef}
        />
      )}
      {configuredProviders.includes('bitbucketServer') && (
        <ProviderSettingsItem
          title="Bitbucket Server"
          description="Provides authentication towards Bitbucket Server APIs and identities"
          icon={AcUnitIcon}
          apiRef={bitbucketServerAuthApiRef}
        />
      )}

      {/* Custom Kubernetes OIDC provider */}
      {configuredProviders.includes('kubernetes') && (
        <ProviderSettingsItem
          title="Kubernetes"
          description="Provides authentication for Kubernetes cluster access via OIDC"
          icon={AccountTreeIcon}
          apiRef={kubernetesAuthApiRef}
        />
      )}
    </Fragment>
  );
};
