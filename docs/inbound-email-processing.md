# Inbound Email Processing

## Overview

MailForge processes inbound emails through a serverless pipeline:

```
1. Email arrives at SES
2. SES stores raw email in S3
3. SES publishes to SNS topic
4. SNS triggers SQS queue
5. Lambda processes from SQS
6. MIME parsing and validation
7. Store in DynamoDB
8. Publish webhook events
9. Notify users
```

## Architecture

### SES Receipt Rules

Incoming emails to verified domains trigger SES receipt rules:

1. **Store in S3**: Raw MIME message stored in `s3://mailforge-emails/{messageId}`
2. **Publish to SNS**: Event published to SNS topic
3. **Optional bounce/complaint handling**: Configured separately

### Processing Pipeline

```
SES Receipt Rule
       ↓
   S3 Storage
       ↓
   SNS Topic
       ↓
   SQS Queue
       ↓
   Lambda Function (inbound-processor)
       ↓
   ┌─────────────────────┐
   │  Parse MIME         │
   │  Validate Recipient │
   │  Store Metadata     │
   │  Store Attachments  │
   │  Update Mailbox     │
   │  Trigger Events     │
   └─────────────────────┘
       ↓
   DynamoDB
       ↓
   Webhook Events
```

## Processing Flow

### 1. Email Arrival

Email arrives at `anything@yourdomain.com`:

```
To: support@yourdomain.com
From: customer@example.com
Subject: Help needed
```

### 2. SES Receipt Rule

Receipt rule configuration (manual setup):

```
Rule Set: mailforge-prod
Recipients: yourdomain.com

Actions:
- Store in S3: s3://mailforge-prod-emails/
- Publish to SNS: arn:aws:sns:us-east-1:123456789:mailforge-prod-ses-events
```

### 3. MIME Parsing

Lambda function receives SQS message:

```typescript
{
  "mail": {
    "source": "customer@example.com",
    "destination": ["support@yourdomain.com"],
    "messageId": "0000014c-b7ab-4344-b96d-f69e1e8f2cd7",
    "timestamp": "2024-01-15T10:30:00Z"
  },
  "receipt": {
    "recipients": ["support@yourdomain.com"],
    "timestamp": "2024-01-15T10:30:01Z",
    "processingTimeMillis": 1500
  }
}
```

Processor:
1. Downloads raw email from S3
2. Parses MIME headers and body
3. Extracts attachments
4. Validates sender and recipients

### 4. Recipient Routing

System finds matching mailbox:

```
1. Query direct mailbox: localpart = "support"
2. If not found, check aliases
3. Route to mailbox or bounce if not found
```

### 5. Storage

Message stored in DynamoDB:

```json
{
  "mailboxId": "mbox_xyz789",
  "createdAt": 1705317000,
  "messageId": "0000014c-b7ab-4344-b96d-f69e1e8f2cd7",
  "organizationId": "org_abc123",
  "direction": "inbound",
  "status": "delivered",
  "from": "customer@example.com",
  "to": ["support@yourdomain.com"],
  "subject": "Help needed",
  "textBody": "...",
  "rawEmailS3Key": "emails/org_abc123/mbox_xyz789/messageId/message.eml",
  "attachments": [
    {
      "id": "att_123",
      "filename": "invoice.pdf",
      "mimeType": "application/pdf",
      "size": 102400,
      "s3Key": "attachments/org_abc123/mbox_xyz789/att_123"
    }
  ],
  "isRead": false,
  "receivedAt": 1705317000
}
```

### 6. Notifications

Events published via webhooks and real-time updates:

```json
{
  "type": "email.received",
  "organizationId": "org_abc123",
  "mailboxId": "mbox_xyz789",
  "messageId": "0000014c-b7ab-4344-b96d-f69e1e8f2cd7",
  "from": "customer@example.com",
  "subject": "Help needed",
  "timestamp": 1705317001
}
```

## Configuration

### SES Receipt Rules (Manual Setup)

