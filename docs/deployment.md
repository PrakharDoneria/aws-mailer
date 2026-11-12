# MailForge Deployment Guide

## Prerequisites

- AWS Account with appropriate permissions
- Node.js 18+
- AWS CLI v2 configured
- Terraform/CDK experience recommended

## AWS Account Setup

1. Create a new AWS account (recommended for isolation)
2. Enable SES in your region (us-east-1 recommended)
3. Request production SES access if sending >200 emails/day
4. Create an IAM user for deployment with appropriate permissions

## Initial Setup

### 1. Clone and Install

```bash
git clone <repo-url> mailforge
cd mailforge
npm install
```

### 2. Configure AWS Credentials

```bash
aws configure
# Enter your AWS Access Key ID
# Enter your AWS Secret Access Key
# Enter default region (us-east-1 recommended for SES)
# Enter default output format (json)
```

### 3. Bootstrap CDK

This step prepares your AWS account for CDK deployments (one-time per account/region):

```bash
npm run cdk:bootstrap
```

## Deployment

### Development Environment

```bash
npm run cdk:deploy:dev
```

This will:
1. Synthesize the CDK stack
2. Display the changes to be made
3. Ask for confirmation
4. Deploy the infrastructure

### Production Environment

```bash
npm run cdk:deploy:prod
```

Same as above but for production settings.

## Post-Deployment

After deployment, you'll receive outputs:

```
✓ MailForgeStack-dev.UserPoolId = us-east-1_ABC123xyz
✓ MailForgeStack-dev.UserPoolClientId = 456def789ghi
✓ MailForgeStack-dev.ApiEndpoint = https://abc123.execute-api.us-east-1.amazonaws.com/dev/
✓ MailForgeStack-dev.WebsiteUrl = https://d12345.cloudfront.net
✓ MailForgeStack-dev.EmailBucket = mailforge-dev-emails-123456789
```

Save these values for reference.

## Environment Configuration

Create `.env.local` in the web app:

```env
NEXT_PUBLIC_API_URL=https://abc123.execute-api.us-east-1.amazonaws.com/dev/
NEXT_PUBLIC_USER_POOL_ID=us-east-1_ABC123xyz
NEXT_PUBLIC_USER_POOL_CLIENT_ID=456def789ghi
```

## SES Configuration

### Verify Email Address (Development)

```bash
aws ses verify-email-identity --email-address your-email@example.com --region us-east-1
```

### Configure SES Receipt Rules

1. Go to AWS SES console
2. Create receipt rule set
3. Create rule with:
   - Recipients: your-domain.com
   - Action: Store in S3 (select mailforge bucket)
   - Action: Publish to SNS (optional for email notifications)

### Request Production Access

In SES console:
1. Go to "Account dashboard"
2. Check if still in sandbox mode
3. If yes, request production access
4. AWS typically approves within 24 hours

## Deploy Frontend

```bash
# Build Next.js
cd apps/web
npm run build

# Deploy to S3
aws s3 sync out/ s3://mailforge-dev-frontend-123456789 --delete

# Invalidate CloudFront
aws cloudfront create-invalidation --distribution-id D123456 --paths "/*"
```

## Deploy Backend

```bash
# Build Lambda code
cd apps/api
npm run build

# CDK automatically packages Lambda functions
npm run cdk:deploy:dev
```

## Monitoring

View logs:

```bash
npm run cdk:logs
```

View dashboard:

```bash
# Go to CloudWatch in AWS console
# Dashboard name: mailforge-dev
```

## Database Backups

DynamoDB point-in-time recovery is enabled:

```bash
# Restore from backup
aws dynamodb restore-table-to-point-in-time \
  --source-table-name mailforge-dev-organizations \
  --target-table-name mailforge-dev-organizations-restored \
  --restore-date-time 2024-01-01T12:00:00.000Z
```

## Cleanup

To remove all infrastructure:

```bash
npm run cdk:destroy
```

`cdk destroy` preserves resources configured with a retention policy. To delete
the complete deployed environment, including retained buckets, tables, logs,
queues, Cognito, and the KMS key deletion schedule, run:

```bash
./scripts/delete-cloudshell.sh dev
```

Use `--yes` as the second argument for non-interactive deletion.

## Troubleshooting

### CDK Bootstrap Fails

```bash
# Clear CDK cache
rm -rf cdk.out node_modules/.cache

# Try bootstrap again
npm run cdk:bootstrap
```

### Lambda Timeout

Increase timeout in infrastructure/lib/stacks/api-stack.ts:

```typescript
timeout: cdk.Duration.seconds(60)
```

### SES Sandbox Limitation

Email can only be sent to verified addresses. Verify in SES console:

```bash
aws ses verify-email-identity --email-address recipient@example.com
```

### DynamoDB Provisioning

We use on-demand billing, but you can switch to provisioned:

```typescript
billingMode: dynamodb.BillingMode.PROVISIONED,
readCapacity: 5,
writeCapacity: 5
```

## Cost Estimation

Typical small deployment (~1000 users):
- Lambda: ~$5-10/month
- DynamoDB on-demand: ~$5-20/month
- SES: ~$0.10 per 1000 emails
- S3: ~$1-5/month
- Data transfer: ~$0-5/month

**Total**: ~$11-50/month for small deployments
