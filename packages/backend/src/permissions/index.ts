import { createBackendModule } from '@backstage/backend-plugin-api';
import { policyExtensionPoint } from '@backstage/plugin-permission-node/alpha';
import {
  BackstageIdentityResponse,
  BackstageUserIdentity,
} from '@backstage/plugin-auth-node';
import {
  AuthorizeResult,
  PolicyDecision,
  isPermission,
} from '@backstage/plugin-permission-common';
import {
  PermissionPolicy,
  PolicyQuery,
} from '@backstage/plugin-permission-node';
import { catalogEntityReadPermission } from '@backstage/plugin-catalog-common/alpha';

/**
 * A permission policy that allows all users (including guests) to read catalog entities,
 * but restricts other operations to authenticated users only.
 */
class AllowGuestReadPolicy implements PermissionPolicy {
  async handle(
    request: PolicyQuery,
    user?: BackstageIdentityResponse | BackstageUserIdentity,
  ): Promise<PolicyDecision> {
    // Allow all read operations on catalog entities for everyone (including guests)
    if (isPermission(request.permission, catalogEntityReadPermission)) {
      return { result: AuthorizeResult.ALLOW };
    }

    // For non-read operations, check if user is authenticated
    if (!user) {
      // Deny non-read operations for unauthenticated users
      return { result: AuthorizeResult.DENY };
    }

    // Allow all operations for authenticated users
    return { result: AuthorizeResult.ALLOW };
  }
}

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