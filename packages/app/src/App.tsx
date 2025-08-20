import { createApp } from '@backstage/frontend-defaults';
import catalogPlugin from '@backstage/plugin-catalog/alpha';
import scaffolderPlugin from '@backstage/plugin-scaffolder/alpha';
import searchPlugin from '@backstage/plugin-search/alpha';
import techdocsPlugin from '@backstage/plugin-techdocs/alpha';
import userSettingsPlugin from '@backstage/plugin-user-settings/alpha';
import kubernetesPlugin from '@backstage/plugin-kubernetes/alpha';
import apiDocsPlugin from '@backstage/plugin-api-docs/alpha';
import { SignInPageBlueprint, createFrontendModule, PageBlueprint } from '@backstage/frontend-plugin-api';
import { githubAuthApiRef } from '@backstage/core-plugin-api';
import { SignInPage } from '@backstage/core-components';
import { Navigate } from 'react-router-dom';
import { navModule } from './modules/nav';

// Custom SignInPage with GitHub Auth
const signInPage = SignInPageBlueprint.make({
  params: {
    loader: async () => props =>
      (
        <SignInPage
          {...props}
          providers={[
            'guest',
            {
              id: 'github-auth-provider',
              title: 'GitHub',
              message: 'Sign in using GitHub',
              apiRef: githubAuthApiRef,
            },
          ]}
        />
      ),
  },
});

// Homepage redirect to catalog
const homePage = PageBlueprint.make({
  name: 'homepage',
  params: {
    path: '/',
    loader: async () => () => <Navigate to="/catalog" replace />,
  },
});

const authModule = createFrontendModule({
  pluginId: 'app',
  extensions: [signInPage, homePage],
});

export default createApp({
  features: [
    catalogPlugin,
    scaffolderPlugin,
    searchPlugin,
    techdocsPlugin,
    userSettingsPlugin,
    kubernetesPlugin,
    apiDocsPlugin,
    authModule,
    navModule,
  ],
});
