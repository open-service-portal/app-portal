import React from 'react';
import { 
  EntityCardBlueprint,
  EntityContentBlueprint,
} from '@backstage/plugin-catalog-react/alpha';
import { Entity } from '@backstage/catalog-model';

// Lazy load the TeraSky components to improve performance
const CrossplaneResourcesTable = React.lazy(() => 
  import('@terasky/backstage-plugin-crossplane-resources-frontend').then(m => ({
    default: m.CrossplaneResourcesTableSelector
  }))
);

const CrossplaneResourceGraph = React.lazy(() => 
  import('@terasky/backstage-plugin-crossplane-resources-frontend').then(m => ({
    default: m.CrossplaneResourceGraphSelector
  }))
);

const CrossplaneOverviewCard = React.lazy(() => 
  import('@terasky/backstage-plugin-crossplane-resources-frontend').then(m => ({
    default: m.CrossplaneOverviewCardSelector
  }))
);

// Custom filter function to check if entity has Crossplane annotations
// Supports both Crossplane v1 (claims) and v2 (XRs) patterns
const hasCrossplaneAnnotations = (entity: Entity) => {
  const annotations = entity.metadata.annotations || {};
  
  // Check for various Crossplane annotation patterns
  return !!(
    // Standard Crossplane annotations
    annotations['crossplane.io/claim-name'] ||
    annotations['crossplane.io/claim-namespace'] ||
    annotations['crossplane.io/xr-name'] ||
    annotations['crossplane.io/xr-namespace'] ||
    
    // TeraSky specific annotations (from your CrossplanePage.tsx)
    annotations['crossplane.terasky.io/claim-name'] ||
    annotations['crossplane.terasky.io/claim-namespace'] ||
    annotations['crossplane.terasky.io/xr-name'] ||
    annotations['crossplane.terasky.io/xr-apiversion'] ||
    annotations['crossplane.terasky.io/xr-kind'] ||
    
    // Check if entity is marked as having Crossplane resources
    annotations['backstage.io/has-crossplane-resources'] === 'true'
  );
};

// Create entity card blueprint for overview
// TEMPORARILY DISABLED due to TeraSky plugin bug with undefined split
// The plugin expects specific annotation format that we need to debug
/*
export const crossplaneOverviewCard = EntityCardBlueprint.make({
  name: 'entity-card-crossplane-overview',
  params: {
    filter: hasCrossplaneAnnotations,
    loader: async () => {
      return (
        <React.Suspense fallback={<div>Loading Crossplane overview...</div>}>
          <CrossplaneOverviewCard />
        </React.Suspense>
      );
    },
  },
});
*/

// Create entity content blueprint for resources table
export const crossplaneResourcesContent = EntityContentBlueprint.make({
  name: 'entity-content-crossplane-resources',
  params: {
    defaultPath: '/crossplane',
    defaultTitle: 'Infrastructure',
    filter: hasCrossplaneAnnotations,
    loader: async () => {
      return (
        <React.Suspense fallback={<div>Loading Crossplane resources...</div>}>
          <CrossplaneResourcesTable />
        </React.Suspense>
      );
    },
  },
});

// Create entity content blueprint for dependency graph
export const crossplaneGraphContent = EntityContentBlueprint.make({
  name: 'entity-content-crossplane-graph',
  params: {
    defaultPath: '/crossplane-graph',
    defaultTitle: 'Dependencies',
    filter: hasCrossplaneAnnotations,
    loader: async () => {
      return (
        <React.Suspense fallback={<div>Loading dependency graph...</div>}>
          <CrossplaneResourceGraph />
        </React.Suspense>
      );
    },
  },
});