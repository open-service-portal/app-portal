import React from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { identityApiRef } from '@backstage/core-plugin-api';
import { SidebarItem } from '@backstage/core-components';
import { useAsync } from 'react-use';
import PersonIcon from '@material-ui/icons/Person';

/**
 * UserProfile Component
 *
 * Displays the authenticated user's name in the sidebar.
 * Clicking the name navigates to the user's profile page.
 *
 * Supports all authentication methods:
 * - OIDC (Kubernetes Cluster Auth)
 * - GitHub
 * - Guest
 */
export const UserProfile = () => {
  const identityApi = useApi(identityApiRef);

  const { value: identity, loading } = useAsync(async () => {
    try {
      const backstageIdentity = await identityApi.getBackstageIdentity();
      const profileInfo = await identityApi.getProfileInfo();

      return {
        displayName: profileInfo?.displayName || extractNameFromRef(backstageIdentity.userEntityRef),
        email: profileInfo?.email,
        userEntityRef: backstageIdentity.userEntityRef,
      };
    } catch (error) {
      console.error('Failed to load identity:', error);
      return null;
    }
  }, [identityApi]);

  if (loading || !identity) {
    return null;
  }

  // Extract the catalog path from the user entity ref
  // e.g., "user:default/guest" -> "/catalog/default/user/guest"
  const profilePath = identity.userEntityRef.replace(/^(\w+):(\w+)\/(.+)$/, '/catalog/$2/$1/$3');

  return (
    <SidebarItem
      icon={PersonIcon}
      to={profilePath}
      text={identity.displayName}
    />
  );
};

/**
 * Extract display name from user entity reference
 * user:default/felix → Felix
 * user:default/felix.smith → Felix Smith
 */
function extractNameFromRef(userEntityRef: string): string {
  const parts = userEntityRef.split('/');
  const username = parts[parts.length - 1];

  // Convert kebab-case or snake_case to Title Case
  return username
    .split(/[-_.]/g)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
