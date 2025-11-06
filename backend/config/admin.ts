export default ({ env }) => ({
  auth: {
    secret: env('STRAPI_ADMIN_JWT_SECRET', 'default_admin_secret'),
    // Session configuration with millisecond values
    // 30 days = 30 * 24 * 60 * 60 * 1000 = 2592000000 ms
    sessions: {
      maxRefreshTokenLifespan: 2592000000, // 30 days in milliseconds
      maxSessionLifespan: 2592000000, // 30 days in milliseconds
    },
  },
  apiToken: {
    salt: env('STRAPI_API_TOKEN_SALT', 'default_api_token_salt'),
  },
  transfer: {
    token: {
      salt: env('STRAPI_TRANSFER_TOKEN_SALT', 'default_transfer_token_salt'),
    },
  },
  flags: {
    nps: env.bool('FLAG_NPS', true),
    promoteEE: env.bool('FLAG_PROMOTE_EE', true),
  },
});
