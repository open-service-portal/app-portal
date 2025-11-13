import { createApp } from '@backstage/frontend-defaults';
import catalogPlugin from '@backstage/plugin-catalog/alpha';
// Use official scaffolder plugin with custom extensions
import scaffolderPlugin from '@backstage/plugin-scaffolder/alpha';
import searchPlugin from '@backstage/plugin-search/alpha';
import techdocsPlugin from '@backstage/plugin-techdocs/alpha';
import userSettingsPlugin from '@backstage/plugin-user-settings/alpha';
import kubernetesPlugin from '@backstage/plugin-kubernetes/alpha';
import apiDocsPlugin from '@backstage/plugin-api-docs/alpha';
import { SignInPageBlueprint, createFrontendModule, PageBlueprint } from '@backstage/frontend-plugin-api';
import { microsoftAuthApiRef } from '@backstage/core-plugin-api';
import { SignInPage } from '@backstage/core-components';
import { Navigate } from 'react-router-dom';
import { navModule } from './modules/nav';
import { scaffolderExtensionsModule } from './modules/scaffolderExtensions';
import { CrossplanePage } from './components/crossplane/CrossplanePage';
import { 
  crossplaneOverviewCard,
  crossplaneResourcesContent,
  crossplaneGraphContent,
} from './extensions/crossplaneEntityExtensions';

// Custom SignInPage with Microsoft Auth only
const signInPage = SignInPageBlueprint.make({
  params: {
    loader: async () => props =>
      (
        <SignInPage
          {...props}
          providers={[
            'guest',
            {
              id: 'microsoft-auth-provider',
              title: 'Microsoft',
              message: 'Sign in using Microsoft Entra ID',
              apiRef: microsoftAuthApiRef,
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
    scaffolderPlugin,  // Official Backstage scaffolder plugin
    scaffolderExtensionsModule,  // Our custom field extensions
    authModule,
    searchPlugin,
    techdocsPlugin,
    userSettingsPlugin,
    kubernetesPlugin,
    apiDocsPlugin,
    navModule,
    crossplaneEntityModule,  // Add Crossplane entity extensions
  ],
});

export default app;
