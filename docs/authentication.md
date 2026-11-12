# MailForge Authentication & Authorization

## Overview

MailForge uses AWS Cognito for user authentication and implements role-based access control (RBAC) for authorization within organizations.

## Authentication

### Sign Up

Create a new user account.

**Endpoint:**
```
POST /v1/auth/sign-up
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "name": "John Doe"
}
```

**Password Requirements:**
- Minimum 8 characters
- At least one uppercase letter
- At least one number
- At least one special character (!@#$%^&*)

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "usr_abc123",
    "email": "user@example.com",
    "name": "John Doe",
    "status": "active",
    "createdAt": 1234567890
  }
}
```

### Sign In

Authenticate and receive tokens.

**Endpoint:**
```
POST /v1/auth/sign-in
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGc...",
    "idToken": "eyJhbGc..."
  }
}
```

**Token Usage:**
Include the `accessToken` in the Authorization header:
```
Authorization: Bearer <accessToken>
```

### Get Profile

Retrieve current user profile.

**Endpoint:**
```
GET /v1/auth/profile
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "usr_abc123",
    "email": "user@example.com",
    "name": "John Doe",
    "status": "active",
    "lastLogin": 1234567890,
    "createdAt": 1234567890
  }
}
```

### Update Profile

Update user profile information.

**Endpoint:**
```
PATCH /v1/auth/profile
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "name": "Jane Doe"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "usr_abc123",
    "email": "user@example.com",
    "name": "Jane Doe",
    "status": "active",
    "createdAt": 1234567890
  }
}
```

### Sign Out

Invalidate all tokens for the current user.

**Endpoint:**
```
POST /v1/auth/sign-out
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Signed out successfully"
  }
}
```

## Authorization

### Role-Based Access Control

Each user has a role within an organization. Roles determine what actions a user can perform.

| Role | Permissions |
|---|---|
| **Owner** | Full organization control, can transfer ownership, manage all resources |
| **Admin** | Manage domains, mailboxes, team members, API keys |
| **Developer** | Create/manage API keys, view usage analytics |
| **Member** | Access assigned mailboxes, send/receive email |
| **Viewer** | Read-only access to organization and mailboxes |

### Organization Membership

Each user can be a member of multiple organizations with different roles.

#### Invite Member

Invite a user to join an organization.

**Endpoint:**
```
POST /v1/organizations/{organizationId}/team/members
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "email": "newmember@example.com",
  "role": "member"
}
```

**Requirements:**
- Inviter must be Owner or Admin
- User must not already be a member
- Role must be valid

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "mem_xyz789",
    "organizationId": "org_abc123",
    "userId": "usr_def456",
    "role": "member",
    "createdAt": 1234567890
  }
}
```

#### List Members

Get all members of an organization.

**Endpoint:**
```
GET /v1/organizations/{organizationId}/team/members
Authorization: Bearer <token>
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 50, max: 100)

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "mem_abc123",
        "organizationId": "org_abc123",
        "userId": "usr_abc123",
        "role": "owner",
        "user": {
          "id": "usr_abc123",
          "email": "owner@example.com",
          "name": "John Doe",
          "status": "active"
        },
        "createdAt": 1234567890
      }
    ],
    "total": 5,
    "page": 1,
    "pageSize": 50,
    "hasMore": false
  }
}
```

#### Update Member Role

Change a member's role.

**Endpoint:**
```
PATCH /v1/organizations/{organizationId}/team/members/{userId}
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "role": "admin"
}
```

**Restrictions:**
- Updater must be Owner or Admin
- Cannot change Owner's role
- Target role must be valid

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "mem_xyz789",
    "organizationId": "org_abc123",
    "userId": "usr_def456",
    "role": "admin",
    "createdAt": 1234567890
  }
}
```

#### Remove Member

Remove a member from an organization.

**Endpoint:**
```
DELETE /v1/organizations/{organizationId}/team/members/{userId}
Authorization: Bearer <token>
```

**Restrictions:**
- Remover must be Owner or Admin
- Cannot remove Owner

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Member removed successfully"
  }
}
```

## Token Management

### Token Types

- **Access Token**: Used to authenticate API requests. Expires in 1 hour.
- **ID Token**: Contains user identity information. Expires in 1 hour.
- **Refresh Token**: Used to obtain new tokens without re-authentication. Expires in 30 days.

### Token Refresh

When access token expires, use the refresh token:

**Endpoint:**
```
POST /v1/auth/refresh
```

**Request Body:**
```json
{
  "refreshToken": "<refreshToken>"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGc...",
    "idToken": "eyJhbGc..."
  }
}
```

### Token Revocation

All tokens are revoked when user signs out globally:

```
POST /v1/auth/sign-out
Authorization: Bearer <token>
```

This invalidates:
- All active access tokens
- All refresh tokens
- All sessions across devices

## API Key Authentication

For server-to-server authentication, use API keys instead of user tokens.

### Create API Key

```
POST /v1/api-keys
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "name": "Production API Key",
  "permissions": [
    "emails:send",
    "messages:read"
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "key_abc123",
    "name": "Production API Key",
    "key": "mf_abc123def456ghi789jkl012",
    "permissions": ["emails:send", "messages:read"],
    "createdAt": 1234567890
  }
}
```

**Important:** The key is only shown once. Store it securely.

### Use API Key

Include API key in Authorization header:

```
Authorization: Bearer <apiKey>
```

Or as custom header:

```
X-API-Key: <apiKey>
```

## Security Best Practices

### For Users

1. **Strong Passwords**: Use long, complex passwords with mixed character types
2. **MFA**: Enable multi-factor authentication for added security
3. **Token Storage**: Store tokens securely (httpOnly cookies recommended)
4. **Sign Out**: Always sign out on shared computers
5. **Account Recovery**: Set up account recovery options

### For Developers

1. **API Keys**: Store API keys in environment variables, never in code
2. **Token Expiration**: Implement token refresh flow
3. **HTTPS Only**: Always use HTTPS for API calls
4. **Rate Limiting**: Implement rate limiting in your application
5. **Validation**: Validate all user input server-side
6. **Least Privilege**: Use minimal required permissions for API keys

## Multi-Factor Authentication

### Enable MFA

```
POST /v1/auth/mfa/enable
Authorization: Bearer <token>
Content-Type: application/json

{
  "method": "totp"
}
```

Methods:
- `totp`: Time-based One-Time Password (Google Authenticator, Authy)
- `sms`: SMS-based code

### Verify MFA

```
POST /v1/auth/mfa/verify
Authorization: Bearer <token>
Content-Type: application/json

{
  "code": "123456"
}
```

## Error Codes

| Code | Status | Description |
|---|---|---|
| `UNAUTHORIZED` | 401 | Missing or invalid token |
| `FORBIDDEN` | 403 | User lacks required permissions |
| `INVALID_INPUT` | 400 | Validation error |
| `ALREADY_EXISTS` | 409 | User or membership already exists |
| `NOT_FOUND` | 404 | User or organization not found |
| `RATE_LIMITED` | 429 | Too many requests |

## Troubleshooting

### "Invalid credentials" on sign in

- Verify email and password are correct
- Check if account is active (not suspended)
- Reset password if forgotten

### "User not member of organization"

- User must be invited to organization first
- Contact organization owner to invite you

### Token expired

- Sign in again to get new tokens
- Implement refresh token flow for seamless experience

### "Insufficient permissions"

- Request organization owner to upgrade your role
- Some actions require Admin or Owner role

## References

- [AWS Cognito Documentation](https://docs.aws.amazon.com/cognito/)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
