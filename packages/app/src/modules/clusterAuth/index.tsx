/**
 * Cluster Authentication Module
 *
 * Provides a dedicated page and navigation item for cluster authentication.
 * Uses Backstage's new frontend system with PageBlueprint and NavItemBlueprint.
 */

import {
  createFrontendModule,
  PageBlueprint,
  NavItemBlueprint,
} from '@backstage/frontend-plugin-api';
import CloudIcon from '@material-ui/icons/Cloud';
import { ClusterAuthPage } from '../../components/ClusterAuthPage';
import { convertLegacyRouteRef } from '@backstage/core-compat-api';
import { createRouteRef } from '@backstage/core-plugin-api';

// Create a route ref for the cluster auth page
export const clusterAuthRouteRef = createRouteRef({
  id: 'cluster-auth',
});

/**
 * Page extension for cluster authentication
 */
const clusterAuthPage = PageBlueprint.make({
  name: 'cluster-auth',
  params: {
    path: '/cluster-auth',
    loader: async () => <ClusterAuthPage />,
  },
});

/**
 * Navigation item for cluster authentication
 */
const clusterAuthNavItem = NavItemBlueprint.make({
  name: 'cluster-auth',
  params: {
    title: 'Cluster Auth',
    routeRef: convertLegacyRouteRef(clusterAuthRouteRef),
    icon: CloudIcon,
  },
});

/**
 * Frontend module that provides cluster authentication page and navigation
 */
export const clusterAuthModule = createFrontendModule({
  pluginId: 'app',
  extensions: [clusterAuthPage, clusterAuthNavItem],
});
