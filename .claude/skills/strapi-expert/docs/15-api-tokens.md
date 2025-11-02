# API Tokens

**Source:** https://docs.strapi.io/cms/features/api-tokens
**Downloaded:** 2025-10-31

---

# API Tokens

> API tokens provide scoped authentication for REST and GraphQL requests without exposing user credentials.

API tokens enable users to authenticate REST and GraphQL API queries. They offer a secure alternative to managing user accounts for applications and external services.

## Identity Card

| Aspect | Details |
|--------|---------|
| Plan | Free feature |
| Role and permission | Minimum "Access the API tokens settings page" in Roles > Settings - API tokens |
| Activation | Available by default |
| Environment | Available in both Development & Production |

## Configuration

### Admin Panel Settings

**Location:** Settings > Global settings > API Tokens

The API Tokens interface displays a table with all created tokens, including their name, description, creation date, and last use date.

From this interface, you can:
- Edit a token's name, description, type, duration, or regenerate it
- Delete a token

**Note:** Strapi pre-generates two tokens: one with Full access and one Read-only. Consider regenerating them after setting up an encryption key for persistent visibility.

#### Creating a New API Token

1. Click the **Create new API Token** button
2. Configure the token settings:
   - **Name:** The token identifier
   - **Description:** Optional context about the token
   - **Token duration:** Choose 7 days, 30 days, 90 days, or Unlimited
   - **Token type:** Select Read-only, Full access, or Custom
3. For Custom tokens, define specific permissions by clicking content types and enabling/disabling permissions
4. Click **Save**

#### Regenerating an API Token

1. Click the token's edit button
2. Click the **Regenerate** button
3. Confirm in the dialog
4. Copy the newly displayed token

### Code-Based Configuration

API tokens are generated using a salt stored in the `.env` file as `API_TOKEN_SALT`. Customize it by:

- Updating `apiToken.salt` in `/config/admin`
- Creating an `API_TOKEN_SALT` environment variable

**Caution:** Changing the salt invalidates all existing tokens.

#### Ensuring Token Visibility

Configure an encryption key in `/config/admin` to allow persistent token visibility:

**JavaScript:**
```javascript
module.exports = ({ env }) => ({
  secrets: {
    encryptionKey: env('ENCRYPTION_KEY'),
  }
});
```

**TypeScript:**
```typescript
export default ({ env }) => ({
  secrets: {
    encryptionKey: env('ENCRYPTION_KEY'),
  }
});
```

Without this key, tokens remain usable but won't be viewable after initial display. New projects have this auto-generated.

## Usage

API tokens authenticate requests to REST and GraphQL endpoints as an authenticated user. They're ideal for granting access without creating user accounts or modifying the Users & Permissions plugin.

**Implementation:** Add the token to the request's `Authorization` header using the syntax: `bearer your-api-token`

**Note:** Read-only tokens only access `find` and `findOne` functions.

---

**Tags:** api tokens, admin panel, authentication, users & permissions, features
