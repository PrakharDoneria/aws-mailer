# Mailbox Management Guide

## Overview

Mailboxes are the logical email accounts within MailForge. Each mailbox has a unique email address (`localpart@domain.com`) and can receive messages, store them, and be accessed through the API or webmail.

## Concepts

### Mailbox

A logical email account that:
- Belongs to a verified domain
- Has a unique local part (e.g., "hello" in "hello@example.com")
- Stores received emails
- Sends outbound emails
- Has a storage quota
- Can have multiple aliases

### Alias

An additional email address that forwards to the primary mailbox. For example:
- Primary: `hello@example.com`
- Alias: `support@example.com` → forwards to `hello@example.com`

### Storage Quota

Maximum storage allowed for a mailbox:
- **Free plan**: 5GB per mailbox
- **Pro plan**: 50GB per mailbox
- **Business plan**: 500GB per mailbox

Emails exceeding quota will be rejected with a bounce.

## API Endpoints

### Create Mailbox

Create a new mailbox in a verified domain.

**Endpoint:**
```
POST /v1/organizations/{organizationId}/mailboxes
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "domainId": "dom_abc123",
  "localPart": "hello",
  "displayName": "Hello Mailbox",
  "storageQuota": 5368709120
}
```

**Requirements:**
- Domain must exist and be verified
- Local part must be unique within organization
- Local part format: alphanumeric, dots, hyphens, underscores, percent signs
- Requires Admin or Owner role

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "mbox_xyz789",
    "organizationId": "org_abc123",
    "domainId": "dom_abc123",
    "localPart": "hello",
    "displayName": "Hello Mailbox",
    "status": "active",
    "storageQuota": 5368709120,
    "storageUsed": 0,
    "unreadCount": 0,
    "createdAt": 1234567890,
    "updatedAt": 1234567890
  }
}
```

**Status Values:**
- `active`: Mailbox is operational
- `suspended`: Mailbox cannot receive emails (can be restored)
- `archived`: Mailbox is archived (permanent until deleted)

### List Mailboxes

Get all mailboxes in an organization.

**Endpoint:**
```
GET /v1/organizations/{organizationId}/mailboxes
Authorization: Bearer <token>
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 50, max: 100)
- `status` (optional): Filter by status (active, suspended, archived)

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "mbox_xyz789",
        "organizationId": "org_abc123",
        "domainId": "dom_abc123",
        "localPart": "hello",
        "displayName": "Hello Mailbox",
        "status": "active",
        "storageQuota": 5368709120,
        "storageUsed": 524288,
        "unreadCount": 3,
        "createdAt": 1234567890,
        "updatedAt": 1234567890
      }
    ],
    "total": 5,
    "page": 1,
    "pageSize": 50,
    "hasMore": false
  }
}
```

### Get Mailbox

Retrieve a specific mailbox.

**Endpoint:**
```
GET /v1/organizations/{organizationId}/mailboxes/{mailboxId}
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "mbox_xyz789",
    "organizationId": "org_abc123",
    "domainId": "dom_abc123",
    "localPart": "hello",
    "displayName": "Hello Mailbox",
    "status": "active",
    "storageQuota": 5368709120,
    "storageUsed": 524288,
    "unreadCount": 3,
    "createdAt": 1234567890,
    "updatedAt": 1234567890
  }
}
```

### Update Mailbox

Update mailbox settings.

**Endpoint:**
```
PATCH /v1/organizations/{organizationId}/mailboxes/{mailboxId}
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "displayName": "Sales Mailbox",
  "storageQuota": 10737418240,
  "status": "active"
}
```

**Updatable Fields:**
- `displayName`: Display name (255 chars max)
- `storageQuota`: Storage quota in bytes
- `status`: active, suspended, or archived

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "mbox_xyz789",
    "organizationId": "org_abc123",
    "domainId": "dom_abc123",
    "localPart": "hello",
    "displayName": "Sales Mailbox",
    "status": "active",
    "storageQuota": 10737418240,
    "storageUsed": 524288,
    "unreadCount": 3,
    "createdAt": 1234567890,
    "updatedAt": 1234567890
  }
}
```

### Delete Mailbox

Permanently delete a mailbox and all its emails.

**Endpoint:**
```
DELETE /v1/organizations/{organizationId}/mailboxes/{mailboxId}
Authorization: Bearer <token>
```

