# MailForge Development Guide

## Project Structure

```
mailforge/
├── apps/
│   ├── web/                    # Next.js webmail application
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── pages/
│   │   │   ├── lib/
│   │   │   └── styles/
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── api/                    # Lambda API handlers
│       ├── src/
│       │   ├── handlers/
│       │   ├── services/
│       │   ├── repositories/
│       │   └── utils/
│       ├── package.json
│       └── tsconfig.json
├── packages/
│   ├── shared/                 # Shared types and constants
│   ├── sdk/                    # Public TypeScript SDK
│   ├── validation/             # Zod schemas
│   └── email-parser/           # MIME parsing utilities
├── infrastructure/             # AWS CDK
│   ├── bin/
│   ├── lib/
│   │   └── stacks/
│   └── package.json
├── docs/                       # Documentation
├── scripts/                    # Utility scripts
└── tests/                      # Integration tests
```

## Development Workflow

### 1. Install Dependencies

```bash
npm install
npm run build
npm run type-check
```

### 2. Development Servers

Start frontend (Next.js):
```bash
cd apps/web
npm run dev
```

Start API locally with mocked AWS services:
```bash
cd apps/api
npm run dev
```

### 3. Run Tests

```bash
npm run test
```

Test specific package:
```bash
cd packages/shared
npm run test
```

### 4. Linting

```bash
npm run lint
```

### 5. Type Checking

```bash
npm run type-check
```

## Code Organization

### Shared Package (`packages/shared`)

Contains:
- **types.ts**: All TypeScript interfaces and types
- **constants.ts**: Configuration constants
- **utils.ts**: Utility functions

Used by: API, web, SDK, validation packages

### Validation Package (`packages/validation`)

Contains Zod schemas for:
- API request validation
- Form validation
- Type inference

```typescript
import { CreateMailboxSchema } from "@mailforge/validation";

const input = CreateMailboxSchema.parse(req.body);
```

### Email Parser Package (`packages/email-parser`)

Handles MIME email parsing:

```typescript
import { parseMimeEmail } from "@mailforge/email-parser";

const parsed = await parseMimeEmail(emailBuffer);
```

### API Layer (`apps/api`)

Lambda handlers organized by domain:

```
src/
├── handlers/
│   ├── organizations/
│   ├── domains/
│   ├── mailboxes/
│   ├── messages/
│   └── webhooks/
├── services/
│   ├── organization-service.ts
│   ├── domain-service.ts
│   ├── mailbox-service.ts
│   └── message-service.ts
├── repositories/
│   ├── organization-repository.ts
│   ├── domain-repository.ts
│   └── ...
└── utils/
    ├── auth.ts
    ├── error-handling.ts
    ├── response.ts
    └── validators.ts
```

### Web Layer (`apps/web`)

Next.js structure:

```
src/
├── components/
│   ├── layout/
│   ├── inbox/
│   ├── composer/
│   └── common/
├── pages/
│   ├── auth/
│   ├── dashboard/
│   ├── inbox/
│   └── api/
├── lib/
│   ├── api-client.ts
│   ├── auth.ts
│   └── hooks/
└── styles/
    └── globals.css
```

## Adding a New Feature

### Example: Add Mailbox Suspension

#### 1. Update Types

In `packages/shared/src/types.ts`:

```typescript
export interface Mailbox {
  // ... existing fields
  status: "active" | "suspended" | "archived"; // Updated
}
```

#### 2. Add Validation Schema

In `packages/validation/src/schemas.ts`:

```typescript
export const SuspendMailboxSchema = z.object({
  mailboxId: z.string().min(1),
  reason: z.string().optional(),
});
```

#### 3. Create Repository Method

In `apps/api/src/repositories/mailbox-repository.ts`:

```typescript
async suspendMailbox(mailboxId: string): Promise<void> {
  await this.table.update({
    Key: { id: mailboxId },
    UpdateExpression: "SET #status = :status, updatedAt = :now",
    ExpressionAttributeNames: { "#status": "status" },
    ExpressionAttributeValues: {
      ":status": "suspended",
      ":now": getCurrentTimestamp(),
    },
  });
}
```

#### 4. Create Service Method

In `apps/api/src/services/mailbox-service.ts`:

```typescript
async suspendMailbox(
  organizationId: string,
  mailboxId: string
): Promise<void> {
  // Verify authorization
  await this.verifyMailboxOwnership(organizationId, mailboxId);

  // Perform action
  await this.repository.suspendMailbox(mailboxId);

  // Emit event
  await this.eventBus.emit("mailbox.suspended", { mailboxId });
}
```

#### 5. Create Handler

In `apps/api/src/handlers/mailboxes/suspend.ts`:

```typescript
export const handler = withErrorHandling(
  withAuth(async (event, context, { organizationId, userId }) => {
    const { mailboxId } = event.pathParameters;
    const service = new MailboxService();

    await service.suspendMailbox(organizationId, mailboxId);

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true }),
    };
  })
);
```

#### 6. Wire Up API Route

In `infrastructure/lib/stacks/api-stack.ts`:

```typescript
const mailboxesResource = rootResource.addResource("mailboxes");
const mailboxIdResource = mailboxesResource.addResource("{id}");
const suspendResource = mailboxIdResource.addResource("suspend");

suspendResource.addMethod("POST", this.createLambdaIntegration("suspend-mailbox"), {
  authorizer,
});
```

#### 7. Add SDK Method

