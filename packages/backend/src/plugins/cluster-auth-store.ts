/**
 * Cluster Authentication Token Store
 *
 * Stores OIDC tokens in Backstage database for Kubernetes cluster access.
 * Uses the same database that stores GitHub auth tokens.
 *
 * Much simpler than the full OAuth flow since oidc-authenticator daemon
 * handles token exchange!
 *
 * Follows Backstage pattern from auth-backend/src/database/AuthDatabase.ts
 */

import { Knex } from 'knex';
import { Logger } from 'winston';
import { DatabaseService } from '@backstage/backend-plugin-api';

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

const TABLE_NAME = 'cluster_tokens';

/**
 * Database store for cluster authentication tokens
 * Follows Backstage pattern: lazy database initialization with promise caching
 */
export class ClusterAuthStore {
  private readonly database: DatabaseService;
  private readonly logger: Logger;
  private dbPromise: Promise<Knex> | undefined;

  static async create(database: DatabaseService, logger: Logger): Promise<ClusterAuthStore> {
    const store = new ClusterAuthStore(database, logger);
    // Eagerly initialize database and run migrations
    await store.getDb();
    return store;
  }

  private constructor(database: DatabaseService, logger: Logger) {
    this.database = database;
    this.logger = logger;
  }

  /**
   * Get database client with lazy initialization and promise caching
   * Following the pattern from auth-backend/src/database/AuthDatabase.ts
   */
  private async getDb(): Promise<Knex> {
    if (!this.dbPromise) {
      this.dbPromise = this.database.getClient().then(async (client) => {
        // Ensure table exists
        await this.ensureTable(client);
        return client;
      });
    }
    return this.dbPromise;
  }

  /**
   * Initialize the database table
   * Called automatically on first database access
   */
  private async ensureTable(db: Knex): Promise<void> {
    const exists = await db.schema.hasTable(TABLE_NAME);

    if (!exists) {
      this.logger.info(`Creating ${TABLE_NAME} table...`);

      await db.schema.createTable(TABLE_NAME, table => {
        table.string('user_entity_ref').primary().notNullable();
        table.text('access_token').notNullable();
        table.text('id_token').notNullable();
        table.text('refresh_token').nullable();
        table.string('issuer').notNullable();
        table.timestamp('expires_at').notNullable();
        table.timestamp('created_at').defaultTo(db.fn.now());
        table.timestamp('updated_at').defaultTo(db.fn.now());

        // Index for faster lookups by expiration
        table.index('expires_at');
        table.index('issuer');
      });

      this.logger.info(`Table ${TABLE_NAME} created successfully`);
    }
  }

  /**
   * Save or update cluster tokens for a user
   */
  async saveTokens(tokens: ClusterTokens): Promise<void> {
    const db = await this.getDb();

    await db(TABLE_NAME)
      .insert({
        user_entity_ref: tokens.userEntityRef,
        access_token: tokens.accessToken,
        id_token: tokens.idToken,
        refresh_token: tokens.refreshToken,
        issuer: tokens.issuer,
        expires_at: tokens.expiresAt,
        updated_at: db.fn.now(),
      })
      .onConflict('user_entity_ref')
      .merge();
  }

  /**
   * Get tokens for a specific user
   */
  async getTokens(userEntityRef: string): Promise<ClusterTokens | undefined> {
    const db = await this.getDb();

    const row = await db(TABLE_NAME)
      .where('user_entity_ref', userEntityRef)
      .first();

    if (!row) return undefined;

    return {
      userEntityRef: row.user_entity_ref,
      accessToken: row.access_token,
      idToken: row.id_token,
      refreshToken: row.refresh_token,
      issuer: row.issuer,
      expiresAt: new Date(row.expires_at),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  /**
   * Check if user has valid (non-expired) tokens
   */
  async hasValidTokens(userEntityRef: string): Promise<boolean> {
    const db = await this.getDb();

    // Get the tokens first to check expiry
    const tokens = await this.getTokens(userEntityRef);

    if (!tokens) {
      return false;
    }

    // Check if token is expired by comparing JavaScript Date objects
    const isValid = tokens.expiresAt.getTime() > Date.now();

    this.logger.info('Checking token validity', {
      userEntityRef,
      expiresAt: tokens.expiresAt.toISOString(),
      now: new Date().toISOString(),
      isValid,
    });

    return isValid;
  }

  /**
   * Delete tokens for a specific user
   */
  async deleteTokens(userEntityRef: string): Promise<boolean> {
    const db = await this.getDb();

    const deleted = await db(TABLE_NAME)
      .where('user_entity_ref', userEntityRef)
      .delete();

    return deleted > 0;
  }

  /**
   * Get statistics about stored tokens
   */
  async getStats(): Promise<{ total: number; valid: number; expired: number }> {
    const db = await this.getDb();

    const [totalResult, validResult] = await Promise.all([
      db(TABLE_NAME).count('* as count').first(),
      db(TABLE_NAME)
        .where('expires_at', '>', db.fn.now())
        .count('* as count')
        .first(),
    ]);

    const total = (totalResult?.count as number) || 0;
    const valid = (validResult?.count as number) || 0;

    return {
      total,
      valid,
      expired: total - valid,
    };
  }

  /**
   * Delete all expired tokens (cleanup)
   */
  async deleteExpiredTokens(): Promise<number> {
    const db = await this.getDb();

    const deleted = await db(TABLE_NAME)
      .where('expires_at', '<', db.fn.now())
      .delete();

    if (deleted > 0) {
      this.logger.info(`Deleted ${deleted} expired cluster tokens`);
    }

    return deleted;
  }
}
