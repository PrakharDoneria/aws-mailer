# AWS CloudShell One-Click Deployment

Deploy MailForge with a single command from AWS CloudShell - no local setup required!

## Quick Start (30 seconds)

### Option 1: Direct URL (Easiest)

1. **Open AWS CloudShell**
   - Go to https://console.aws.amazon.com/cloudshell
   - Or click CloudShell icon in AWS Console

2. **Run One Command**
   ```bash
   bash <(curl -fsSL "https://raw.githubusercontent.com/PrakharDoneria/aws-mailer/main/scripts/deploy-cloudshell.sh?v=2026-11-12") prod
   ```

3. **Wait for completion** (~15 minutes)

4. **Access your platform** via links provided

### Option 2: Clone Then Deploy

1. **Open AWS CloudShell**

2. **Clone and Deploy**
   ```bash
   git clone https://github.com/prakhardoneria/aws-mailer.git
   cd aws-mailer
   chmod +x scripts/deploy-cloudshell.sh
   ./scripts/deploy-cloudshell.sh dev
   ```

3. **Follow prompts** and wait for completion

## What This Deploys

Everything is automatically created in your AWS account:

| Component | What | Why |
|-----------|------|-----|
| **Cognito** | User authentication | Secure login |
| **DynamoDB** | Multi-tenant database | Serverless, scalable |
| **S3** | Email & attachment storage | Unlimited storage |
| **SES** | Email sending/receiving | AWS-native email |
| **Lambda** | Serverless processing | Pay-per-use compute |
| **API Gateway** | REST API endpoint | Managed API service |
| **SQS** | Message queuing | Reliable delivery |
| **CloudFront** | CDN for frontend | Global distribution |
| **CloudWatch** | Logging & monitoring | Observability |

## After Deployment

### 1. Access Your Platform

The script will display URLs for:
- **Web Interface** - User dashboard and webmail
- **REST API** - Backend API endpoint
- **AWS CloudFormation** - All resources created

### 2. Configure Email Domain (Required)

To start sending/receiving emails:

1. **Go to AWS SES Console**
   ```
   https://console.aws.amazon.com/ses
   ```

2. **Verify your domain**
   - Add domain to SES
   - Add DNS records (SES will provide)
   - Wait for verification (up to 24 hours)

3. **Request Production Access** (Important!)
   - SES sandbox limits sending
   - Request production access in SES console
   - AWS approves within 24 hours

### 3. Create Organization & Mailbox

In the MailForge web interface:

1. **Sign up** for account
2. **Create organization**
3. **Add your domain** (verified in SES)
4. **Create mailbox** (e.g., hello@yourdomain.com)
5. **Start sending emails!**

## Command Line Options

```bash
# Deploy to development environment
./scripts/deploy-cloudshell.sh dev

# Deploy to production environment
./scripts/deploy-cloudshell.sh prod

# Patch an existing environment after code or infrastructure updates.
# This inspects the existing stack first and never runs a delete/destroy command.
bash <(curl -fsSL "https://raw.githubusercontent.com/PrakharDoneria/aws-mailer/main/scripts/patch-cloudshell.sh?v=2026-11-12") prod

# Skip auto-cleanup on error
./scripts/deploy-cloudshell.sh dev false
```

## What CloudShell Provides

AWS CloudShell includes everything needed:

- ✅ AWS CLI (pre-configured with your credentials)
- ✅ Node.js 18+ (for building)
- ✅ npm (for package management)
- ✅ git (for cloning repos)
- ✅ curl (for downloading files)
- ✅ jq (for JSON processing)
- ✅ 1 GB storage
- ✅ Linux bash shell

**No installation needed!**

## Deployment Steps (What Happens)

1. **Validate** AWS credentials and environment
2. **Clone** repository (if needed)
3. **Install** npm dependencies
4. **Build** TypeScript and Next.js
5. **Bootstrap** CDK (first-time setup)
6. **Deploy** AWS infrastructure (10-15 min)
7. **Build and publish** the static frontend to S3
8. **Invalidate** CloudFront and display the frontend/API URLs

