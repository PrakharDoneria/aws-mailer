# Outbound Email Sending System

## Overview

The outbound email system enables organizations to send emails from verified mailboxes through AWS SES (Simple Email Service). The architecture uses a multi-stage pipeline with event tracking, quota enforcement, and webhook notifications.

## Architecture

```
REST API
   ↓
EmailService (validation, quota check, draft management)
   ↓
DynamoDB (message metadata stored as "queued")
   ↓
SQS (Outbound Queue)
   ↓
OutboundSender Lambda (MIME construction, SES send)
   ↓
AWS SES (actual email transmission)
   ↓
SNS (SES Configuration Set events)
   ↓
SES Event Processor Lambda (bounce/complaint/delivery)
   ↓
DynamoDB (message status updated)
   ↓
Webhooks (optional event notifications)
```

## Components

### 1. EmailService (apps/api/src/services/email-service.ts)

Core service for email management with the following methods:

#### sendEmail(organizationId, input)
Sends an email immediately.

**Parameters:**
- `organizationId`: Organization ID
- `input`: SendEmail object
  - `from`: Sender email address (must be verified mailbox)
  - `to`: Array of recipient emails (1-50)
  - `cc`: Optional CC recipients
  - `bcc`: Optional BCC recipients
  - `subject`: Email subject
  - `textBody`: Optional plain text body
  - `htmlBody`: Optional HTML body
  - `attachmentIds`: Optional attachment IDs
  - `idempotencyKey`: Optional key for idempotent requests

**Process:**
1. Check idempotency key (if provided)
2. Validate sender mailbox exists and belongs to org
3. Validate all recipient emails
4. Check organization's daily email quota
5. Create message record with "queued" status
6. Enqueue message to SQS
7. Return message object with 202 Accepted status

**Example:**
```typescript
const service = new EmailService();
const message = await service.sendEmail("org-123", {
  from: "hello@example.com",
  to: ["recipient@example.com"],
  subject: "Welcome",
  htmlBody: "<p>Hello!</p>",
});
```

#### createDraft(organizationId, input)
Creates a draft email for later sending.

**Parameters:**
- `organizationId`: Organization ID
- `input`: CreateDraft object
  - `mailboxId`: Mailbox ID (required)
  - `from`: Sender email (optional)
  - `to`: Recipient array (optional)
  - `cc`: CC recipients (optional)
  - `bcc`: BCC recipients (optional)
  - `subject`: Email subject (optional)
  - `textBody`: Plain text body (optional)
  - `htmlBody`: HTML body (optional)

**Process:**
1. Validate mailbox exists and belongs to org
2. Validate sender if provided
3. Validate recipients if provided
4. Create message record with "draft" status
5. Return draft message object

**Example:**
```typescript
const draft = await service.createDraft("org-123", {
  mailboxId: "mailbox-456",
  subject: "Draft Email",
});
```

#### updateDraft(organizationId, draftId, data)
Updates an existing draft.

**Parameters:**
- `organizationId`: Organization ID
- `draftId`: Draft message ID
- `data`: Partial CreateDraft object with fields to update

**Process:**
1. Get draft by ID
2. Verify ownership (organization match)
3. Verify message is a draft
4. Validate updated fields
5. Update draft in DynamoDB
6. Return updated draft

**Example:**
```typescript
const updated = await service.updateDraft("org-123", "draft-789", {
  subject: "Updated Subject",
  htmlBody: "<p>Updated content</p>",
});
```

#### sendDraft(organizationId, draftId)
Converts a draft to queued and sends it.

**Parameters:**
- `organizationId`: Organization ID
- `draftId`: Draft message ID

**Process:**
1. Get draft by ID
2. Verify ownership
3. Verify required fields (from, to, subject)
4. Check quota
5. Update status to "queued"
6. Enqueue to SQS
7. Return message object

**Example:**
```typescript
const message = await service.sendDraft("org-123", "draft-789");
```

