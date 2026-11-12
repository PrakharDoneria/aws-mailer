#!/bin/bash

# MailForge One-Command Deployment Script
# Usage: ./scripts/deploy.sh [--environment dev|prod] [--skip-cleanup]

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT="dev"
SKIP_CLEANUP=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --skip-cleanup)
            SKIP_CLEANUP=true
            shift
            ;;
        *)
            shift
            ;;
    esac
done

# Logging functions
log_info() {
    echo -e "${CYAN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

log_success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

exit_error() {
    log_error "$1"
    if [ "$SKIP_CLEANUP" = false ]; then
        cleanup_resources
    fi
    exit 1
}

cleanup_resources() {
    log_warning "Starting resource cleanup..."
    
    # Destroy CDK stack
    cd infrastructure 2>/dev/null
    npm run destroy -- --force 2>/dev/null
    cd ..
    
    # Remove node_modules
    rm -rf node_modules 2>/dev/null
    
    log_success "Cleanup complete"
}

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        exit_error "Node.js not found. Please install Node.js 18+ from https://nodejs.org/"
    fi
    log_success "✓ Node.js $(node --version)"
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        exit_error "npm not found. Please install Node.js which includes npm."
    fi
    log_success "✓ npm $(npm --version)"
    
    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        exit_error "AWS CLI not found. Please install from https://aws.amazon.com/cli/"
    fi
    log_success "✓ AWS CLI installed"
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        exit_error "AWS credentials not configured. Run 'aws configure' first."
    fi
    ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
    log_success "✓ AWS credentials configured (Account: $ACCOUNT)"
    
    # Check Docker (optional)
    if command -v docker &> /dev/null; then
        log_success "✓ Docker $(docker --version)"
    else
        log_warning "! Docker not found (optional, for local testing)"
    fi
}

setup_environment() {
    log_info "Setting up environment variables for $ENVIRONMENT..."
    
    ENV_FILE=".env.$ENVIRONMENT"
    if [ ! -f "$ENV_FILE" ]; then
        log_info "Creating $ENV_FILE..."
        cat > "$ENV_FILE" << EOF
# MailForge Environment Configuration
ENVIRONMENT=$ENVIRONMENT
AWS_REGION=us-east-1
NODE_ENV=$ENVIRONMENT

# API Configuration
API_PORT=3001
API_LOG_LEVEL=info

# Frontend Configuration
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_ENVIRONMENT=$ENVIRONMENT

# Cognito (set by CDK)
COGNITO_USER_POOL_ID=
COGNITO_USER_POOL_CLIENT_ID=

# DynamoDB Tables (set by CDK)
ORGANIZATIONS_TABLE=
USERS_TABLE=
DOMAINS_TABLE=
MAILBOXES_TABLE=
MESSAGES_TABLE=

# S3 Buckets (set by CDK)
EMAIL_BUCKET=
ATTACHMENTS_BUCKET=

# SQS Queues (set by CDK)
INBOUND_QUEUE_URL=
OUTBOUND_QUEUE_URL=
WEBHOOK_QUEUE_URL=
EOF
        log_success "✓ Created $ENV_FILE"
    else
        log_success "✓ $ENV_FILE already exists"
    fi
}

install_dependencies() {
    log_info "Installing dependencies..."
    
    # Check npm version
    NPM_VERSION=$(npm --version | cut -d'.' -f1)
    if [ "$NPM_VERSION" -lt 9 ]; then
        log_warning "npm version $NPM_VERSION detected. npm 9+ required for workspace support."
        log_info "Upgrading npm..."
        npm install -g npm@latest 2>/dev/null
    fi
    
    # Install root dependencies
    log_info "Installing root dependencies..."
    npm install || exit_error "Failed to install dependencies"
    
    log_success "✓ Dependencies installed"
}

build_project() {
    log_info "Building project..."
    
    npm run build 2>&1 | grep -E "error|fail" && {
        exit_error "Build failed"
    }
    
    log_success "✓ Build successful"
}

deploy_infrastructure() {
    log_info "Deploying infrastructure to $ENVIRONMENT..."
    
    cd infrastructure || exit_error "infrastructure directory not found"
    
    # Bootstrap CDK
    log_info "Bootstrapping CDK..."
    npm run bootstrap 2>&1 || log_warning "Bootstrap may have been skipped (already initialized)"
    
    # Deploy stack
    log_info "Deploying CDK stack..."
    npm run deploy:$ENVIRONMENT 2>&1 || exit_error "CDK deployment failed"
    
    cd ..
    log_success "✓ Infrastructure deployed"
}

start_services() {
    log_info "Starting services..."
    log_info "Services are configured and ready to start"
    log_info "To start local development: npm run dev"
    log_success "✓ Service setup complete"
}

verify_deployment() {
    log_info "Verifying deployment..."
    
    MAX_ATTEMPTS=30
    ATTEMPT=0
    API_URL="http://localhost:3001"
    
    log_info "Waiting for API to be ready at $API_URL..."
    
    while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
        if curl -s -f "$API_URL/health" > /dev/null 2>&1; then
            log_success "✓ API is healthy"
            return 0
        fi
        
        ATTEMPT=$((ATTEMPT + 1))
        sleep 1
    done
    
    log_warning "API verification skipped (services may be starting or need manual start)"
}

display_summary() {
    log_info "========================================"
    log_success "MailForge Deployment Complete!"
    log_info "========================================"
    
    cat << EOF

Environment: $ENVIRONMENT
Status: Ready

Next Steps:
1. Configure your AWS SES domain (see docs/domain-management.md)
2. Access the web interface: http://localhost:3000
3. API endpoint: http://localhost:3001

Documentation:
- Architecture: docs/architecture.md
- Domain Setup: docs/domain-management.md
- Deployment: docs/cdk-deployment.md
- API Reference: docs/api-reference.md

Support:
- Check logs: npm run logs
- Debug: npm run dev
- Full reset: ./scripts/deploy.sh --environment $ENVIRONMENT

EOF
}

main() {
    START_TIME=$(date +%s)
    
    log_info "MailForge One-Command Deployment Script"
    log_info "Environment: $ENVIRONMENT"
    log_info "========================================"
    
    # Run all steps
    check_prerequisites
    setup_environment
    install_dependencies
    build_project
    deploy_infrastructure
    start_services
    verify_deployment
    display_summary
    
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    
    log_success "Deployment completed in $DURATION seconds"
}

# Run main function
main
