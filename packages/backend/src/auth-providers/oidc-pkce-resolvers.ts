/*
 * OIDC PKCE Sign-In Resolvers
 *
 * These resolvers map OIDC claims to Backstage user entities.
 */

import { createSignInResolverFactory } from '@backstage/plugin-auth-node';

/**
 * Available sign-in resolvers for OIDC PKCE provider.
 *
 * Use these in your app-config.yaml:
 *
 * signIn:
 *   resolvers:
 *     - resolver: emailMatchingUserEntityProfileEmail
 */
export const oidcSignInResolvers = {
  /**
   * Looks up the user using the email claim from the OIDC token,
   * and matches it with the email address of the user entity.
   */
  emailMatchingUserEntityProfileEmail: createSignInResolverFactory({
    create() {
      return async (info, ctx) => {
        const { profile } = info;

        if (!profile.email) {
          throw new Error('OIDC profile does not contain an email');
        }

        return ctx.signInWithCatalogUser({
          filter: {
            'spec.profile.email': profile.email,
          },
        });
      };
    },
  }),

  /**
   * Looks up the user using the email claim from the OIDC token,
   * and matches it with the name of the user entity.
   */
  emailLocalPartMatchingUserEntityName: createSignInResolverFactory({
    create() {
      return async (info, ctx) => {
        const { profile } = info;

        if (!profile.email) {
          throw new Error('OIDC profile does not contain an email');
        }

        const [localPart] = profile.email.split('@');

        return ctx.signInWithCatalogUser({
          entityRef: { name: localPart },
        });
      };
    },
  }),
};
