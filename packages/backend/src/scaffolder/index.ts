import {
  createBackendModule
} from '@backstage/backend-plugin-api';
import { scaffolderActionsExtensionPoint } from '@backstage/plugin-scaffolder-node/alpha';
import { createGenerateIdAction } from './generateId';
import { createValidateGitHubAuthAction } from './actions/validateGitHubAuth';

const scaffolderModuleCustomActions = createBackendModule({
  pluginId: 'scaffolder',
  moduleId: 'custom-actions',
  register(reg) {
    reg.registerInit({
      deps: {
        scaffolder: scaffolderActionsExtensionPoint,
      },
      async init({ scaffolder }) {
        scaffolder.addActions(
          createGenerateIdAction(),
          createValidateGitHubAuthAction(),
        );
      },
    });
  },
});

export default scaffolderModuleCustomActions;