In `packages/sdk/src/mailboxes.ts`:

```typescript
async suspend(mailboxId: string): Promise<void> {
  await this.client.post(`/mailboxes/${mailboxId}/suspend`);
}
```

#### 8. Add Web UI

In `apps/web/src/components/inbox/mailbox-settings.tsx`:

```typescript
const handleSuspend = async () => {
  await client.mailboxes.suspend(mailboxId);
  toast.success("Mailbox suspended");
};
```

## Testing Strategy

### Unit Tests

Test individual functions/services:

```typescript
// services/mailbox-service.test.ts
import { MailboxService } from "./mailbox-service";

describe("MailboxService", () => {
  it("should suspend mailbox", async () => {
    const service = new MailboxService();
    await service.suspendMailbox("org-123", "mbox-456");
    // assertions
  });
});
```

### Integration Tests

Test API endpoints with mocked AWS services:

```typescript
// handlers/mailboxes/suspend.test.ts
import { handler } from "./suspend";

describe("POST /mailboxes/:id/suspend", () => {
  it("should return 200", async () => {
    const event = {
      pathParameters: { id: "mbox-456" },
    };
    const response = await handler(event);
    expect(response.statusCode).toBe(200);
  });
});
```

### E2E Tests

Test full workflows in staging environment.

## Database Queries

### Query Organizations by Owner

```typescript
const result = await table.query({
  IndexName: "owner-index",
  KeyConditionExpression: "ownerId = :ownerId",
  ExpressionAttributeValues: {
    ":ownerId": userId,
  },
});
```

### Query Mailboxes in Organization

```typescript
const result = await table.query({
  IndexName: "org-mailbox-index",
  KeyConditionExpression: "organizationId = :orgId",
  ExpressionAttributeValues: {
    ":orgId": organizationId,
  },
});
```

### Query Messages in Mailbox (Paginated)

```typescript
const result = await table.query({
  KeyConditionExpression: "mailboxId = :mailboxId",
  ScanIndexForward: false, // Most recent first
  Limit: 50,
  ExpressionAttributeValues: {
    ":mailboxId": mailboxId,
  },
});
```

## Error Handling

Always use custom error class:

```typescript
import { MailForgeError, ErrorCodes } from "@mailforge/shared";

throw new MailForgeError(
  ErrorCodes.NOT_FOUND,
  "Mailbox not found",
  404
);
```

Wrap handlers with error middleware:

```typescript
import { withErrorHandling } from "./utils/error-handling";

export const handler = withErrorHandling(async (event) => {
  // handler code
});
```

## Authentication

All API endpoints require authorization except public routes:

```typescript
export const handler = withAuth(async (event, context, { organizationId, userId, role }) => {
  // organizationId, userId, and role are injected by withAuth
  // Verify role has required permissions
  if (role !== "owner" && role !== "admin") {
    throw new MailForgeError(ErrorCodes.FORBIDDEN, "Insufficient permissions", 403);
  }
});
```

## Deployment

### Local Development

```bash
npm run dev
```

### Staging

```bash
npm run cdk:deploy:dev
```

### Production

```bash
npm run cdk:deploy:prod
```

## Environment Variables

### Lambda Functions

Set in `infrastructure/lib/stacks/api-stack.ts`:

```typescript
environment: {
  DYNAMODB_TABLE_ORGANIZATIONS: "mailforge-prod-organizations",
  DYNAMODB_TABLE_MAILBOXES: "mailforge-prod-mailboxes",
  SQS_INBOUND_QUEUE_URL: "...",
},
```

### Web Application

Set in `.env.local`:

```env
NEXT_PUBLIC_API_URL=https://api.example.com
NEXT_PUBLIC_USER_POOL_ID=...
```

## Debugging

### Local Lambda Debugging

Use SAM CLI:

```bash
sam local start-api
```

### CloudWatch Logs

```bash
# View Lambda logs
aws logs tail /aws/lambda/mailforge-prod-* --follow

# View API logs
aws logs tail /mailforge/prod/api --follow
```

### X-Ray Tracing

X-Ray is configured in API Gateway. View traces in AWS console:

```
CloudWatch > X-Ray > Service Map
```

## Performance Optimization

### DynamoDB

- Use GSI for common query patterns
- Avoid full table scans
- Use pagination for large result sets
- Consider caching frequently accessed data

### Lambda

- Keep cold start time low (<1s)
- Use layers for shared dependencies
- Optimize bundle size with tree-shaking

### S3

- Use CloudFront for static assets
- Enable compression
- Use versioning for rollback
- Implement lifecycle policies

## Security Checklist

- [ ] Validate all user input
- [ ] Enforce tenant isolation in queries
- [ ] Use presigned URLs for S3 access
- [ ] Hash API keys before storage
- [ ] Implement rate limiting
- [ ] Use HTTPS everywhere
- [ ] Encrypt data at rest and in transit
- [ ] Regular security audits
- [ ] Keep dependencies updated

## Common Tasks

### Add a New Table

1. Add table definition to `DatabaseStack`
2. Create repository class
3. Create service class
4. Add handlers using the service

### Add a New Event Type

1. Define event in shared types
2. Emit event from service
3. Create handler in Lambda
4. Add to webhook event types

### Add an API Endpoint

1. Create handler function
2. Create service method
3. Add route in API Gateway stack
4. Document in OpenAPI spec

## Resources

- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [Next.js Documentation](https://nextjs.org/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [DynamoDB Best Practices](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html)
