import * as express from 'express';
import Router from 'express-promise-router';
import { LoggerService } from '@backstage/backend-plugin-api';
import { KubernetesClient } from './KubernetesClient';
import { ListXRsResponse } from '../types';

export interface RouterOptions {
  logger: LoggerService;
  kubernetesClient: KubernetesClient;
}

/**
 * Create the Express router for Crossplane API endpoints
 */
export async function createRouter(
  options: RouterOptions,
): Promise<express.Router> {
  const { logger, kubernetesClient } = options;

  const router = Router();
  router.use(express.json());

  /**
   * GET /xrs - List Crossplane XR instances
   *
   * Query parameters:
   * - apiVersion (required): API version (e.g., openportal.dev/v1alpha1)
   * - kind (required): Resource kind (e.g., ManagedNamespace)
   * - namespace (optional): Filter by namespace
   * - cluster (optional): Filter by cluster name
   * - labelSelector (optional): Kubernetes label selector
   */
  router.get('/xrs', async (req, res) => {
    const { apiVersion, kind, namespace, cluster, labelSelector } = req.query;

    // Validate required parameters
    if (!apiVersion || typeof apiVersion !== 'string') {
      return res.status(400).json({
        error: 'Missing or invalid required parameter: apiVersion',
      });
    }

    if (!kind || typeof kind !== 'string') {
      return res.status(400).json({
        error: 'Missing or invalid required parameter: kind',
      });
    }

    try {
      logger.info('Listing XRs', {
        apiVersion,
        kind,
        namespace: namespace || 'all',
        cluster: cluster || 'all',
      });

      const xrs = await kubernetesClient.listXRs(
        apiVersion,
        kind,
        namespace as string | undefined,
        cluster as string | undefined,
        labelSelector as string | undefined,
      );

      const response: ListXRsResponse = {
        items: xrs,
      };

      res.json(response);
    } catch (error: any) {
      logger.error('Failed to list XRs', error);
      res.status(500).json({
        error: 'Failed to list XRs',
        message: error.message,
      });
    }
  });

  /**
   * GET /clusters - List configured cluster names
   */
  router.get('/clusters', async (_req, res) => {
    try {
      const clusters = kubernetesClient.getClusterNames();
      res.json({ clusters });
    } catch (error: any) {
      logger.error('Failed to list clusters', error);
      res.status(500).json({
        error: 'Failed to list clusters',
        message: error.message,
      });
    }
  });

  /**
   * GET /health - Health check endpoint
   */
  router.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  return router;
}
