import { createApp } from '@backstage/frontend-defaults';
import catalogPlugin from '@backstage/plugin-catalog/alpha';
// Use our enhanced local scaffolder plugin
import scaffolderPlugin from '@internal/plugin-scaffolder/alpha';
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
import { customAuthModule } from './modules/auth';
import { userSettingsModule } from './modules/userSettings';
import { oidcAuthApiRef } from './apis/oidcAuthApiRef';
import { CrossplanePage } from './components/crossplane/CrossplanePage';
import {
  crossplaneOverviewCard,
  crossplaneResourcesContent,
  crossplaneGraphContent,
} from './extensions/crossplaneEntityExtensions';

// Custom SignInPage with GitHub and OIDC Auth
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
            {
              id: 'oidc-auth-provider',
              title: 'K8s Cluster',
              message: 'Sign in using Kubernetes cluster credentials',
              apiRef: oidcAuthApiRef,
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
    loader: async () => <Navigate to="/catalog" replace />,
  },
});

// Crossplane status page
const crossplanePage = PageBlueprint.make({
  name: 'crossplane-status',
  params: {
    path: '/crossplane-resources',
    loader: async () => <CrossplanePage />,
  },
});

const authModule = createFrontendModule({
  pluginId: 'app',
  extensions: [signInPage, homePage, crossplanePage],
});

// Crossplane entity extensions module
const crossplaneEntityModule = createFrontendModule({
  pluginId: 'catalog',
  extensions: [
    crossplaneOverviewCard,
    crossplaneResourcesContent,
    crossplaneGraphContent,
  ],
});


const app = createApp({
  features: [
    catalogPlugin,
    scaffolderPlugin,  // Use our enhanced local scaffolder plugin
    customAuthModule,  // OIDC auth provider
    authModule,  // Sign-in page and other auth configurations
    searchPlugin,
    techdocsPlugin,
    userSettingsPlugin,
    userSettingsModule,  // Custom provider settings (includes OIDC in settings page)
    kubernetesPlugin,
    apiDocsPlugin,
    navModule,
    crossplaneEntityModule,  // Add Crossplane entity extensions
  ],
});

export default app;
