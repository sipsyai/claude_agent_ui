# Users & Permissions

**Source:** https://docs.strapi.io/cms/features/users-permissions
**Downloaded:** 2025-10-31

---

# Users & Permissions

> "Users & Permissions manages end-user accounts, JWT-based authentication, and role-based access to APIs."

## Overview

The Users & Permissions feature enables management of end-user accounts with JWT-based authentication and access control lists (ACL) for managing permissions across user groups.

**Feature Details:**
- Plan: Free feature
- Role & permission: CRUD permissions in Roles > Plugins - Users & Permissions
- Activation: Available by default
- Environment: Available in both Development & Production

## Admin Panel Configuration

### Roles

#### Creating/Editing Roles

**Path:** Users & Permissions plugin > Roles

Two default end-user roles exist:
- **Authenticated:** For logged-in users
- **Public:** For users without login

To configure a role:
1. Click the edit button or create new role
2. Fill in the Role details (Name, Description)
3. Configure Permissions by ticking boxes for actions
4. Click **Save**

### Providers

**Path:** Users & Permissions plugin > Providers

Enable third-party authentication providers for end-users. Email is enabled by default.

### Email Templates

**Path:** Users & Permissions plugin > Email templates

Two templates available:
- Email address confirmation
- Reset password

### Advanced Settings

**Path:** Users & Permissions plugin > Advanced settings

- Default role for authenticated users
- One account per email address toggle
- Enable sign-ups toggle
- Reset password page URL
- Enable email confirmation toggle
- Redirection URL after confirmation

## Code-Based Configuration

### JWT Configuration

Configure JSON Web Token generation in `/config/plugins`:

#### JWT Management Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| `legacy-support` | (default) Long-lived JWTs | Existing applications |
| `refresh` | Session management with refresh tokens | New applications, enhanced security |

**Legacy Mode:**

```javascript
module.exports = ({ env }) => ({
  'users-permissions': {
    config: {
      jwtManagement: 'legacy-support',
      jwt: {
        expiresIn: '7d',
      },
    },
  },
});
```

**Refresh Mode:**

```javascript
module.exports = ({ env }) => ({
  'users-permissions': {
    config: {
      jwtManagement: 'refresh',
      sessions: {
        accessTokenLifespan: 604800, // 1 week
        maxRefreshTokenLifespan: 2592000, // 30 days
        idleRefreshTokenLifespan: 604800, // 7 days
        httpOnly: false,
        cookie: {
          name: 'strapi_up_refresh',
          sameSite: 'lax',
          path: '/',
          secure: false,
        },
      },
    },
  },
});
```

### Registration Configuration

Allow custom fields in registration:

```javascript
module.exports = ({ env }) => ({
  'users-permissions': {
    config: {
      register: {
        allowedFields: ['nickname'],
      },
    },
  },
});
```

### Rate Limiting

| Parameter | Description | Type | Default |
|-----------|-------------|------|---------|
| `ratelimit.enabled` | Enable/disable rate limiter | boolean | `true` |
| `ratelimit.interval` | Time window for requests | object | `{ min: 5 }` |
| `ratelimit.max` | Max requests in time window | integer | `5` |

**Example:**

```javascript
module.exports = ({ env }) => ({
  'users-permissions': {
    config: {
      ratelimit: {
        enabled: true,
        interval: { min: 5 },
        max: 5,
      },
    },
  },
});
```

## API Usage

### Authentication Endpoints

| Method | URL | Description |
|--------|-----|-------------|
| `POST` | `/api/auth/local` | Login with email/username and password |
| `POST` | `/api/auth/local/register` | User registration |
| `POST` | `/api/auth/forgot-password` | Request password reset |
| `POST` | `/api/auth/reset-password` | Reset password with token |
| `GET` | `/api/auth/email-confirmation` | Confirm email address |

### Session Management (Refresh Mode)

| Method | URL | Description |
|--------|-----|-------------|
| `POST` | `/api/auth/refresh` | Refresh access token |
| `POST` | `/api/auth/logout` | Revoke user sessions |

### Login Example

```javascript
import axios from 'axios';

axios
  .post('http://localhost:1337/api/auth/local', {
    identifier: 'user@strapi.io',
    password: 'strapiPassword',
  })
  .then(response => {
    console.log('User profile', response.data.user);
    console.log('User token', response.data.jwt);
  })
  .catch(error => {
    console.log('An error occurred:', error.response);
  });
```

### Registration Example

```javascript
axios
  .post('http://localhost:1337/api/auth/local/register', {
    username: 'Strapi user',
    email: 'user@strapi.io',
    password: 'strapiPassword',
  })
  .then(response => {
    console.log('User profile', response.data.user);
    console.log('User token', response.data.jwt);
  });
```

### Using JWT in Requests

```javascript
const token = 'YOUR_TOKEN_HERE';

axios
  .get('http://localhost:1337/api/posts', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  .then(response => {
    console.log('Data: ', response.data);
  });
```

### Refresh Token Example

```bash
curl -X POST http://localhost:1337/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "your-refresh-token"
  }'
```

**Response:**

```json
{
  "jwt": "your-new-access-token"
}
```

### User Object in Strapi Context

The authenticated `user` object is available as `ctx.state.user`:

```javascript
create: async ctx => {
  const { id } = ctx.state.user;
  const depositObj = {
    ...ctx.request.body,
    depositor: id,
  };
  const data = await strapi.services.deposit.add(depositObj);
  ctx.created(data);
};
```

---

**Tags:** admin-panel, users-permissions, api-tokens, features, authentication, JWT
