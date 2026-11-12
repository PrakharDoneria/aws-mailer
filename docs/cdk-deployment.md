# CDK Deployment Guide

## Infrastructure Overview

The MailForge infrastructure is defined using AWS CDK with TypeScript. It consists of multiple stacks that work together to create a complete serverless email platform.

## Stacks

### 1. Authentication Stack
- **Cognito User Pool**: User authentication and management
- **Cognito User Pool Client**: OAuth2 client configuration
- **MFA Support**: Optional multi-factor authentication

### 2. Database Stack
- **DynamoDB Tables**: All application data
  - Organizations
  - Users
  - Memberships
  - Domains
  - Mailboxes
  - Messages (with multiple GSIs for access patterns)
  - Attachments
  - API Keys
  - Webhooks
  - Webhook Deliveries

### 3. Storage Stack
- **Email Bucket**: Raw MIME email storage (90-day retention)
- **Attachments Bucket**: File storage (1-year retention)
- **Frontend Bucket**: Next.js static assets
- **KMS Encryption**: All buckets encrypted with customer-managed keys

### 4. Queue Stack
- **Inbound Queue**: Email processing
- **Outbound Queue**: Email sending
- **Webhook Queue**: Webhook delivery
- **Dead Letter Queues**: Failed message handling
- **KMS Encryption**: All queues encrypted

### 5. Email Stack
- **SES Configuration Set**: Delivery tracking
- **SNS Topic**: Event routing for SES events
- **IAM Role**: SES permissions

### 6. API Stack
- **REST API Gateway**: RESTful API endpoints
- **Cognito Authorizer**: JWT authorization
- **Lambda Functions**: ~20 handler functions
- **CloudWatch Logging**: Request/response logging
- **CORS Configuration**: Cross-origin support

### 7. Email Processing Stack
- **Inbound Processor**: MIME parsing and storage
- **Outbound Sender**: Email sending via SES
- **Webhook Dispatcher**: Webhook delivery with retries

### 8. Frontend Stack
- **S3 Bucket**: Static website hosting
- **CloudFront Distribution**: CDN with caching
- **SSL/TLS**: Automatic HTTPS

### 9. Monitoring Stack
- **CloudWatch Log Groups**: Centralized logging
- **CloudWatch Dashboard**: Performance metrics
- **Alarms**: Configured for critical errors

## Prerequisites

### AWS Account Requirements
- AWS Account with sufficient permissions
- US-East-1 region (or other region with SES support)
- Budget alerts configured

### Local Requirements
- Node.js 18+
- AWS CLI v2
- Git

### AWS Permissions

Create an IAM user with these permissions or use root account for development:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cloudformation:*",
        "s3:*",
        "dynamodb:*",
        "lambda:*",
        "apigateway:*",
        "cognito:*",
        "sqs:*",
        "sns:*",
        "ses:*",
        "cloudwatch:*",
        "logs:*",
        "iam:*",
        "kms:*",
        "ec2:DescribeSecurityGroups",
        "ec2:DescribeSubnets",
        "ec2:DescribeVpcs",
        "ec2:DescribeNetworkInterfaces"
      ],
      "Resource": "*"
    }
  ]
}
```

## Deployment Steps

### 1. Clone Repository

```bash
git clone <repository-url>
cd mailforge
```

### 2. Install Dependencies

```bash
npm install
npm run build
npm run type-check
```

### 3. Configure AWS Credentials

```bash
aws configure
```

Enter your AWS Access Key ID, Secret Access Key, region (us-east-1 recommended), and output format (json).

### 4. Bootstrap CDK

Required once per AWS account/region:

```bash
npm run cdk:bootstrap
```

This creates an S3 bucket and IAM roles for CDK deployments.

### 5. Deploy Stack

**Development:**
```bash
npm run cdk:deploy:dev
```

**Production:**
```bash
npm run cdk:deploy:prod
```

The deployment will:
1. Synthesize the CDK stack to CloudFormation
2. Show the resources to be created
3. Ask for confirmation
4. Deploy all resources
5. Output stack exports

### 6. Verify Deployment

```bash
aws cloudformation describe-stacks --stack-name mailforge-dev
```

## Post-Deployment Configuration

### 1. Save Stack Outputs

The deployment outputs critical values:

```
UserPoolId: us-east-1_ABC123xyz
UserPoolClientId: 456def789ghi
ApiEndpoint: https://abc123.execute-api.us-east-1.amazonaws.com/dev/
WebsiteUrl: https://d12345.cloudfront.net
EmailBucket: mailforge-dev-emails-123456789
```

### 2. Configure SES

#### Verify Email Address (Sandbox Mode)

```bash
aws ses verify-email-identity \
  --email-address your-email@example.com \
  --region us-east-1