## Monitoring Deployment

### During Deployment

The script shows real-time progress:
- ✅ checks and validations
- ⏳ installation progress
- 🔨 build status
- ☁️ infrastructure deployment steps

### After Deployment

Check deployed resources:

```bash
# View CloudFormation stack
aws cloudformation describe-stacks --stack-name mailforge-dev

# List Lambda functions
aws lambda list-functions --query 'Functions[?contains(FunctionName, `mailforge`)].{Name:FunctionName,Runtime:Runtime}'

# View DynamoDB tables
aws dynamodb list-tables --query 'TableNames[?contains(@, `mailforge`)]'

# View S3 buckets
aws s3 ls --query 'Buckets[?contains(Name, `mailforge`)]'
```

## Troubleshooting

### CloudShell says "ENOSPC" or "no space left on device"

CloudShell has limited persistent storage. The deployment script cleans its
incomplete `node_modules` install and npm cache before retrying, and performs
the disposable checkout/build in `/tmp` instead of persistent home storage.
If an earlier attempt filled the home directory, remove that incomplete
checkout and retry:

```bash
rm -rf ~/aws-mailer
npm cache clean --force
bash <(curl -fsSL "https://raw.githubusercontent.com/PrakharDoneria/aws-mailer/main/scripts/deploy-cloudshell.sh?v=2026-11-12") prod
```

### Stack is missing or resources are in another region

The deploy and patch scripts use `CDK_DEFAULT_REGION` first, then
`AWS_REGION`, then the AWS CLI profile region. This keeps CloudFormation,
CloudFront, S3, and CDK pointed at the same region. To target an existing
deployment explicitly, set the region before running the patch:

```bash
export CDK_DEFAULT_REGION=ap-south-1
bash <(curl -fsSL "https://raw.githubusercontent.com/PrakharDoneria/aws-mailer/main/scripts/patch-cloudshell.sh?v=2026-11-12") prod
```

### Common Issues

**"AWS credentials not configured"**
- CloudShell uses your current AWS credentials
- Ensure you're logged into AWS Console
- Try refreshing the page and reopening CloudShell

**"Insufficient IAM permissions"**
- Your IAM user needs permissions for:
  - Cognito, DynamoDB, S3, SES, Lambda, API Gateway
  - CloudFormation (for CDK)
- Request admin access or specific permissions

**"Deployment timeout"**
- CloudShell has 12-hour idle timeout
- Keep the window open or re-run the script
- It will continue from where it left off

**"Port conflicts"**
- CloudShell runs in AWS account, not locally
- No local port conflicts possible

### Debug Mode

Get verbose output:

```bash
# Enable bash debugging
bash -x scripts/deploy-cloudshell.sh dev

# View CloudFormation events
aws cloudformation describe-stack-events --stack-name mailforge-dev

# Tail Lambda logs
aws logs tail /aws/lambda/mailforge-dev-SendEmail --follow
```

## Costs

### Deployment Costs
- **Free tier eligible** - Usually no cost for initial deployment
- **Minimal initial costs** - ~$0-5 for deployment

### Running Costs
- **Lambda**: $0.20 per 1M requests (~$1-5/month)
- **DynamoDB**: $1.25 per GB-month ($5-10/month for small usage)
- **SES**: $0.10 per 1000 emails ($0-1/month for testing)
- **S3**: $0.023 per GB/month ($1-5/month for storage)
- **Total**: ~$10-30/month for small deployment

**Always review AWS Cost Explorer to monitor spending**

## Security

### IAM Permissions Used

The deployment creates:
- 1 IAM role for Lambda (least privilege)
- Policy allows access to:
  - DynamoDB tables (read/write)
  - S3 buckets (read/write)
  - SQS queues (send/receive)
  - CloudWatch logs (write)
  - SES (send email)

### Data Protection

