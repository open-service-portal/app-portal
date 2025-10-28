/**
 * Cluster Authentication Token Store
 *
 * Stores OIDC tokens in Backstage database for Kubernetes cluster access.
 * Uses the same database that stores GitHub auth tokens.
 *
 * Much simpler than the full OAuth flow since oidc-authenticator daemon
 * handles token exchange!
 */

import { Knex } from 'knex';
import { Logger } from 'winston';

export interface ClusterTokens {
  userEntityRef: string;    // e.g., 'user:default/john.doe'
  accessToken: string;      // For Kubernetes API calls
  idToken: string;         // User identity JWT
  refreshToken?: string;    // For token renewal (optional)
  issuer: string;          // OIDC provider URL
  expiresAt: Date;         // Token expiration
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ClusterAuthStoreOptions {
  database: Knex;
  logger: Logger;
}

const TABLE_NAME = 'cluster_tokens';

/**
 * Database store for cluster authentication tokens
 */
export class ClusterAuthStore {
  private db: Knex;
  private logger: Logger;
  private initialized: boolean = false;

  constructor(options: ClusterAuthStoreOptions) {
    this.db = options.database;
    this.logger = options.logger;
  }

  /**
   * Initialize the database table
   * Called automatically on first operation
   */
  private async ensureTable(): Promise<void> {
    if (this.initialized) return;

    const exists = await this.db.schema.hasTable(TABLE_NAME);

    if (!exists) {
      this.logger.info(`Creating ${TABLE_NAME} table...`);

      await this.db.schema.createTable(TABLE_NAME, table => {
        table.string('user_entity_ref').primary().notNullable();
        table.text('access_token').notNullable();
        table.text('id_token').notNullable();
        table.text('refresh_token').nullable();
        table.string('issuer').notNullable();
        table.timestamp('expires_at').notNullable();
        table.timestamp('created_at').defaultTo(this.db.fn.now());
        table.timestamp('updated_at').defaultTo(this.db.fn.now());

        // Index for faster lookups by expiration
        table.index('expires_at');
        table.index('issuer');
      });

      this.logger.info(`${TABLE_NAME} table created`);
    }

    this.initialized = true;
  }

  /**
   * Save or update tokens for a user
   */
  async saveTokens(tokens: ClusterTokens): Promise<void> {
    await this.ensureTable();

    const now = new Date();
    const data = {
      user_entity_ref: tokens.userEntityRef,
      access_token: tokens.accessToken,
      id_token: tokens.idToken,
      refresh_token: tokens.refreshToken || null,
      issuer: tokens.issuer,
      expires_at: tokens.expiresAt,
      updated_at: now,
    };

    // Upsert (insert or update)
    const existing = await this.db(TABLE_NAME)
      .where({ user_entity_ref: tokens.userEntityRef })
      .first();

    if (existing) {
      // Update existing
      await this.db(TABLE_NAME)
        .where({ user_entity_ref: tokens.userEntityRef })
        .update(data);

      this.logger.info('Cluster tokens updated', {
        user: tokens.userEntityRef,
        issuer: tokens.issuer,
      });
    } else {
      // Insert new
      await this.db(TABLE_NAME).insert({
        ...data,
        created_at: now,
      });

      this.logger.info('Cluster tokens saved', {
        user: tokens.userEntityRef,
        issuer: tokens.issuer,
      });
    }
  }

  /**
   * Get tokens for a user
   */
  async getTokens(userEntityRef: string): Promise<ClusterTokens | null> {
    await this.ensureTable();

    const row = await this.db(TABLE_NAME)
      .where({ user_entity_ref: userEntityRef })
      .first();

    if (!row) {
      return null;
    }

    return {
      userEntityRef: row.user_entity_ref,
      accessToken: row.access_token,
      idToken: row.id_token,
      refreshToken: row.refresh_token || undefined,
      issuer: row.issuer,
      expiresAt: new Date(row.expires_at),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  /**
   * Delete tokens for a user
   */
  async deleteTokens(userEntityRef: string): Promise<boolean> {
    await this.ensureTable();

    const deleted = await this.db(TABLE_NAME)
      .where({ user_entity_ref: userEntityRef })
      .delete();

    if (deleted > 0) {
      this.logger.info('Cluster tokens deleted', { user: userEntityRef });
      return true;
    }

    return false;
  }

  /**
   * Check if user has valid (non-expired) tokens
   */
  async hasValidTokens(userEntityRef: string): Promise<boolean> {
    await this.ensureTable();

    const tokens = await this.getTokens(userEntityRef);
    if (!tokens) return false;

    return tokens.expiresAt.getTime() > Date.now();
  }

  /**
   * Get all users with expired tokens (for cleanup)
   */
  async getExpiredTokens(): Promise<string[]> {
    await this.ensureTable();

    const rows = await this.db(TABLE_NAME)
      .where('expires_at', '<', new Date())
      .select('user_entity_ref');

    return rows.map(row => row.user_entity_ref);
  }

  /**
   * Delete all expired tokens (cleanup)
   */
  async deleteExpiredTokens(): Promise<number> {
    await this.ensureTable();

    const deleted = await this.db(TABLE_NAME)
      .where('expires_at', '<', new Date())
      .delete();

    if (deleted > 0) {
      this.logger.info(`Deleted ${deleted} expired cluster tokens`);
    }

    return deleted;
  }

  /**
   * Get count of stored tokens (for monitoring)
   */
  async getTokenCount(): Promise<number> {
    await this.ensureTable();

    const result = await this.db(TABLE_NAME).count('* as count').first();
    return Number(result?.count || 0);
  }

  /**
   * Get statistics about stored tokens
   */
  async getStats(): Promise<{
    total: number;
    valid: number;
    expired: number;
  }> {
    await this.ensureTable();

    const now = new Date();

    const [total, valid] = await Promise.all([
      this.db(TABLE_NAME).count('* as count').first(),
      this.db(TABLE_NAME)
        .where('expires_at', '>=', now)
        .count('* as count')
        .first(),
    ]);

    const totalCount = Number(total?.count || 0);
    const validCount = Number(valid?.count || 0);

    return {
      total: totalCount,
      valid: validCount,
      expired: totalCount - validCount,
    };
  }
}
