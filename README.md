# MailForge - Serverless Email Hosting Platform

[![AWS CloudShell](https://img.shields.io/badge/AWS-CloudShell-FF9900?logo=amazon-aws)](./CLOUDSHELL_DEPLOYMENT.md)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178c6?logo=typescript)](https://www.typescriptlang.org/)
[![AWS CDK](https://img.shields.io/badge/AWS-CDK-FF9900?logo=amazon-aws)](https://aws.amazon.com/cdk/)
[![License](https://img.shields.io/badge/License-MIT-blue)](LICENSE)

**Production-ready, multi-tenant email hosting platform on AWS. Deploy in 15 minutes with a single command.**

## 🚀 Quick Start

### Easiest: AWS CloudShell (No Setup Required)

Open AWS CloudShell and run:

```bash
bash <(curl -s https://raw.githubusercontent.com/prakhardoneria/aws-mailer/main/scripts/deploy-cloudshell.sh)
```

**No local installation needed!** CloudShell has everything pre-installed.

👉 [Full CloudShell Guide](./CLOUDSHELL_DEPLOYMENT.md)

---

## Deploy Locally

### macOS/Linux

```bash
git clone https://github.com/prakhardoneria/aws-mailer.git
cd aws-mailer
chmod +x scripts/deploy.sh
./scripts/deploy.sh --environment dev
```

### Windows PowerShell

```powershell
git clone https://github.com/prakhardoneria/aws-mailer.git
cd aws-mailer
.\scripts\deploy.ps1 -Environment dev
```

---

## 📋 Deployment Options

| Method | Time | Effort | Setup | Best For |
|--------|------|--------|-------|----------|
| **AWS CloudShell** | 15 min | 1 command | ❌ None | First-time users, non-technical |
| **macOS/Linux** | 15 min | 1 command | ✅ Node.js required | Mac/Linux users |
| **Windows PowerShell** | 15 min | 1 command | ✅ Node.js required | Windows users |
| **Manual CDK** | 30+ min | Multiple commands | ✅ Full setup | Advanced users |

### Prerequisites by Method

**CloudShell:**
- AWS Account
- AWS Console access
- ✅ Everything else included

**Local Deployment (All):**
- Node.js 18+
- npm 9+
- AWS CLI configured
- AWS credentials

---

## 🎯 What Gets Deployed

A complete, production-ready email platform:

```
📧 User Interface
  └─ Web dashboard, webmail, mobile-responsive

🔐 Authentication
  └─ AWS Cognito, JWT tokens, team management

📨 Email Processing
  ├─ Inbound via AWS SES
  ├─ Processing Lambda functions
  └─ Outbound via AWS SES

💾 Data Storage
  ├─ DynamoDB (multi-tenant database)
  ├─ S3 (email storage, attachments)
  └─ Backup & recovery

🔗 API & Integration
  ├─ REST API (50+ endpoints)
  ├─ TypeScript SDK
  └─ Webhooks for events

📊 Monitoring
  ├─ CloudWatch logs
  ├─ Performance metrics
  └─ Email delivery tracking
```

---

## 📖 Documentation

### Getting Started
- **[QUICK_START.md](./QUICK_START.md)** - Step-by-step guide for first-time users
- **[CLOUDSHELL_DEPLOYMENT.md](./CLOUDSHELL_DEPLOYMENT.md)** - AWS CloudShell deployment details

### Technical Documentation
- **[docs/architecture.md](./docs/architecture.md)** - System design and architecture
- **[docs/authentication.md](./docs/authentication.md)** - Auth system and team management
- **[docs/domain-management.md](./docs/domain-management.md)** - Domain verification and setup
- **[docs/mailbox-management.md](./docs/mailbox-management.md)** - Email mailbox operations
- **[docs/inbound-email-processing.md](./docs/inbound-email-processing.md)** - Receiving emails
- **[docs/outbound-email-sending.md](./docs/outbound-email-sending.md)** - Sending emails
- **[docs/cdk-deployment.md](./docs/cdk-deployment.md)** - Infrastructure deployment

### Project Status
- **[IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)** - Complete phase-by-phase breakdown

---

## 🛠️ Technology Stack

### Frontend
- **Next.js 14** - React framework with SSR
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **React Hook Form** - Form state management
- **Zod** - Runtime validation

### Backend
- **Node.js 18+** - JavaScript runtime
- **AWS Lambda** - Serverless compute
- **AWS API Gateway** - REST API
- **AWS SES** - Email sending/receiving
- **AWS DynamoDB** - NoSQL database

### Infrastructure
- **AWS CDK** - Infrastructure as code
- **AWS Cognito** - Authentication
- **AWS S3** - Object storage
- **AWS SQS** - Message queues
- **AWS CloudFront** - CDN
- **AWS CloudWatch** - Logging & monitoring

### Tooling
- **Turbo** - Monorepo build system
- **ESLint** - Code linting
- **npm workspaces** - Monorepo management

---

## 📦 npm Scripts

### Development
```bash
npm run dev           # Start all dev servers
npm run build         # Build all packages
npm run type-check    # TypeScript validation
npm run lint          # Run ESLint
npm run test          # Run tests
```

### Infrastructure
```bash
npm run cdk:bootstrap    # Bootstrap CDK (first time)
npm run cdk:deploy:dev   # Deploy to development
npm run cdk:deploy:prod  # Deploy to production
npm run cdk:destroy      # Tear down infrastructure
npm run cdk:logs         # View CloudWatch logs
```

### Deployment
```bash
# One-command deployment scripts
./scripts/deploy.sh              # macOS/Linux
.\scripts\deploy.ps1             # Windows PowerShell
bash scripts/deploy-cloudshell.sh # AWS CloudShell
```

---

## 🏗️ Project Structure

```
aws-mailer/
├── apps/
│   ├── api/                    # Lambda API handlers
│   │   ├── src/handlers/       # API endpoint handlers
│   │   ├── src/services/       # Business logic
│   │   └── src/repositories/   # Data access layer
│   ├── web/                    # Next.js webmail frontend
│   │   └── src/app/           # Next.js app directory
│   └── lambda/                 # Async processors
│       ├── inbound-processor/  # Email ingestion
│       ├── outbound-sender/    # Email sending
│       ├── ses-event-processor/ # Bounce/complaint handling
│       └── webhook-dispatcher/ # Webhook delivery
│
├── packages/
│   ├── shared/                 # Types, constants, utilities
│   ├── validation/             # Zod validation schemas
│   ├── email-parser/           # MIME parsing utilities
│   └── sdk/                    # TypeScript SDK
│
├── infrastructure/             # AWS CDK infrastructure
│   ├── lib/stacks/            # CDK stack definitions
│   └── lib/constructs/        # Reusable constructs
│
├── docs/                       # Documentation
├── scripts/                    # Deployment automation
├── tests/                      # Test suite
│
├── QUICK_START.md             # Quick start guide
├── CLOUDSHELL_DEPLOYMENT.md   # CloudShell guide
├── IMPLEMENTATION_SUMMARY.md  # Phase breakdown
└── package.json               # Root package config
```

---

## ⚡ Key Features

### Email Management
- ✅ Send emails from verified custom domains
- ✅ Receive emails to mailboxes
- ✅ Draft management
- ✅ Message search and filtering
- ✅ Attachment support (up to 40MB)
- ✅ Email encryption

### Multi-Tenancy
- ✅ Organization-based isolation
- ✅ Team member management
- ✅ 5-tier role-based access control
- ✅ Usage tracking per organization

### Domain Management
- ✅ Custom domain support
- ✅ Automatic DNS record generation
- ✅ DKIM/SPF/DMARC support
- ✅ SES integration
- ✅ Domain verification workflow

### API & Integration
- ✅ 50+ REST API endpoints
- ✅ TypeScript SDK for easy integration
- ✅ Webhook system for events
- ✅ HMAC signature verification
- ✅ API key management

### Developer Experience
- ✅ Full TypeScript support
- ✅ Comprehensive documentation
- ✅ Code examples
- ✅ REST API documentation
- ✅ SDK TypeScript types

---

## 📊 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend Users                           │
│              (Web, Mobile, API Clients)                    │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
        ┌────────────────────────────────┐
        │   API Gateway (REST API)       │
        │   AWS Cognito (Auth)           │
        └────────────┬───────────────────┘
                     │
        ┌────────────┴─────────────────┐
        │                              │
        ▼                              ▼
┌──────────────────┐         ┌──────────────────┐
│  Lambda API      │         │  Lambda Events   │
│  Handlers        │         │  Processors      │
└────────┬─────────┘         └────────┬─────────┘
         │                            │
         ├────────────┬───────────────┤
         │            │               │
         ▼            ▼               ▼
    ┌────────┐    ┌────────┐     ┌────────────┐
    │DynamoDB│    │   S3   │     │    SES     │
    │        │    │        │     │            │
    │Metadata│    │ Storage│     │ Email Xfer │
    └────────┘    └────────┘     └────────────┘
```

---

## 💰 Cost Estimation

### Typical Monthly Costs

| Component | Cost | Usage |
|-----------|------|-------|
| Lambda | $5-15 | 1M requests |
| DynamoDB | $5-25 | On-demand, <1GB |
| SES | $0-10 | 100k emails |
| S3 | $1-5 | <10GB storage |
| Data Transfer | $0-5 | US region |
| **Total** | **$11-60** | Small deployment |

**Scales** based on usage. Free tier often covers initial testing.

---

## 🔒 Security Features

- ✅ **Encryption**: KMS for data at rest, TLS for transit
- ✅ **Authentication**: Cognito with JWT tokens
- ✅ **Authorization**: Role-based access control (5 roles)
- ✅ **Isolation**: Complete tenant isolation at database level
- ✅ **API Security**: API keys with SHA256 hashing
- ✅ **Validation**: Input validation on all endpoints
- ✅ **Logging**: Full audit trail in CloudWatch
- ✅ **Compliance**: HTTPS enforced, secure headers

---

## 🚦 Getting Started

### 1️⃣ Deploy (Choose Your Method)

**CloudShell (Easiest):**
```bash
bash <(curl -s https://raw.githubusercontent.com/prakhardoneria/aws-mailer/main/scripts/deploy-cloudshell.sh)
```

**Local:**
```bash
# Clone and deploy
git clone https://github.com/prakhardoneria/aws-mailer.git
cd aws-mailer

# macOS/Linux
./scripts/deploy.sh dev

# Windows
.\scripts\deploy.ps1 -Environment dev
```

### 2️⃣ Access Your Platform

After deployment completes:
- 📱 Web Interface: the CloudFront URL printed after CloudShell deployment
- 🔌 API Endpoint: http://localhost:3001
- 📊 AWS Console: https://console.aws.amazon.com

### 3️⃣ Configure Email Domain

1. Sign up for account
2. Create organization
3. Add custom domain
4. Verify domain in AWS SES
5. Create mailbox
6. Start sending emails!

### 4️⃣ Request SES Production Access

To send to external addresses:
1. Go to AWS SES Console
2. Request production access
3. Wait for AWS approval (usually 24 hours)
4. Start sending to any email address

---

## 📝 API Examples

### Send Email

```bash
curl -X POST http://localhost:3001/v1/messages/send \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "hello@example.com",
    "to": ["user@example.com"],
    "subject": "Hello",
    "htmlBody": "<p>Welcome!</p>"
  }'
```

### Using TypeScript SDK

```typescript
import { MailForge } from '@mailforge/sdk';

const client = new MailForge({
  apiKey: process.env.MAILFORGE_API_KEY
});

const message = await client.sendEmail('org-id', {
  from: 'hello@example.com',
  to: ['user@example.com'],
  subject: 'Hello',
  htmlBody: '<p>Welcome!</p>'
});
```

---

## 🧪 Testing

```bash
# Run all tests
npm run test

# Run specific test
npm run test -- apps/api

# Coverage report
npm run test -- --coverage

# Watch mode
npm run test -- --watch
```

---

## 🐛 Troubleshooting

### Common Issues

**AWS credentials not found:**
```bash
aws configure
# Enter your AWS Access Key ID and Secret Access Key
```

**Port already in use:**
```bash
# macOS/Linux
lsof -i :3000 && kill -9 <PID>

# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

**Deployment fails:**
```bash
# View detailed logs
npm run cdk:logs

# Check CloudFormation stack
aws cloudformation describe-stack-events \
  --stack-name mailforge-dev \
  --region us-east-1
```

### Get Help

1. Check [QUICK_START.md](./QUICK_START.md)
2. Review [docs/](./docs/) documentation
3. Check [GitHub Issues](https://github.com/prakhardoneria/aws-mailer/issues)
4. View CloudWatch logs:
   ```bash
   npm run cdk:logs
   ```

---

## 🤝 Contributing

Contributions welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md)

1. Fork the repository
2. Create feature branch
3. Make your changes
4. Run tests: `npm run test`
5. Submit pull request

---

## 📜 License

MIT License - See [LICENSE](./LICENSE) file

---

## 🎯 Project Status

✅ **Complete & Production-Ready**

- ✅ All 12 phases implemented
- ✅ Full REST API
- ✅ Webmail frontend
- ✅ TypeScript SDK
- ✅ One-command deployment
- ✅ Multi-tenant support
- ✅ AWS serverless architecture

**Version:** 1.0.0  
**Last Updated:** November 2024

---

## 📧 Contact & Support

- 📖 **Documentation**: See [docs/](./docs/)
- 🐛 **Issues**: GitHub Issues
- 💬 **Discussions**: GitHub Discussions
- 📧 **Email**: prakhardoneria3@gmail.com

---

## 🙏 Acknowledgments

Built with:
- AWS (CloudServices)
- Next.js (Frontend)
- Node.js (Backend)
- TypeScript (Type Safety)
- Open Source Community
- Amazon Kiro

---

## 🚀 Quick Links

| Resource | Link |
|----------|------|
| **Quick Start** | [QUICK_START.md](./QUICK_START.md) |
| **CloudShell Deploy** | [CLOUDSHELL_DEPLOYMENT.md](./CLOUDSHELL_DEPLOYMENT.md) |
| **Architecture** | [docs/architecture.md](./docs/architecture.md) |
| **API Docs** | [docs/](./docs/) |
| **GitHub** | [Repository](https://github.com/prakhardoneria/aws-mailer) |

---

<div align="center">

### 🎉 Ready to Deploy?

**[👉 Start with AWS CloudShell →](./CLOUDSHELL_DEPLOYMENT.md)**

No setup required. Deploy in 15 minutes.

---

Made with ❤️ for email developers

</div>
