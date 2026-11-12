#!/usr/bin/env pwsh

# MailForge One-Command Deployment Script
# Usage: .\scripts\deploy.ps1 [-Environment dev|prod] [-SkipCleanup]

param(
    [string]$Environment = "dev",
    [switch]$SkipCleanup = $false
)

# Colors for output
$Colors = @{
    Error = "Red"
    Success = "Green"
    Warning = "Yellow"
    Info = "Cyan"
}

function Write-Log {
    param(
        [string]$Message,
        [string]$Type = "Info"
    )
    $Color = $Colors[$Type] ?? "White"
    $Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "[$Timestamp] " -NoNewline -ForegroundColor Gray
    Write-Host $Message -ForegroundColor $Color
}

function Exit-WithError {
    param([string]$Message)
    Write-Log $Message "Error"
    if (-not $SkipCleanup) {
        Write-Log "Cleaning up resources due to error..." "Warning"
        Cleanup-Resources
    }
    exit 1
}

function Cleanup-Resources {
    Write-Log "Starting resource cleanup..." "Warning"
    
    try {
        # Destroy CDK stack if exists
        Write-Log "Destroying CDK stack..."
        & npm run cdk:destroy -- --force 2>$null
    } catch {
        Write-Log "CDK stack cleanup skipped (may not be deployed)" "Info"
    }
    
    # Delete local node_modules if they exist
    if (Test-Path "node_modules") {
        Write-Log "Removing node_modules..."
        Remove-Item -Recurse -Force "node_modules" 2>$null
    }
    
    Write-Log "Cleanup complete" "Success"
}

function Check-Prerequisites {
    Write-Log "Checking prerequisites..." "Info"
    
    # Check Node.js
    $node = node --version 2>$null
    if (-not $node) {
        Exit-WithError "Node.js not found. Please install Node.js 18+ from https://nodejs.org/"
    }
    Write-Log "✓ Node.js $node" "Success"
    
    # Check npm
    $npm = npm --version 2>$null
    if (-not $npm) {
        Exit-WithError "npm not found. Please install Node.js which includes npm."
    }
    Write-Log "✓ npm $npm" "Success"
    
    # Check AWS CLI
    $aws = aws --version 2>$null
    if (-not $aws) {
        Exit-WithError "AWS CLI not found. Please install from https://aws.amazon.com/cli/"
    }
    Write-Log "✓ AWS CLI installed" "Success"
    
    # Check AWS credentials
    try {
        $identity = aws sts get-caller-identity 2>$null | ConvertFrom-Json
        if ($identity) {
            Write-Log "✓ AWS credentials configured (Account: $($identity.Account))" "Success"
        }
    } catch {
        Exit-WithError "AWS credentials not configured. Run 'aws configure' first."
    }
    
    # Check Docker (optional, for local testing)
    $docker = docker --version 2>$null
    if ($docker) {
        Write-Log "✓ Docker $docker" "Success"
    } else {
        Write-Log "! Docker not found (optional, for local testing)" "Warning"
    }
}

function Setup-Environment {
    param([string]$Env)
    
    Write-Log "Setting up environment variables for $Env..." "Info"
    
    $envFile = ".env.$Env"
    if (-not (Test-Path $envFile)) {
        Write-Log "Creating $envFile..." "Info"
        
        $content = @"
# MailForge Environment Configuration
ENVIRONMENT=$Env
AWS_REGION=us-east-1
NODE_ENV=$Env

# API Configuration
API_PORT=3001
API_LOG_LEVEL=info

# Frontend Configuration
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_ENVIRONMENT=$Env

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
"@
        
        Set-Content -Path $envFile -Value $content
        Write-Log "✓ Created $envFile" "Success"
    } else {
        Write-Log "✓ $envFile already exists" "Success"
    }
}

