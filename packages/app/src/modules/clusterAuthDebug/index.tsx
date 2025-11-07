/**
 * Cluster Auth Debug Module
 *
 * Provides a debug page and navigation item for cluster authentication debugging.
 * Shows user token status, cluster access testing, and API request logs.
 */

import {
  createFrontendModule,
  PageBlueprint,
  NavItemBlueprint,
} from '@backstage/frontend-plugin-api';
import BugReportIcon from '@material-ui/icons/BugReport';
import { convertLegacyRouteRef } from '@backstage/core-compat-api';
import { createRouteRef } from '@backstage/core-plugin-api';
import { ClusterAuthDebugPage } from '../../components/ClusterAuthDebugPage';

// Create a route ref for the cluster auth debug page
export const clusterAuthDebugRouteRef = createRouteRef({
  id: 'cluster-auth-debug',
});

/**
 * Page extension for cluster auth debug
 */
const clusterAuthDebugPage = PageBlueprint.make({
  name: 'cluster-auth-debug',
  params: {
    path: '/cluster-auth-debug',
    loader: async () => <ClusterAuthDebugPage />,
  },
});

/**
 * Navigation item for cluster auth debug
 */
const clusterAuthDebugNavItem = NavItemBlueprint.make({
  name: 'cluster-auth-debug',
  params: {
    title: 'Cluster Auth Debug',
    routeRef: convertLegacyRouteRef(clusterAuthDebugRouteRef),
    icon: BugReportIcon,
  },
});

/**
 * Frontend module that provides cluster auth debug page and navigation
 */
export const clusterAuthDebugModule = createFrontendModule({
  pluginId: 'app',
  extensions: [clusterAuthDebugPage, clusterAuthDebugNavItem],
});
