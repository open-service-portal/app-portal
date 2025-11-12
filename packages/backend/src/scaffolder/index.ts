import {
  createBackendModule,
  coreServices,
} from '@backstage/backend-plugin-api';
import { scaffolderActionsExtensionPoint } from '@backstage/plugin-scaffolder-node/alpha';
import { createGenerateIdAction } from './generateId';
import { createValidateEntraIdUsersAction } from './validateEntraIdUsers';

const scaffolderModuleCustomActions = createBackendModule({
  pluginId: 'scaffolder',
  moduleId: 'custom-actions',
  register(reg) {
    reg.registerInit({
      deps: {
        scaffolder: scaffolderActionsExtensionPoint,
        config: coreServices.rootConfig,
      },
      async init({ scaffolder, config }) {
        scaffolder.addActions(
          createGenerateIdAction(),
          createValidateEntraIdUsersAction(config),
        );
      },
    });
  },
});

export default scaffolderModuleCustomActions;