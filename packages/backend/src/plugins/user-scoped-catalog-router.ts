/**
 * User-Scoped Catalog Router
 *
 * Provides a custom catalog endpoint that returns entities based on
 * the current user's Kubernetes RBAC permissions.
 *
 * Endpoints:
 *   GET /api/user-catalog/entities - List entities user can access
 *   GET /api/user-catalog/entities/by-name/:kind/:namespace/:name - Get specific entity
 *
 * This is an ALTERNATIVE to the standard /api/catalog endpoints.
 * Frontend can choose which to use based on requirements.
 */

import { Router } from 'express';
import express from 'express';
import { Logger } from 'winston';
import { HttpAuthService } from '@backstage/backend-plugin-api';
import { UserScopedKubernetesFetcher } from './user-scoped-kubernetes-catalog-provider';

export interface UserScopedCatalogRouterOptions {
  logger: Logger;
  httpAuth: HttpAuthService;
  kubernetesFetcher: UserScopedKubernetesFetcher;
}

async function getUserEntityRef(
  req: express.Request,
  httpAuth: HttpAuthService,
): Promise<string> {
  const credentials = await httpAuth.credentials(req);
  const principal = credentials.principal;

  if (principal.type === 'user') {
    return principal.userEntityRef;
  }

  throw new Error('User not authenticated');
}

export async function createUserScopedCatalogRouter(
  options: UserScopedCatalogRouterOptions,
): Promise<Router> {
  const { logger, httpAuth, kubernetesFetcher } = options;
  const router = Router();

  router.use(express.json());

  /**
   * GET /api/user-catalog/entities
   *
   * List all entities the current user has access to
   *
   * Query parameters:
   *   - filter: kind=Component (filter by kind)
   *   - resourceTypes: Pod,Deployment,Service (which K8s resources to fetch)
   */
  router.get('/entities', async (req, res) => {
    try {
      const userEntityRef = await getUserEntityRef(req, httpAuth);

      logger.info('Fetching user-scoped catalog entities', {
        user: userEntityRef,
      });

      // Parse resource types from query
      const resourceTypesParam = req.query.resourceTypes as string | undefined;
      const resourceTypes = resourceTypesParam
        ? resourceTypesParam.split(',')
        : ['Pod', 'Deployment', 'Service'];

      // Fetch entities for this user
      const entities = await kubernetesFetcher.fetchResourcesForUser(
        userEntityRef,
        resourceTypes,
      );

      // Apply filters if provided
      const kindFilter = req.query.filter as string | undefined;
      let filteredEntities = entities;

      if (kindFilter) {
        // Simple filter: kind=Component
        const [key, value] = kindFilter.split('=');
        if (key === 'kind') {
          filteredEntities = entities.filter(e => e.kind === value);
        }
      }

      logger.info('Returning user-scoped entities', {
        user: userEntityRef,
        total: filteredEntities.length,
      });

      // Return in same format as standard catalog API
      res.json({
        items: filteredEntities,
      });
    } catch (error: any) {
      logger.error('Failed to fetch user-scoped entities', error);

      if (error.message.includes('not authenticated')) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'You must be logged in to view catalog entities',
        });
      }

      res.status(500).json({
        error: 'Internal server error',
        message: error.message,
      });
    }
  });

  /**
   * GET /api/user-catalog/entities/by-name/:kind/:namespace/:name
   *
   * Get a specific entity by kind, namespace, and name
   *
   * Only returns the entity if the user has access to it
   */
  router.get('/entities/by-name/:kind/:namespace/:name', async (req, res) => {
    try {
      const userEntityRef = await getUserEntityRef(req, httpAuth);
      const { kind, namespace, name } = req.params;

      logger.info('Fetching specific user-scoped entity', {
        user: userEntityRef,
        kind,
        namespace,
        name,
      });

      // Fetch all entities for user
      const entities = await kubernetesFetcher.fetchResourcesForUser(
        userEntityRef,
      );

      // Find the specific entity
      const entity = entities.find(
        e =>
          e.kind === kind &&
          e.metadata.namespace === namespace &&
          e.metadata.name === name,
      );

      if (!entity) {
        return res.status(404).json({
          error: 'Not found',
          message: `Entity ${kind}:${namespace}/${name} not found or you don't have access`,
        });
      }

      res.json(entity);
    } catch (error: any) {
      logger.error('Failed to fetch specific entity', error);

      if (error.message.includes('not authenticated')) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'You must be logged in',
        });
      }

      res.status(500).json({
        error: 'Internal server error',
        message: error.message,
      });
    }
  });

  /**
   * GET /api/user-catalog/stats
   *
   * Get statistics about entities the user can access
   */
  router.get('/stats', async (req, res) => {
    try {
      const userEntityRef = await getUserEntityRef(req, httpAuth);

      const entities = await kubernetesFetcher.fetchResourcesForUser(
        userEntityRef,
      );

      // Group by kind
      const byKind: Record<string, number> = {};
      for (const entity of entities) {
        byKind[entity.kind] = (byKind[entity.kind] || 0) + 1;
      }

      // Group by namespace
      const byNamespace: Record<string, number> = {};
      for (const entity of entities) {
        const ns = entity.metadata.namespace || 'default';
        byNamespace[ns] = (byNamespace[ns] || 0) + 1;
      }

      res.json({
        user: userEntityRef,
        total: entities.length,
        byKind,
        byNamespace,
      });
    } catch (error: any) {
      logger.error('Failed to get stats', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message,
      });
    }
  });

  return router;
}
