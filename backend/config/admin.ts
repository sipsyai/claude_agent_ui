export default ({ env }) => ({
  auth: {
    secret: env('STRAPI_ADMIN_JWT_SECRET', 'default_admin_secret'),
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
