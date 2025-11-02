export default ({ env }) => ({
  connection: {
    // PostgreSQL configuration (ACTIVE - ready for migration)
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

    // SQLite configuration (BACKUP - used for migration source)
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