**Warning:** This action is irreversible.

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Mailbox deleted successfully"
  }
}
```

## Aliases

Aliases allow multiple email addresses to route to a single mailbox.

### Create Alias

Create an alias for a mailbox.

**Endpoint:**
```
POST /v1/organizations/{organizationId}/mailboxes/{mailboxId}/aliases
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "localPart": "support"
}
```

**Requirements:**
- Local part must be unique within organization
- Local part format: alphanumeric, dots, hyphens, underscores, percent signs

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "alias_abc123",
    "organizationId": "org_abc123",
    "mailboxId": "mbox_xyz789",
    "localPart": "support",
    "domainId": "dom_abc123",
    "createdAt": 1234567890
  }
}
```

### List Aliases

Get all aliases for a mailbox.

**Endpoint:**
```
GET /v1/organizations/{organizationId}/mailboxes/{mailboxId}/aliases
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "alias_abc123",
        "organizationId": "org_abc123",
        "mailboxId": "mbox_xyz789",
        "localPart": "support",
        "domainId": "dom_abc123",
        "createdAt": 1234567890
      },
      {
        "id": "alias_def456",
        "organizationId": "org_abc123",
        "mailboxId": "mbox_xyz789",
        "localPart": "contact",
        "domainId": "dom_abc123",
        "createdAt": 1234567891
      }
    ],
    "total": 2,
    "page": 1,
    "pageSize": 50,
    "hasMore": false
  }
}
```

### Delete Alias

Remove an alias.

**Endpoint:**
```
DELETE /v1/organizations/{organizationId}/mailboxes/{mailboxId}/aliases/{aliasId}
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Alias deleted successfully"
  }
}
```

## Best Practices

### Naming Conventions

Use descriptive local parts:
- ✅ `hello` - Clear purpose
- ✅ `support` - Function-based
- ✅ `sales-team` - Team-based
- ❌ `a1b2c3d4` - Cryptic
- ❌ `asdfasdf` - No meaning

### Storage Management

Monitor storage usage:

```javascript
const mailbox = await client.mailboxes.get(mailboxId);
const usagePercent = (mailbox.storageUsed / mailbox.storageQuota) * 100;

if (usagePercent > 80) {
  console.warn(`Mailbox ${mailbox.localPart} is 80% full`);
}
```

### Alias Strategy

Use aliases for:
- Department distribution: `sales@`, `support@`, `billing@`
- Legacy email addresses
- Short URLs: `hi@` instead of `hello@`
- User names: `john@`, `jane@`

### Security

- Limit mailbox access to team members who need it
- Archive old mailboxes instead of deleting
- Monitor for unusual activity (bounce patterns, etc.)

## Troubleshooting

### "Domain must be verified"

Domain must be verified before creating mailboxes:
1. Create domain
2. Add DNS records
3. Verify domain
4. Create mailboxes

### "Mailbox already exists"

Cannot create duplicate mailboxes:
- Check existing mailboxes: `GET /mailboxes`
- Use a different local part
- Or use an alias instead

### "Storage quota exceeded"

Mailbox has reached storage limit:
1. Delete old emails to free space
2. Increase storage quota (if plan allows)
3. Archive or move emails to external storage

### "Alias already exists"

Alias local part is already taken:
- Check existing aliases: `GET /mailboxes/{id}/aliases`
- Use a different alias name
- Or delete the conflicting alias

## Limits

| Resource | Limit |
|---|---|
| Mailboxes per organization | Plan-based (3-200) |
| Aliases per mailbox | Unlimited |
| Email addresses | Alphanumeric + special chars |
| Local part length | 64 characters max |
| Storage per mailbox | Plan-based (1-500 GB) |

## Recipient Routing

When an email arrives at `support@example.com`:

1. System checks mailboxes for direct match
2. If not found, checks aliases
3. Routes to matching mailbox
4. Stores email in DynamoDB
5. Updates unread count
6. Notifies mailbox owner

If no match found → Bounce with "User not found"

## Integration Example

```typescript
import { MailForge } from "@mailforge/sdk";

const client = new MailForge({ apiKey: process.env.MAILFORGE_API_KEY });

// Create mailbox
const mailbox = await client.mailboxes.create({
  domainId: "dom_abc123",
  localPart: "support",
  displayName: "Support Team"
});

// Create aliases
await client.mailboxes.createAlias(mailbox.id, {
  localPart: "help"
});

await client.mailboxes.createAlias(mailbox.id, {
  localPart: "info"
});

// List mailboxes
const mailboxes = await client.mailboxes.list({ organizationId: "org_abc123" });

// Get mailbox details
const details = await client.mailboxes.get(mailbox.id);
console.log(`${details.displayName}: ${details.storageUsed}/${details.storageQuota} bytes`);
```

## References

- [Domain Management](domain-management.md)
- [Email Operations](email-operations.md)
- [API Reference](api-reference.md)
