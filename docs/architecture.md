# MailForge Architecture

## Overview

MailForge is a serverless, multi-tenant email hosting platform built entirely on AWS managed services. The architecture follows a distributed, event-driven design pattern.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     End Users                               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────┐       ┌──────────────────────┐   │
│  │  Web Browser         │       │  API Clients (SDK)   │   │
│  └──────────┬───────────┘       └──────────┬───────────┘   │
│             │                              │                │
│             └──────────────┬───────────────┘                │
│                            │                                │
│                      CloudFront + CDN                       │
│                            │                                │
│  ┌─────────────────────────▼────────────────────────────┐  │
│  │        S3 Frontend + Next.js App                     │  │
│  └─────────────────────────┬────────────────────────────┘  │
│                            │                                │
│  ┌─────────────────────────▼────────────────────────────┐  │
│  │   API Gateway + Lambda (REST API)                    │  │
│  │   - Authentication (Cognito)                         │  │
│  │   - Route handlers                                   │  │
│  │   - Rate limiting                                    │  │
│  └──┬────────────────────────────────────────────┬──────┘  │
│     │                                             │          │
│     │    ┌────────────────────────┐             │          │
│     │    │ DynamoDB             │             │          │
│     │    │ - Organizations       │             │          │
│     │    │ - Users               │             │          │
│     │    │ - Domains             │             │          │
│     │    │ - Mailboxes           │             │          │
│     │    │ - Messages (metadata) │             │          │
│     │    │ - API Keys            │             │          │
│     │    │ - Webhooks            │             │          │
│     │    └────────────────────────┘             │          │
│     │                                             │          │
│     └──────────┬──────────────────────┬──────────┘          │
│                │                      │                     │
│   ┌────────────▼───────────┐ ┌────────▼──────────────┐     │
│   │  S3 Buckets            │ │  SQS Queues          │     │
│   │  - Email Storage       │ │  - Inbound Queue     │     │
│   │  - Attachments         │ │  - Outbound Queue    │     │
│   │  - Temp Uploads        │ │  - Webhook Queue     │     │
│   └────────────────────────┘ │  - DLQs              │     │
│                                │                      │     │
│                                └────────┬────────────┘     │
│                                         │                  │
│   ┌──────────────────────────────────────▼────────────┐   │
│   │  Lambda Functions                                 │   │
│   │  - Inbound Email Parser                          │   │
│   │  - Outbound Email Sender                         │   │
│   │  - Webhook Dispatcher                            │   │
│   │  - Event Processors                              │   │
│   └──────────────────────────────────────────────────┘   │
│                     │                                      │
│     ┌───────────────┼───────────────┐                     │
│     │               │               │                     │
│     ▼               ▼               ▼                     │
│ ┌────────┐   ┌──────────────┐   ┌──────────┐            │
│ │SES     │   │EventBridge   │   │SNS       │            │
│ │- Send  │   │- Events      │   │- Alerts  │            │
│ │- Recv  │   │- Triggers    │   │- Notif.  │            │
│ └────────┘   └──────────────┘   └──────────┘            │
└─────────────────────────────────────────────────────────────┘
```

## Key AWS Services

### Compute
- **AWS Lambda**: Stateless application logic, event handlers, API endpoints
- **API Gateway**: REST API endpoints with authorization

### Storage
- **DynamoDB**: Primary database for all application data
- **S3**: Raw email storage, attachments, frontend hosting
- **KMS**: Encryption key management

### Email
- **Amazon SES**: Email send/receive, DKIM, SPF configuration

### Messaging
- **SQS**: Asynchronous job queues (inbound, outbound, webhooks)
- **SNS**: Event notifications
- **EventBridge**: Event routing and processing

### Authentication & Security
- **Cognito**: User authentication, JWT tokens
- **IAM**: Least-privilege access control
- **Secrets Manager**: Sensitive configuration storage

### Monitoring
- **CloudWatch**: Logs, metrics, alarms
- **X-Ray**: Distributed tracing

## Data Flow Patterns

### Inbound Email Flow

```
1. Incoming email arrives at SES
2. SES receipt rule stores raw email in S3
3. S3 event triggers Lambda
4. Lambda parses MIME and enqueues to SQS
5. SQS worker Lambda processes:
   - Parse email headers and body
   - Identify recipient organization/mailbox
   - Store metadata in DynamoDB
   - Extract attachments to S3
   - Update unread counts
   - Trigger webhooks
   - Notify users via WebSocket/polling
```

### Outbound Email Flow

```
1. User submits email via API/webmail
2. Lambda validates and stores as draft in DynamoDB
3. User sends email
4. Lambda validates sender, checks quotas
5. Email enqueued to SQS
6. SQS worker Lambda:
   - Downloads attachments from S3
   - Constructs MIME message
   - Sends via SES
   - Stores SES MessageId
7. SES sends events to SNS/EventBridge
8. Lambda processes:
   - Bounce events
   - Delivery confirmations
   - Updates message status
```

### Webhook Delivery Flow

```
1. Email event occurs (sent, delivered, bounced, etc.)
2. Lambda publishes to EventBridge
3. EventBridge rule enqueues to SQS
4. SQS worker Lambda:
   - Retrieves webhook configuration
   - Constructs HMAC signature
   - Sends POST to webhook URL
   - Stores delivery record
   - Implements exponential backoff retry
```

## Multi-Tenancy Architecture

Every database operation enforces **organization-level isolation**:

- All tables contain `organizationId` partition key or GSI
- Lambda functions validate user belongs to organization
- No cross-organization data access is possible
- Queries always filter by `organizationId`

## Security Model

- **Authentication**: Cognito JWT tokens
- **Authorization**: Role-based access control (Owner, Admin, Developer, Member, Viewer)
- **Data Encryption**: KMS encryption at rest, TLS in transit
- **API Authentication**: API key hashing with SHA256
- **Webhook Signing**: HMAC-SHA256 signatures

## Scalability Characteristics

- **On-demand DynamoDB**: Automatically scales with traffic
- **Lambda**: Automatic scaling to handle load
- **SQS**: Unlimited queuing capacity
- **S3**: Unlimited storage
- **SES**: Production account quotas apply (default 50k/day)

## Limitations

- IMAP/POP3 not supported (application-level mailboxes only)
- SES production access required for >200 emails/day
- Regional limitations (SES available in specific regions)
- Real-time WebSocket connections optional (polling fallback available)

## Deployment Model

Each MailForge deployment is a CDK stack deployed to a customer AWS account:

- Complete infrastructure isolation
- Customer owns AWS account and billing
- Multi-environment support (dev, staging, prod)
- Infrastructure as Code for reproducibility