#### getDrafts(organizationId, mailboxId, limit)
Lists all drafts for a mailbox.

**Parameters:**
- `organizationId`: Organization ID
- `mailboxId`: Mailbox ID
- `limit`: Max results (default 50)

**Returns:** Array of draft messages

#### deleteDraft(organizationId, draftId)
Deletes a draft.

**Parameters:**
- `organizationId`: Organization ID
- `draftId`: Draft message ID

**Process:**
1. Get draft by ID
2. Verify ownership
3. Verify is draft
4. Delete from DynamoDB

### 2. OutboundSender Lambda (apps/lambda/outbound-sender/src/index.ts)

Processes SQS messages and sends emails via SES.

**Trigger:** SQS events from OUTBOUND_QUEUE_URL
**Batch Size:** 5 messages
**Max Concurrency:** 5
**Timeout:** 30 seconds

**Process per message:**
1. Parse SQS message and extract Message object
2. Validate sender domain is verified
3. Prepare email with nodemailer
4. Send via SES with Configuration Set headers
5. Get SES messageId from response
6. Update message status to "sent" in DynamoDB
7. If error: increment retry count or fail

**Features:**
- Idempotent processing (uses Message-ID)
- Retry logic (max 3 retries, then to DLQ)
- Custom headers for tracking (X-MailForge-MessageId, X-MailForge-OrganizationId)
- Error logging with context
- CC/BCC support
- Both text and HTML body support

**Example SQS Message:**
```json
{
  "type": "email.send",
  "messageId": "msg-123",
  "organizationId": "org-123",
  "data": {
    "id": "msg-123",
    "from": "hello@example.com",
    "to": ["recipient@example.com"],
    "subject": "Hello",
    "htmlBody": "<p>Welcome</p>",
    "mailboxId": "mailbox-456",
    "createdAt": 1699999999,
    "status": "queued"
  }
}
```

### 3. SES Event Processor Lambda (apps/lambda/ses-event-processor/src/index.ts)

Processes bounce, complaint, delivery, send, and reject events from SES Configuration Set.

**Trigger:** SNS events from SES eventTopic
**Timeout:** 30 seconds
**Memory:** 512 MB

**Supported Events:**
- **bounce**: Permanent or temporary bounce
  - Updates message status to "bounced" (permanent) or "failed" (temporary)
  - Publishes webhook event with bounce details
- **complaint**: Email marked as spam by recipient
  - Updates message status to "complained"
  - Publishes webhook event with complaint details
- **delivery**: Email successfully delivered
  - Updates message status to "delivered"
  - Publishes webhook event with delivery details
- **send**: Email successfully sent by SES
  - Informational (message already "sent")
  - Publishes webhook event
- **reject**: Email rejected by SES
  - Updates message status to "rejected"
  - Publishes webhook event with rejection reason

**Event Flow:**
1. SNS invokes Lambda with SES event
2. Extract messageId from SES mail object
3. Extract MailForge headers (X-MailForge-MessageId, X-MailForge-OrganizationId)
4. Query DynamoDB to find mailbox ID and message
5. Update message status in DynamoDB
6. Publish webhook event to SQS for webhook delivery
7. Return success

**Example SNS Message:**
```json
{
  "eventType": "Delivery",
  "mail": {
    "messageId": "ses-msg-123",
    "timestamp": "2024-11-12T10:30:00.000Z",
    "headers": [
      {
        "name": "X-MailForge-MessageId",
        "value": "mf-msg-123"
      },
      {
        "name": "X-MailForge-OrganizationId",
        "value": "org-123"
      }
    ]
  },
  "delivery": {
    "recipients": ["recipient@example.com"],
    "timestamp": "2024-11-12T10:30:05.000Z",
    "processingTimeMillis": 5000,
    "smtpResponse": "250 2.0.0 OK"
  }
}
```

## API Endpoints