- ✅ Encryption at rest (KMS)
- ✅ Encryption in transit (HTTPS/TLS)
- ✅ API authentication (JWT + Cognito)
- ✅ Multi-tenant isolation
- ✅ DynamoDB point-in-time recovery

## Management

### View Resources

**In AWS Console:**
1. CloudFormation → Stacks → `mailforge-dev`
2. See all created resources under "Resources" tab

### Update Stack

```bash
# Redeploy with changes
cd infrastructure
npm run deploy:dev
```

### Delete Everything

```bash
# WARNING: This deletes all resources
cd infrastructure
./scripts/delete-cloudshell.sh dev

# Or via AWS Console
# CloudFormation → Stacks → mailforge-dev → Delete
```

## Next Steps

### 1. Configure Custom Domain
- Add domain to SES
- Configure mailboxes
- Start sending emails

### 2. Set Up Monitoring
- Enable CloudWatch alarms
- Set up SNS notifications
- Monitor costs

### 3. Scale to Production
- Request SES production access
- Deploy to prod environment
- Set up auto-scaling

### 4. Integrate with Apps
- Use REST API
- Use TypeScript SDK
- Set up webhooks

## Support Resources

- **QUICK_START.md** - Quick start guide
- **README.md** - Full project documentation
- **docs/architecture.md** - System design
- **docs/api-reference.md** - API endpoints
- **docs/** - Complete documentation

## Comparison: Deployment Methods

| Method | Time | Effort | Local Setup |
|--------|------|--------|------------|
| **CloudShell** | 15 min | 1 command | ❌ None |
| **PowerShell** | 15 min | 1 command | ✅ Required |
| **Bash** | 15 min | 1 command | ✅ Required |
| **Manual** | 1+ hour | Multiple steps | ✅ Required |

**CloudShell is the easiest for first-time users!**

## CloudShell Limitations

- ⏱️ 12-hour idle timeout (session closes if unused)
- 💾 1 GB persistent storage (separate from session)
- 🔒 No external internet access for development servers
- 📊 Limited to viewing logs (no streaming to external services)

These don't affect MailForge since everything runs in AWS.

## Advanced: Custom Configuration

### Custom Domain Prefix

The CloudShell script auto-generates resource names. To customize:

```bash
# Clone repo
git clone https://github.com/prakhardoneria/aws-mailer.git
cd aws-mailer

# Edit infrastructure/lib/main.ts and change stack names

# Then deploy
./scripts/deploy-cloudshell.sh dev
```

### Custom Environment Variables

Edit `.env.dev` after cloning:

```bash
# Configure before deployment
vim .env.dev

# Then run deployment
./scripts/deploy-cloudshell.sh dev
```

## One-Liner Commands

### Just Update Frontend

```bash
cd aws-mailer && npm run build && npm run cdk:deploy:dev -- --only frontend
```

### View Logs in Real Time

```bash
aws logs tail /aws/lambda/mailforge-dev-SendEmail --follow
```

### Delete Everything

```bash
./scripts/delete-cloudshell.sh dev
```

## FAQ

**Q: Will this cost me money?**
A: Minimal - usually free tier covers it. Monitor AWS Cost Explorer.

**Q: Can I use my own domain immediately?**
A: No, must verify in SES first (up to 24 hours). Testing works immediately.

**Q: What if deployment fails?**
A: Script automatically cleans up. Fix the issue and re-run.

**Q: Can I scale to production?**
A: Yes, same stack supports both. Just re-deploy with `prod` environment.

**Q: How do I monitor my emails?**
A: CloudWatch logs, SES console, and MailForge dashboard all show activity.

**Q: Is my data encrypted?**
A: Yes, encryption enabled at rest (KMS) and in transit (TLS).

---

**Ready to deploy?** Open AWS CloudShell and run:
```bash
bash <(curl -s https://raw.githubusercontent.com/prakhardoneria/aws-mailer/main/scripts/deploy-cloudshell.sh)
```

🚀 **Your MailForge platform will be ready in 15 minutes!**
