/*
 * Custom permission policy that allows guest users to view templates and other catalog entities
 */

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
export class AllowGuestReadPolicy implements PermissionPolicy {
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