```

#### Configure Receipt Rules

1. Go to AWS SES console
2. Select "Receipt Rule Sets"
3. Create a new rule set
4. Add a rule:
   - **Recipients**: your-domain.com
   - **Actions**:
     - Store in S3: `mailforge-dev-emails-123456789`
     - Publish to SNS: SES event topic
5. Enable the rule set

#### Request Production Access

1. Go to "Account Dashboard" in SES console
2. Check if still in sandbox
3. Request production access
4. AWS typically approves within 24 hours

### 3. Configure Frontend Environment

Create `.env.local` in `apps/web/`:

```env
NEXT_PUBLIC_API_URL=https://abc123.execute-api.us-east-1.amazonaws.com/dev/
NEXT_PUBLIC_USER_POOL_ID=us-east-1_ABC123xyz
NEXT_PUBLIC_USER_POOL_CLIENT_ID=456def789ghi
NEXT_PUBLIC_REGION=us-east-1
```

### 4. Deploy Frontend

```bash
cd apps/web
npm run build

# Sync to S3
aws s3 sync out/ s3://mailforge-dev-frontend-123456789 --delete

# Invalidate CloudFront
aws cloudfront create-invalidation \
  --distribution-id D123456ABC \
  --paths "/*"
```

## Monitoring

### View Logs

CloudWatch Logs are organized by function:

```bash
# API logs
aws logs tail /mailforge/dev/api --follow

# Lambda logs
aws logs tail /mailforge/dev/lambda --follow

# Inbound processor
aws logs tail /mailforge/dev/inbound-processor --follow

# Outbound sender
aws logs tail /mailforge/dev/outbound-sender --follow
```

### CloudWatch Dashboard

```bash
# Open in browser
open https://console.aws.amazon.com/cloudwatch/home#dashboards:name=mailforge-dev
```

### Check SQS Queues

```bash
# Get queue attributes
aws sqs get-queue-attributes \
  --queue-url https://sqs.us-east-1.amazonaws.com/123456789/mailforge-dev-inbound \
  --attribute-names All
```

### Check DynamoDB

```bash
# Scan table for items
aws dynamodb scan \
  --table-name mailforge-dev-organizations \
  --region us-east-1

# Get item count
aws dynamodb describe-table \
  --table-name mailforge-dev-organizations \
  --query 'Table.ItemCount'
```

## Cost Optimization

### Development Recommendations

- Use on-demand DynamoDB billing (automatic scaling)
- Delete unused SES verified identities
- Clean up S3 buckets regularly
- Set up CloudWatch alarms for cost anomalies

### Estimated Monthly Costs (Small Deployment)

- Lambda: $5-15
- DynamoDB on-demand: $5-25
- SES: $0.10 per 1000 emails
- S3: $1-5
- Data transfer: $0-5
- CloudFront: $0-10

**Total**: $11-60/month for small deployments

## Updating Infrastructure

### Make Changes

Edit stack files in `infrastructure/lib/stacks/`:

```typescript
// Example: Increase Lambda memory
memorySize: 1024 // was 512
```

### Redeploy

```bash
npm run cdk:deploy:dev
```

CDK will show a diff of changes before applying.

### Rollback

If deployment fails, CloudFormation automatically rolls back. To manually rollback:

```bash
aws cloudformation cancel-update-stack --stack-name mailforge-dev
```

## Removing Infrastructure

**Warning: This deletes all resources**

```bash
npm run cdk:destroy
```

Choose "yes" when prompted to delete.

## Environment-Specific Configuration

### Development

- Shorter log retention (1 week)
- Lower Lambda concurrency limits
- Relaxed rate limiting
- CloudWatch detailed monitoring

### Production

- Longer log retention (1 month)
- Higher Lambda concurrency
- Strict rate limiting
- X-Ray tracing enabled

Toggle with context variable:

```bash
npm run cdk:deploy:prod -- -c environment=prod
```

## Troubleshooting

### CDK Bootstrap Fails

```bash
# Clear cache
rm -rf cdk.out node_modules/.cache

# Try again
npm run cdk:bootstrap
```

### Lambda Timeout

Increase timeout in `email-processing-stack.ts`:

```typescript
timeout: cdk.Duration.seconds(60)
```

### DynamoDB Throttling

Switch to provisioned capacity:

```typescript
billingMode: dynamodb.BillingMode.PROVISIONED,
readCapacity: 10,
writeCapacity: 10
```

### SES Sandbox Limitation

Can only send to verified addresses:

```bash
aws ses verify-email-identity --email-address test@example.com
```

### CloudFormation Stack Rollback

Check events for errors:

```bash
aws cloudformation describe-stack-events \
  --stack-name mailforge-dev \
  --query 'StackEvents[?ResourceStatus==`CREATE_FAILED`]'
```

## References

- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [CloudFormation User Guide](https://docs.aws.amazon.com/cloudformation/)
- [AWS Lambda Developer Guide](https://docs.aws.amazon.com/lambda/)
- [Amazon DynamoDB Developer Guide](https://docs.aws.amazon.com/dynamodb/)
