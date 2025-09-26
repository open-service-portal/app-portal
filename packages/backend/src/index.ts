console.log('[Backend Init] Starting backend...');

import { createBackend } from '@backstage/backend-defaults';

const backend = createBackend();

backend.add(import('@backstage/plugin-app-backend'));
backend.add(import('@backstage/plugin-proxy-backend'));

// scaffolder plugin
backend.add(import('@backstage/plugin-scaffolder-backend'));
backend.add(import('@backstage/plugin-scaffolder-backend-module-github'));
backend.add(
  import('@backstage/plugin-scaffolder-backend-module-notifications'),
);

// custom scaffolder actions
backend.add(import('./scaffolder'));

// techdocs plugin
backend.add(import('@backstage/plugin-techdocs-backend'));

// auth plugin
backend.add(import('@backstage/plugin-auth-backend'));
// See https://backstage.io/docs/backend-system/building-backends/migrating#the-auth-plugin
backend.add(import('@backstage/plugin-auth-backend-module-guest-provider'));
backend.add(import('@backstage/plugin-auth-backend-module-github-provider'));
// See https://backstage.io/docs/auth/guest/provider

// catalog plugin
backend.add(import('@backstage/plugin-catalog-backend'));
backend.add(
  import('@backstage/plugin-catalog-backend-module-scaffolder-entity-model'),
);
backend.add(import('@backstage/plugin-catalog-backend-module-github'));
backend.add(import('@backstage/plugin-catalog-backend-module-github-org'));

// Custom catalog module for automatic source tagging
backend.add(import('../../../plugins/catalog-backend-module-source-tagger/src/index.ts'));

// See https://backstage.io/docs/features/software-catalog/configuration#subscribing-to-catalog-errors
backend.add(import('@backstage/plugin-catalog-backend-module-logs'));

// permission plugin
backend.add(import('@backstage/plugin-permission-backend'));
// Custom permission policy that allows guests to read catalog entities
backend.add(import('./permissions'));

// search plugin
backend.add(import('@backstage/plugin-search-backend'));

// search engine
// See https://backstage.io/docs/features/search/search-engines
backend.add(import('@backstage/plugin-search-backend-module-pg'));

// search collators
backend.add(import('@backstage/plugin-search-backend-module-catalog'));
backend.add(import('@backstage/plugin-search-backend-module-techdocs'));

// kubernetes plugin
backend.add(import('@backstage/plugin-kubernetes-backend'));

// Kubernetes and Crossplane ingestor plugins
// Configure in app-config/ingestor.yaml with ingestorSelector:
// - 'kubernetes-ingestor' - Legacy internal version (workspace plugin)
// - 'open-service-portal-ingestor' - Open Service Portal fork (NPM package)
// - 'crossplane-ingestor' - Refactored Crossplane-focused version
// - 'ingestor' - New standalone ingestor (renamed and refactored)
// Additional ingestors can be installed via NPM and added here

// Internal ingestors (included in this repo)
backend.add(import('@internal/plugin-kubernetes-ingestor')); // Legacy internal version
backend.add(import('@internal/plugin-crossplane-ingestor')); // Refactored Crossplane-focused version
backend.add(import('@internal/plugin-ingestor')); // New standalone ingestor

// External ingestors (from NPM)
backend.add(import('@open-service-portal/backstage-plugin-kubernetes-ingestor')); // Open Service Portal fork

// TeraSky scaffolder utilities
backend.add(import('@terasky/backstage-plugin-scaffolder-backend-module-terasky-utils'));

// notifications and signals plugins
backend.add(import('@backstage/plugin-notifications-backend'));
backend.add(import('@backstage/plugin-signals-backend'));

backend.start();