1. Go to AWS SES Console
2. Select "Receipt Rule Sets"
3. Create or select a rule set
4. Add rule:

```
Recipients: yourdomain.com
Actions:
  - Store in S3
    Bucket: mailforge-prod-emails
    Object key prefix: (leave empty)
    SNS Topic: (optional, for bounce/complaint)
  
  - Publish to SNS
    SNS Topic: arn:aws:sns:region:account:mailforge-prod-ses-events
    Encoding: UTF-8 (default)
```

5. Enable the rule set

### Lambda Configuration

Environment variables (set by CDK):

```
ORGANIZATIONS_TABLE=mailforge-prod-organizations
DOMAINS_TABLE=mailforge-prod-domains
MAILBOXES_TABLE=mailforge-prod-mailboxes
MESSAGES_TABLE=mailforge-prod-messages
ATTACHMENTS_TABLE=mailforge-prod-attachments
EMAIL_BUCKET=mailforge-prod-emails
ATTACHMENTS_BUCKET=mailforge-prod-attachments
INBOUND_QUEUE_URL=https://sqs.region.amazonaws.com/account/mailforge-prod-inbound
WEBHOOK_QUEUE_URL=https://sqs.region.amazonaws.com/account/mailforge-prod-webhooks
```

## Processing Details

### Email Size Limits

- **SES maximum**: 40 MB
- **DynamoDB item**: 400 KB (stores metadata, not full email)
- **Text body storage**: 100 KB (in DynamoDB)
- **HTML body storage**: 500 KB (in DynamoDB)
- **Full MIME**: Stored in S3 with no limit

### Attachment Handling

1. **Parsing**: Extract from MIME message
2. **Validation**: Check MIME type and size
3. **Storage**: Upload to S3 `attachments/` prefix
4. **Metadata**: Store references in message record
5. **Cleanup**: Deleted with message or on expiration

**Supported operations:**
- Get download URL (presigned)
- Scan for malware (optional, future)
- Expire after 90 days

### Duplicate Prevention

Idempotent processing using `messageId`:

```typescript
const existing = await getMessageByMessageId(messageId);
if (existing) {
  console.log("Message already processed");
  return; // Skip duplicate
}
```

SES Message-ID is globally unique.

### Error Handling

**Retry Logic:**
- Failed processing → SQS invisible timeout (5 minutes)
- Message re-attempted up to 3 times
- After 3 failures → Dead Letter Queue
- DLQ retention: 14 days

**Common Errors:**

| Error | Cause | Action |
|---|---|---|
| Recipient not found | Mailbox doesn't exist | Bounce email |
| Storage quota exceeded | Mailbox full | Bounce email |
| Parsing failed | Malformed MIME | Send to DLQ |
| S3 upload failed | Storage error | Retry (SQS handles) |

### Performance

**Expected processing time:**
- Simple email: 100-500ms
- With attachments: 500ms-2s
- Large email (10MB+): 2-5s

**Throughput:**
- Lambda concurrency: 100 (configurable)
- Processes ~100-200 emails/second
- Auto-scales with incoming volume

## Recipient Resolution

### Direct Mailbox Match

```
To: support@example.com

Query: SELECT * FROM mailboxes 
WHERE organizationId = org_abc123 
AND localPart = 'support'
```

### Alias Resolution

```
To: help@example.com

No direct match found
Query: SELECT * FROM aliases 
WHERE localPart = 'help' 
AND domainId = dom_abc123

Result: Points to mailbox support@example.com
```

### Catch-All (Future)

```
To: unknown@example.com

No direct match or alias
Check domain catch-all setting
Route to catch-all mailbox or bounce
```

## Bounce Handling

**Hard bounces** (permanent delivery failure):

- Invalid recipient
- Domain doesn't accept mail
- Recipient blocked sender

**Action:** Send bounce notification to sender

**Soft bounces** (temporary):

- Mailbox full
- Server temporarily unavailable

**Action:** SES auto-retries for 1 day

## Rate Limits

**Per mailbox:**
- Maximum emails/day: Plan-dependent
- Storage quota: Plan-dependent