### Send Email
```http
POST /v1/messages/send
Authorization: Bearer <token>
Content-Type: application/json

{
  "from": "hello@example.com",
  "to": ["recipient@example.com"],
  "cc": ["cc@example.com"],
  "bcc": ["bcc@example.com"],
  "subject": "Hello World",
  "textBody": "Plain text version",
  "htmlBody": "<p>HTML version</p>",
  "attachmentIds": ["att-123"],
  "idempotencyKey": "req-12345"
}
```

**Response:** 202 Accepted
```json
{
  "success": true,
  "data": {
    "id": "msg-123",
    "organizationId": "org-123",
    "mailboxId": "mailbox-456",
    "status": "queued",
    "from": "hello@example.com",
    "to": ["recipient@example.com"],
    "subject": "Hello World",
    "createdAt": 1699999999,
    "updatedAt": 1699999999
  }
}
```

**Status Codes:**
- `202`: Email queued successfully
- `400`: Invalid input (bad email, missing fields, etc.)
- `401`: Unauthorized
- `403`: Forbidden (mailbox not in your org)
- `429`: Quota exceeded (daily limit reached)
- `500`: Internal server error

### Create Draft
```http
POST /v1/messages/drafts
Authorization: Bearer <token>
Content-Type: application/json

{
  "mailboxId": "mailbox-456",
  "from": "hello@example.com",
  "to": ["recipient@example.com"],
  "subject": "Draft Title",
  "htmlBody": "<p>Draft content</p>"
}
```

**Response:** 201 Created
```json
{
  "success": true,
  "data": {
    "id": "msg-123",
    "organizationId": "org-123",
    "mailboxId": "mailbox-456",
    "status": "draft",
    "from": "hello@example.com",
    "to": ["recipient@example.com"],
    "subject": "Draft Title",
    "createdAt": 1699999999,
    "updatedAt": 1699999999
  }
}
```

### List Drafts
```http
GET /v1/messages/drafts?limit=50
Authorization: Bearer <token>
```

**Query Parameters:**
- `limit`: Max results (default 50, max 100)

**Response:** 200 OK
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "msg-123",
        "status": "draft",
        "subject": "Draft Title",
        ...
      }
    ],
    "total": 1
  }
}
```

### Update Draft
```http
PATCH /v1/messages/drafts/{draftId}
Authorization: Bearer <token>
Content-Type: application/json

{
  "subject": "Updated Title",
  "htmlBody": "<p>Updated content</p>"
}
```

**Response:** 200 OK
```json
{
  "success": true,
  "data": {
    "id": "msg-123",
    "status": "draft",
    "subject": "Updated Title",
    ...
  }
}
```

### Send Draft
```http
POST /v1/messages/drafts/{draftId}/send
Authorization: Bearer <token>
```

**Response:** 202 Accepted
```json
{
  "success": true,
  "data": {
    "id": "msg-123",
    "status": "queued",
    "from": "hello@example.com",
    "to": ["recipient@example.com"],
    ...
  }
}
```

### Delete Draft
```http
DELETE /v1/messages/drafts/{draftId}
Authorization: Bearer <token>
```

**Response:** 204 No Content

## Message Lifecycle

### Outbound Email States

```
queued → sending → sent → delivered
       ↘                 ↗ (Success)
         → bounced (Permanent bounce)
         → failed (Temporary bounce)
         → complained (Spam report)
         → rejected (SES rejected)
```

**State Descriptions:**
- **queued**: Message is in SQS, waiting to be sent
- **sending**: Message is being processed by OutboundSender Lambda
- **sent**: Message successfully sent by SES (from SES:Send event)
- **delivered**: Message delivered to recipient (from SES:Delivery event)
- **bounced**: Message permanently bounced (from SES:Bounce event, Permanent)
- **failed**: Message temporarily failed (from SES:Bounce event, Temporary)
- **complained**: Recipient marked as spam (from SES:Complaint event)
- **rejected**: SES rejected the message (from SES:Reject event)

### Draft States

```
draft → queued → sending → sent → delivered
     ↘                       (Success)
       → Failed states (same as outbound)
