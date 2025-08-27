import { createBackendModule } from '@backstage/backend-plugin-api';
import { policyExtensionPoint } from '@backstage/plugin-permission-node/alpha';
import { AllowGuestReadPolicy } from '../permissions';

/**
 * Permission module that allows guest users to read catalog entities
 */
export const permissionsModuleAllowGuestRead = createBackendModule({
  pluginId: 'permission',
  moduleId: 'allow-guest-read',
  register(reg) {
    reg.registerInit({
      deps: { policy: policyExtensionPoint },
      async init({ policy }) {
        policy.setPolicy(new AllowGuestReadPolicy());
      },
    });
  },
});

export default permissionsModuleAllowGuestRead;