**Per domain:**
- Maximum emails/day: 100,000 (SES limit)

## Security

### Validation

1. **Sender validation**: RFC 5321 format
2. **Recipient validation**: Mailbox exists
3. **MIME validation**: Proper MIME structure
4. **Size validation**: Under limits
5. **Attachment validation**: Safe MIME types

### Privacy

- Raw emails encrypted with KMS
- Stored with organization isolation
- Cannot access across organization boundaries
- Audit logged

### Malware Protection (Future)

- Scan attachments with ClamAV
- Quarantine suspicious files
- Notify administrators

## Monitoring

### CloudWatch Metrics

```
mailforge/inbound-processor/
  - ProcessedEmails (count)
  - FailedProcessing (count)
  - ProcessingTime (duration)
  - AttachmentCount (average)
  - MessageSize (average)
```

### Logs

```
/aws/lambda/mailforge-prod-inbound-processor
```

**Log format:**

```
[timestamp] Processing email from=sender to=recipient messageId=id
[timestamp] Email processed successfully
[timestamp] Error: [reason]
```

## Troubleshooting

### Emails not arriving

**Check:**
1. Domain verified in SES
2. SES receipt rules configured
3. Mailbox exists
4. No storage quota exceeded
5. Lambda function executing

**Debug:**
```bash
# Check Lambda logs
aws logs tail /aws/lambda/mailforge-prod-inbound-processor --follow

# Check SQS queue depth
aws sqs get-queue-attributes --queue-url https://... --attribute-names All

# Check DLQ for failed messages
aws sqs receive-message --queue-url https://...dlq
```

### Emails in dead letter queue

**Reasons:**
- MIME parsing failed
- Database write failed
- Lambda timeout
- Recipient not found

**Resolution:**
1. Fix underlying issue
2. Replay messages from DLQ
3. Or delete if non-recoverable

### High latency

**Check:**
1. Lambda duration metrics
2. DynamoDB throttling
3. S3 upload performance
4. Network connectivity

## Limits and Quotas

| Item | Limit | Notes |
|---|---|---|
| Email size | 40 MB | SES limit |
| Attachments per email | 50 | Practical limit |
| Attachment size | 40 MB | Per attachment |
| Recipients per email | 100 | Practical limit |
| Processing timeout | 60 seconds | Lambda timeout |
| Message retention | 365 days | Configurable |
| Duplicate window | 7 days | Message-ID uniqueness |

## Cost Analysis

**Typical inbound email (1 KB):**

- SES receipt: Free
- S3 storage: $0.00001 (1 MB/year)
- Lambda: $0.0001 (200ms @ 512MB)
- DynamoDB: $0.00015 (write)
- SNS/SQS: ~$0

**Total per email:** ~$0.0003 (0.03¢)

**100,000 emails/month:** ~$30

## Best Practices

1. **Monitor queue depth**: Alert if > 1000 messages
2. **Set DLQ alarms**: Alert on DLQ messages
3. **Test with small domains**: Verify before full rollout
4. **Archive old emails**: Reduce active storage
5. **Monitor bounce rates**: Maintain sender reputation
6. **Clean up aliases**: Remove unused email addresses
7. **Regular backups**: Export important emails

## API Reference

### Query Messages

```
GET /v1/messages?mailboxId=mbox_xyz&page=1&limit=50
```

### Get Message

```
GET /v1/messages/{messageId}
```

### Download Attachment

```
GET /v1/attachments/{attachmentId}/download-url
```

### Mark as Read

```
POST /v1/messages/{messageId}/read
```

## References

- [AWS SES Developer Guide](https://docs.aws.amazon.com/ses/)
- [SES Receipt Rules](https://docs.aws.amazon.com/ses/latest/dg/receiving-email-receipt-rules.html)
- [RFC 5321 - SMTP](https://tools.ietf.org/html/rfc5321)
- [RFC 5322 - Internet Message Format](https://tools.ietf.org/html/rfc5322)