```

## Quota Management

### Plan Limits

```typescript
// Free plan
emailsPerDay: 100

// Pro plan
emailsPerDay: 10000

// Business plan
emailsPerDay: 100000
```

### Quota Checking

- Checked at send time (not draft time)
- Daily reset at UTC midnight
- Tracked per organization
- Returned with `429 Too Many Requests` if exceeded

### Quota Monitoring

Track usage in DynamoDB:
```typescript
// Key: `${organizationId}-${YYYY-MM-DD}`
// Value: email count incremented
```

## Error Handling

### Validation Errors
- **400 Bad Request**: Invalid email format, missing fields, etc.
- **403 Forbidden**: Mailbox doesn't belong to organization
- **404 Not Found**: Message/draft doesn't exist

### Rate Limiting
- **429 Too Many Requests**: Daily quota exceeded

### SES Integration
- **Bounces**: Handled by SES Event Processor
  - Permanent bounces update status to "bounced"
  - Temporary bounces update status to "failed" with retry
- **Complaints**: Email marked as spam (suppression list update)
- **Rejects**: SES policy rejection (invalid domain, etc.)

### Retry Logic

**OutboundSender Lambda:**
- Max 3 retries (configurable)
- Retries trigger automatically via SQS visibility timeout
- After max retries, message moved to DLQ
- SES Event Processor updates status to "failed"

## Idempotency

Send emails idempotently by providing `idempotencyKey`:

```typescript
const response1 = await emailService.sendEmail("org-123", {
  from: "hello@example.com",
  to: ["recipient@example.com"],
  subject: "Hello",
  idempotencyKey: "req-12345",
});

// Same request - returns same message
const response2 = await emailService.sendEmail("org-123", {
  from: "hello@example.com",
  to: ["recipient@example.com"],
  subject: "Hello",
  idempotencyKey: "req-12345",
});

