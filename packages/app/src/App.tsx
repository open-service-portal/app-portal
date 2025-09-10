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
import { CrossplanePage } from './components/crossplane/CrossplanePage';
import { 
  crossplaneOverviewCard,
  crossplaneResourcesContent,
  crossplaneGraphContent,
} from './extensions/crossplaneEntityExtensions';
import { TestNewUI } from './components/TestNewUI';
import { TestMixedUI } from './components/TestMixedUI';

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

// Test New UI Page
const testNewUIPage = PageBlueprint.make({
  name: 'test-new-ui',
  params: {
    path: '/test-new-ui',
    loader: async () => <TestNewUI />,
  },
});

// Test Mixed UI Page
const testMixedUIPage = PageBlueprint.make({
  name: 'test-mixed-ui',
  params: {
    path: '/test-mixed-ui',
    loader: async () => <TestMixedUI />,
  },
});

const authModule = createFrontendModule({
  pluginId: 'app',
  extensions: [signInPage, homePage, crossplanePage, testNewUIPage, testMixedUIPage],
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