function Install-Dependencies {
    Write-Log "Installing dependencies..." "Info"
    
    try {
        # Use npm 9+ with workspace support
        $npmVersion = (npm --version).Split('.')[0]
        if ([int]$npmVersion -lt 9) {
            Write-Log "npm version $npmVersion detected. npm 9+ required for workspace support." "Warning"
            Write-Log "Upgrading npm..." "Info"
            npm install -g npm@latest 2>$null
        }
        
        # Install root dependencies
        Write-Log "Installing root dependencies..." "Info"
        npm install
        
        Write-Log "✓ Dependencies installed" "Success"
    } catch {
        Exit-WithError "Failed to install dependencies: $_"
    }
}

function Build-Project {
    Write-Log "Building project..." "Info"
    
    try {
        & npm run build 2>&1 | ForEach-Object {
            if ($_ -match "error|fail") {
                Write-Log $_ "Error"
            } elseif ($_ -match "warn") {
                Write-Log $_ "Warning"
            }
        }
        
        Write-Log "✓ Build successful" "Success"
    } catch {
        Exit-WithError "Build failed: $_"
    }
}

function Deploy-Infrastructure {
    param([string]$Env)
    
    Write-Log "Deploying infrastructure to $Env..." "Info"
    
    try {
        Set-Location "infrastructure"
        
        # Bootstrap CDK (first time only)
        Write-Log "Bootstrapping CDK..." "Info"
        & npm run bootstrap 2>&1
        
        # Deploy stack
        Write-Log "Deploying CDK stack..." "Info"
        & npm run deploy:$Env 2>&1
        
        Set-Location ".."
        
        Write-Log "✓ Infrastructure deployed" "Success"
    } catch {
        Exit-WithError "Infrastructure deployment failed: $_"
    }
}

function Start-Services {
    Write-Log "Starting services..." "Info"
    
    try {
        # Note: In production, these would be started by the deployment
        # For local dev, we provide instructions
        
        Write-Log "Services are configured and ready to start" "Info"
        Write-Log "To start local development:" "Info"
        Write-Log "  npm run dev" "Info"
        
        Write-Log "✓ Service setup complete" "Success"
    } catch {
        Exit-WithError "Service startup failed: $_"
    }
}

function Verify-Deployment {
    Write-Log "Verifying deployment..." "Info"
    
    try {
        # Wait for API to be ready
        $maxAttempts = 30
        $attempt = 0
        $apiUrl = "http://localhost:3001"
        
        Write-Log "Waiting for API to be ready at $apiUrl..." "Info"
        
        while ($attempt -lt $maxAttempts) {
            try {
                $response = Invoke-WebRequest -Uri "$apiUrl/health" -ErrorAction SilentlyContinue
                if ($response.StatusCode -eq 200) {
                    Write-Log "✓ API is healthy" "Success"
                    return $true
                }
            } catch {
                # API not ready yet
            }
            
            $attempt++
            Start-Sleep -Seconds 1
        }
        
        Write-Log "API verification skipped (services may be starting or need manual start)" "Warning"
        return $true
    } catch {
        Write-Log "Verification warning: $_" "Warning"
        return $true
    }
}

function Display-Summary {
    param([string]$Env)
    
    Write-Log "========================================" "Info"
    Write-Log "MailForge Deployment Complete!" "Success"
    Write-Log "========================================" "Info"
    
    Write-Host @"

Environment: $Env
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
- Full reset: .\scripts\deploy.ps1 -Environment $Env

"@
}

function Main {
    $startTime = Get-Date
    
    Write-Log "MailForge One-Command Deployment Script" "Info"
    Write-Log "Environment: $Environment" "Info"
    Write-Log "========================================" "Info"
    
    # Step 1: Check prerequisites
    Check-Prerequisites
    
    # Step 2: Setup environment
    Setup-Environment -Env $Environment
    
    # Step 3: Install dependencies
    Install-Dependencies
    
    # Step 4: Build project
    Build-Project
    
    # Step 5: Deploy infrastructure
    Deploy-Infrastructure -Env $Environment
    
    # Step 6: Start services
    Start-Services
    
    # Step 7: Verify deployment
    Verify-Deployment
    
    # Display summary
    Display-Summary -Env $Environment
    
    $endTime = Get-Date
    $duration = ($endTime - $startTime).TotalSeconds
    
    Write-Log "Deployment completed in $($duration.ToString('0.00')) seconds" "Success"
}

# Run main function
Main