// response1.id === response2.id
```

**How it works:**
1. Key stored in memory map on Lambda container
2. Expires after 24 hours
3. If duplicate request, returns cached messageId
4. Prevents duplicate emails if client retries

## Webhooks

Send email events trigger webhooks if registered.

**Event Types:**
- `email.sent`: Email sent successfully
- `email.delivered`: Email delivered to recipient
- `email.bounced`: Permanent bounce
- `email.complained`: Marked as spam
- `email.failed`: Temporary failure

**Webhook Payload:**
```json
{
  "type": "email.delivered",
  "messageId": "msg-123",
  "organizationId": "org-123",
  "timestamp": 1699999999,
  "details": {
    "recipients": ["recipient@example.com"],
    "processingTimeMs": 5000,
    "smtpResponse": "250 2.0.0 OK"
  }
}
```

See [webhooks documentation](./webhooks.md) for full details.

## Configuration

### Environment Variables

**API Lambdas:**
- `OUTBOUND_QUEUE_URL`: SQS queue URL for outbound emails
- `MESSAGES_TABLE`: DynamoDB messages table

**OutboundSender Lambda:**
- `MESSAGES_TABLE`: DynamoDB messages table
- `CONFIGURATION_SET`: SES Configuration Set name

**SES Event Processor Lambda:**
- `MESSAGES_TABLE`: DynamoDB messages table
- `WEBHOOK_QUEUE_URL`: SQS queue URL for webhook events

### SES Configuration

1. **Verify sender domain**
   - Domain must be verified in SES
   - See [domain management](./domain-management.md)

2. **Configuration Set**
   - Automatically created by EmailStack CDK
   - Enables event tracking (bounce, complaint, delivery)
   - SNS topic configured for events

3. **SES Sending Quota**
   - Default: 50,000 emails/24 hours
   - Request limit increase in SES console
   - Rate: Up to 14 emails/second

## Performance

### Latency
- **API Response**: <200ms (message queued to DynamoDB)
- **SES Send**: 5-30 seconds (from Lambda to SES)
- **End-to-end**: <60 seconds typical
- **Event Processing**: 1-5 seconds (SNS → Lambda → DynamoDB)

### Throughput
- **API**: 100-1000 emails/second (depends on Lambda concurrency)
- **Sending**: 50-200 emails/second (limited by SES rate)
- **Event Processing**: 100-500 events/second

### Scaling
- API Lambdas: Auto-scales to 1000 concurrent
- OutboundSender: Reserved 50 concurrent (adjustable)
- SES Event Processor: Unlimited concurrent
- DynamoDB: On-demand (unlimited)
- SQS: Unlimited queue depth

## Monitoring

### CloudWatch Logs

**OutboundSender logs:**
```
Log Group: /mailforge/{env}/outbound-sender
- "Processing message": Email being sent
- "Email sent successfully": SES confirmed send
- "Failed to send email": Error details
- "Message status updated": DynamoDB update confirmed
```

**SES Event Processor logs:**
```
Log Group: /mailforge/{env}/ses-event-processor
- "Processing SES event": Event received from SNS
- "Processing bounce/complaint/delivery": Event type
- "Message status updated": Status updated in DynamoDB
- "Webhook event published": Event sent to webhook queue
```

### CloudWatch Metrics

Monitor via CloudWatch Dashboard:
- `OutboundQueue`: Approximate number of messages
- `MessageSent`: Lambda invocation count
- `MessageFailed`: Lambda errors
- `SESEventProcessed`: Event processor invocations
- `DynamoDB`: Read/write capacity units

### Alerts

Set alarms for:
- DLQ has messages (send failures)
- OutboundQueue depth > 1000 (backlog)
- Lambda error rate > 5%
- SES bounce rate > 5%

## Troubleshooting

### Email Not Sending
1. Check message status in DynamoDB
2. Verify sender domain is verified in SES
3. Check OutboundQueue for backlog
4. Review OutboundSender Lambda logs
5. Verify SES sending quota not exceeded

### Emails Going to Spam
1. Verify SPF/DKIM/DMARC records configured
2. Check complaint rate in SES console
3. Monitor bounce rates
4. Review email content (spam triggers)

### High Latency
1. Check SQS queue depth
2. Monitor Lambda concurrent executions
3. Review CloudWatch Lambda duration
4. Check DynamoDB throttling

### Webhook Events Not Received
1. Verify webhook URL configured
2. Check webhook deliveries in DynamoDB
3. Review SES Event Processor logs
4. Verify HMAC signature if using authentication

## Best Practices

1. **Always verify domains** before sending
2. **Use templates** for consistent formatting
3. **Set idempotency keys** for important requests
4. **Monitor bounces and complaints** closely
5. **Implement proper error handling** in consuming apps
6. **Use drafts** for complex email composition
7. **Test with sandbox** before production send
8. **Implement rate limiting** in consuming apps
9. **Monitor quota usage** daily
10. **Set up CloudWatch alarms** for errors

## Limits

- Max recipients per email: 50
- Max attachment size: 40 MB
- Max total message size: 25 MB
- Max daily emails: Plan-dependent (100-100,000)
- Max email subject: 255 characters
- Max from address: 254 characters
- SES send rate: 14 emails/second (can increase)
- SQS message retention: 14 days default

## Cost

Typical costs per 100k emails:
- SES: $10 (0.10 per 1000)
- Lambda (send): $3-5 (0.0000002 per invocation)
- Lambda (events): $0.50 (0.0000002 per invocation)
- DynamoDB: $1-2 (on-demand)
- SQS: <$0.10 (0.40 per million requests)
- **Total: ~$14-17 per 100k emails**

See [AWS pricing](https://aws.amazon.com/ses/pricing/) for current rates.
