import { createBackend } from '@backstage/backend-defaults';
import fs from 'fs';
import path from 'path';

/**
 * Conditionally loads optional plugins that may not be available in all environments.
 * This allows the backend to start even if fork repositories aren't cloned.
 */
export async function loadOptionalPlugins(backend: ReturnType<typeof createBackend>) {
  const workspaceRoot = path.resolve(__dirname, '../../../..');
  
  // Check if TeraSky fork repositories are available
  const plugins = [
    {
      name: '@terasky/backstage-plugin-kubernetes-ingestor',
      path: path.join(workspaceRoot, 'backstage-plugins/plugins/kubernetes-ingestor'),
      description: 'Upstream TeraSky version'
    },
    {
      name: '@terasky/backstage-plugin-kubernetes-ingestor-custom',
      path: path.join(workspaceRoot, 'backstage-plugins-custom/plugins/kubernetes-ingestor'),
      description: 'Customized fork version'
    }
  ];

  for (const plugin of plugins) {
    try {
      // Check if the plugin directory exists
      if (fs.existsSync(plugin.path)) {
        console.log(`[Optional Plugin] Loading ${plugin.name} (${plugin.description})`);
        // Dynamically import the plugin
        await backend.add(import(plugin.name));
      } else {
        console.log(`[Optional Plugin] Skipping ${plugin.name} - repository not cloned at ${plugin.path}`);
      }
    } catch (error) {
      // If import fails for any other reason, log but don't crash
      console.warn(`[Optional Plugin] Failed to load ${plugin.name}:`, error);
    }
  }
}