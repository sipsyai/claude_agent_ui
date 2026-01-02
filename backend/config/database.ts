export default ({ env }) => ({
  connection: {
    // ===================================================================
    // PRIMARY DATABASE: PostgreSQL (PRODUCTION-READY)
    // ===================================================================
    // PostgreSQL is the ONLY supported database for production deployments.
    // This configuration includes connection pooling, timeouts, and SSL support
    // for optimal performance and reliability in production environments.
    //
    // Migration completed: 2026-01-02
    // ===================================================================
    client: 'postgres',
    connection: {
      host: env('DATABASE_HOST', 'localhost'),
      port: env.int('DATABASE_PORT', 5433),
      database: env('DATABASE_NAME', 'claude_agent_ui'),
      user: env('DATABASE_USERNAME', 'postgres'),
      password: env('DATABASE_PASSWORD', 'postgres123'),
      schema: env('DATABASE_SCHEMA', 'public'),
      ssl: env.bool('DATABASE_SSL', false) && {
        rejectUnauthorized: env.bool('DATABASE_SSL_SELF', false),
      },
    },

    // ===================================================================
    // ⚠️  DEPRECATED: SQLite Configuration
    // ===================================================================
    // SQLite support is DEPRECATED as of 2026-01-02.
    //
    // Migration Status:
    //   - PostgreSQL is now the PRIMARY and ONLY supported database
    //   - SQLite is only used as source during one-time data migration
    //   - Migration scripts located in: scripts/migration-tools/
    //
    // Do NOT enable SQLite for production use. It was replaced due to:
    //   - Limited scalability for production workloads
    //   - Inferior concurrency handling compared to PostgreSQL
    //   - Data integrity concerns identified during development
    //
    // If you need to migrate data from SQLite to PostgreSQL, use:
    //   npm run migrate:sqlite-to-postgres
    //
    // For rollback procedures, see: docs/database/POSTGRES_ROLLBACK_PROCEDURES.md
    // ===================================================================
    // client: 'sqlite',
    // connection: {
    //   filename: env('DATABASE_FILENAME', '.tmp/data.db'),
    // },
    // useNullAsDefault: true,
    pool: {
      min: env.int('DATABASE_POOL_MIN', 2),
      max: env.int('DATABASE_POOL_MAX', 10),
      acquireTimeoutMillis: env.int('DATABASE_ACQUIRE_TIMEOUT', 60000),
      createTimeoutMillis: env.int('DATABASE_CREATE_TIMEOUT', 30000),
      destroyTimeoutMillis: env.int('DATABASE_DESTROY_TIMEOUT', 5000),
      idleTimeoutMillis: env.int('DATABASE_IDLE_TIMEOUT', 30000),
      reapIntervalMillis: env.int('DATABASE_REAP_INTERVAL', 1000),
      createRetryIntervalMillis: env.int('DATABASE_RETRY_INTERVAL', 200),
    },
    debug: env.bool('DATABASE_DEBUG', false),
  },
});
