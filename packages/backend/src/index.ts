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
backend.add(import('@backstage/plugin-auth-backend-module-microsoft-provider'));
// See https://backstage.io/docs/auth/guest/provider

// EntraID user search for scaffolder field
backend.add(import('./modules/entra-id-user-search'));

// catalog plugin
backend.add(import('@backstage/plugin-catalog-backend'));
backend.add(
  import('@backstage/plugin-catalog-backend-module-scaffolder-entity-model'),
);
backend.add(import('@backstage/plugin-catalog-backend-module-github'));
backend.add(import('@backstage/plugin-catalog-backend-module-msgraph'));

// Custom catalog module for automatic source tagging
backend.add(import('../../../plugins/catalog-backend-module-source-tagger/src/index.ts'));

// Custom catalog module to fix location annotations with url: prefix
backend.add(import('../../../plugins/catalog-backend-module-location-fixer/src/index.ts'));

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

// Ingestor plugin - discovers and imports Kubernetes resources into catalog
// Configure in app-config/ingestor.yaml
//
// Switch between npm package and local plugin development:
// 1. For npm package (default): Use line below
backend.add(import('@open-service-portal/backstage-plugin-ingestor'));
// 2. For local development: Comment line above, uncomment line below
// backend.add(import('@internal/plugin-ingestor'));

// TeraSky scaffolder utilities
backend.add(import('@terasky/backstage-plugin-scaffolder-backend-module-terasky-utils'));

// Kubernetes scaffolder actions (provides kube:apply and other kube:* actions)
backend.add(import('@devangelista/backstage-scaffolder-kubernetes'));

// notifications and signals plugins
backend.add(import('@backstage/plugin-notifications-backend'));
backend.add(import('@backstage/plugin-signals-backend'));

backend.start();
