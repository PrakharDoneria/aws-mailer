# MailForge Quick Start Guide

Deploy a complete serverless email platform on AWS with a single command.

## Prerequisites

Before running the deployment script, ensure you have:

1. **AWS Account** - [Create one here](https://aws.amazon.com)
2. **AWS CLI** - [Install from here](https://aws.amazon.com/cli/)
   ```bash
   # Verify installation
   aws --version
   ```
3. **Node.js 18+** - [Download from here](https://nodejs.org/)
   ```bash
   # Verify installation
   node --version
   npm --version
   ```
4. **AWS Credentials** - Configure AWS CLI
   ```bash
   aws configure
   # You'll be prompted for:
   # - AWS Access Key ID
   # - AWS Secret Access Key
   # - Default region: us-east-1 (recommended for SES)
   # - Default output format: json
   ```

## One-Command Deployment

For AWS CloudShell, use the cache-busting command below so the latest script is
downloaded:

```bash
bash <(curl -fsSL "https://raw.githubusercontent.com/PrakharDoneria/aws-mailer/main/scripts/deploy-cloudshell.sh?v=2026-11-12") prod
```

For an existing environment, patch in place after the script prints its
resource inventory:

```bash
bash <(curl -fsSL "https://raw.githubusercontent.com/PrakharDoneria/aws-mailer/main/scripts/patch-cloudshell.sh?v=2026-11-12") prod
```

### For Windows (PowerShell):

```powershell
# Clone repository
git clone https://github.com/prakhardoneria/aws-mailer.git
cd aws-mailer

# Run deployment script
.\scripts\deploy.ps1 -Environment dev
```

### For macOS/Linux (Bash):

```bash
# Clone repository
git clone https://github.com/prakhardoneria/aws-mailer.git
cd aws-mailer

# Make script executable
chmod +x scripts/deploy.sh

# Run deployment script
./scripts/deploy.sh --environment dev
```

## What the Script Does

The deployment script automatically:

1. ✅ **Checks Prerequisites**
   - Verifies Node.js, npm, AWS CLI installed
   - Validates AWS credentials
   - Checks for Docker (optional)

2. ✅ **Sets Up Environment**
   - Creates `.env.dev` or `.env.prod` file
   - Configures environment variables

3. ✅ **Installs Dependencies**
   - Installs npm packages for all workspaces
   - Sets up dev tools and build systems

4. ✅ **Builds Project**
   - Compiles TypeScript
   - Bundles frontend (Next.js)
   - Prepares Lambda functions

5. ✅ **Deploys Infrastructure**
   - Bootstraps AWS CDK (first time only)
   - Creates AWS resources:
     - Cognito User Pool (Authentication)
     - DynamoDB Tables (Data)
     - S3 Buckets (Storage)
     - SQS Queues (Messaging)
     - SES Configuration (Email)
     - Lambda Functions (Processing)
     - API Gateway (REST API)
     - CloudFront (CDN)

6. ✅ **Verifies Deployment**
   - Checks API health
   - Confirms all services running

## After Deployment

### Access MailForge

1. **Web Interface**: Use the CloudFront URL printed by `deploy-cloudshell.sh`
2. **API Endpoint**: Use the API URL printed by `deploy-cloudshell.sh`
3. **AWS Console**: https://console.aws.amazon.com

### First Steps

1. **Sign Up**
   - Go to http://localhost:3000
   - Click "Get Started" or "Sign Up"
   - Create your account

2. **Create Organization**
   - Sign in to dashboard
   - Click "New Organization"
   - Name your organization

3. **Add Domain**
   - Go to organization settings
   - Add your custom domain
   - Copy DNS records to your domain provider
   - Wait for verification (up to 24 hours)

4. **Create Mailbox**
   - Once domain verified
   - Create email address (e.g., hello@yourdomain.com)
   - Start sending/receiving emails

### Configuration

Update `.env.dev` (or `.env.prod`) with your settings:

```bash
# API Configuration
API_PORT=3001
API_LOG_LEVEL=info

# Frontend Configuration
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_ENVIRONMENT=dev

# AWS Configuration (set automatically by CDK)
AWS_REGION=us-east-1
```

## Troubleshooting

### AWS Credentials Error

```bash
# Solution: Configure AWS credentials
aws configure
```

### npm Install Fails

```bash
# Solution: Clear npm cache and retry
npm cache clean --force
npm install
```

### Port Already in Use

```bash
# Find and kill process using port 3000 or 3001
# macOS/Linux:
lsof -i :3000
kill -9 <PID>

# Windows:
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### Deployment Fails

```bash
# Check CDK logs
cd infrastructure
npm run logs

# For full reset:
# Windows:
.\scripts\deploy.ps1 -Environment dev

# macOS/Linux:
./scripts/deploy.sh --environment dev
```

### SES Sandbox Limitations

AWS SES starts in sandbox mode. To send emails to external addresses:

1. Go to AWS SES Console
2. Request production access
3. Provide use case details
4. Wait for AWS review (usually 24 hours)

### Stuck on "Waiting for API"

The API may take time to start on first deployment:

```bash
# Option 1: Start local dev server
npm run dev

# Option 2: Check CloudWatch logs
aws logs tail /aws/lambda/mailforge-dev-SendEmail --follow
```

## Development

### Start Local Dev Server

```bash
npm run dev
```

This starts:
- Frontend: http://localhost:3000
- API: http://localhost:3001
- Hot reload enabled

### Stop All Services

```bash
# Press Ctrl+C in terminal
```

### View Logs

```bash
# View last 100 lines of logs
npm run logs

# Stream logs live
aws logs tail /aws/lambda/mailforge-dev-SendEmail --follow
```

### Run Tests

```bash
# Run all tests
npm run test

# Run specific test
npm run test -- apps/api
```

### Type Check

```bash
npm run type-check
```

### Linting

```bash
npm run lint
```

## Production Deployment

### Deploy to Production

```bash
# Windows:
.\scripts\deploy.ps1 -Environment prod

# macOS/Linux:
./scripts/deploy.sh --environment prod
```

### Production Checklist

- [ ] Domain verified in SES
- [ ] SES production access requested and approved
- [ ] DKIM/SPF/DMARC records configured
- [ ] SSL certificate configured
- [ ] Monitoring and alerts set up
- [ ] Backup strategy implemented
- [ ] Security audit completed

See [SECURITY.md](./SECURITY.md) for production security guidelines.

## Full Reset

To completely delete and restart:

```bash
# Windows:
./scripts/delete-cloudshell.sh dev

# macOS/Linux:
./scripts/delete-cloudshell.sh dev
```

**Warning**: This will delete all AWS resources and local data!

## Cost Estimation

Typical monthly costs for small deployment:

| Service | Cost/Month | Usage |
|---------|-----------|-------|
| Lambda | $5-15 | 1M function calls |
| DynamoDB | $5-25 | On-demand, <1GB |
| SES | $0.10 | 100,000 emails |
| S3 | $1-5 | <10GB storage |
| Data Transfer | $0-5 | US region |
| **Total** | **$11-50** | Small instance |

See [docs/cost-analysis.md](./docs/cost-analysis.md) for detailed breakdown.

## Documentation

- [Architecture Overview](./docs/architecture.md)
- [API Reference](./docs/api-reference.md)
- [Domain Management](./docs/domain-management.md)
- [Deployment Guide](./docs/cdk-deployment.md)
- [Security Guidelines](./SECURITY.md)
- [Troubleshooting](./docs/troubleshooting.md)

## Support

### Common Issues

1. **Can't receive emails**
   - Verify domain ownership
   - Check MX records are correct
   - Verify mailbox exists

2. **Can't send emails**
   - Check sender domain is verified
   - Verify sender mailbox exists
   - Check SES quota

3. **High latency**
   - Check CloudWatch metrics
   - Monitor Lambda duration
   - Check DynamoDB capacity

### Get Help

- Check [FAQ](./docs/faq.md)
- Review [troubleshooting guide](./docs/troubleshooting.md)
- Open [GitHub issue](https://github.com/prakhardoneria/aws-mailer/issues)

## Next Steps

1. **Configure Custom Domain**
   - Add domain to organization
   - Add DNS records
   - Wait for verification

2. **Create API Key**
   - Generate API key in settings
   - Use for programmatic access

3. **Integrate with Your App**
   - Use REST API
   - Use TypeScript SDK
   - Use webhooks for events

4. **Scale to Production**
   - Request SES production access
   - Deploy to prod environment
   - Set up monitoring

## License

MIT License - See [LICENSE](./LICENSE) for details

## Contributing

Contributions welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md)

---

**Happy Emailing! 📧**

For detailed documentation and API reference, see [docs/](./docs/)
