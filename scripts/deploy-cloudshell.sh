#!/usr/bin/env bash

set -Eeuo pipefail

ENVIRONMENT="${1:-dev}"
REPO_URL="https://github.com/prakhardoneria/aws-mailer.git"
DEPLOY_ROOT="${TMPDIR:-/tmp}/mailforge-deploy-${ENVIRONMENT}-$$"
REPO_DIR="${DEPLOY_ROOT}/aws-mailer"
NPM_CACHE_DIR="${TMPDIR:-/tmp}/mailforge-npm-cache-${ENVIRONMENT}-$$"
SCRIPT_VERSION="2026-11-12-cloudshell-storage-v2"

if [[ ! "$ENVIRONMENT" =~ ^(dev|prod)$ ]]; then
  echo "Usage: $0 [dev|prod]" >&2
  exit 2
fi

log() {
  printf '\n[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$1"
}

cleanup_local_workspace() {
  rm -rf "$DEPLOY_ROOT" "$NPM_CACHE_DIR"
}

trap cleanup_local_workspace EXIT
log "MailForge CloudShell deploy ${SCRIPT_VERSION}"

fail() {
  echo "ERROR: $1" >&2
  exit 1
}

free_kb() {
  df -Pk "$1" | awk 'NR == 2 { print $4 }'
}

require_disk_space() {
  local available_kb
  available_kb="$(free_kb "$1")"
  [[ "$available_kb" =~ ^[0-9]+$ ]] || fail "Could not determine available CloudShell disk space"
  if (( available_kb < 250000 )); then
    fail "Less than 250 MB is available in CloudShell. Delete old files or start a fresh CloudShell session, then retry."
  fi
}

command -v aws >/dev/null || fail "AWS CLI is required"
command -v node >/dev/null || fail "Node.js 18+ is required"
command -v npm >/dev/null || fail "npm is required"
command -v jq >/dev/null || fail "jq is required"
command -v curl >/dev/null || fail "curl is required"
aws sts get-caller-identity >/dev/null || fail "AWS credentials are not configured"

if [[ -f package.json && -d infrastructure ]]; then
  PROJECT_DIR="$PWD"
else
  # Remove only stale workspaces created by this deployment script.
  find "${TMPDIR:-/tmp}" -maxdepth 1 -type d \
    \( -name 'mailforge-deploy-*' -o -name 'mailforge-npm-cache-*' \) \
    -exec rm -rf {} +
  mkdir -p "$DEPLOY_ROOT"
  log "Cloning $REPO_URL into temporary CloudShell storage"
  git clone --depth 1 "$REPO_URL" "$REPO_DIR"
  PROJECT_DIR="$REPO_DIR"
fi

cd "$PROJECT_DIR"
export npm_config_cache="$NPM_CACHE_DIR"
require_disk_space "${TMPDIR:-/tmp}"

log "Removing incomplete local install state"
rm -rf node_modules apps/web/.next apps/web/out
npm cache clean --force >/dev/null 2>&1 || true
require_disk_space "${TMPDIR:-/tmp}"

ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
# CDK uses CDK_DEFAULT_REGION when synthesizing the stack. Prefer it so all
# AWS CLI calls inspect and publish to the same region as the deployment.
REGION="${CDK_DEFAULT_REGION:-${AWS_REGION:-}}"
if [[ -z "$REGION" ]]; then
  REGION="$(aws configure get region 2>/dev/null || true)"
fi
REGION="${REGION:-us-east-1}"
export CDK_DEFAULT_REGION="$REGION"
export AWS_DEFAULT_REGION="$REGION"
STACK_NAME="mailforge-${ENVIRONMENT}"
log "Using AWS region ${REGION}"

log "Installing dependencies"
if [[ -f package-lock.json ]]; then
  npm ci --ignore-scripts --no-audit --no-fund \
    --omit=optional --install-strategy=shallow
else
  npm install --ignore-scripts --no-audit --no-fund \
    --omit=optional --install-strategy=shallow
fi
npm cache clean --force >/dev/null 2>&1 || true
require_disk_space "${TMPDIR:-/tmp}"

build_typescript() {
  local config="$1"
  local output="$2"
  log "Building ${config}"
  npx tsc -p "$config"
  [[ -f "$output" ]] || fail "Build did not produce ${output}"
}

build_typescript "packages/shared/tsconfig.json" "packages/shared/dist/index.js"
build_typescript "packages/validation/tsconfig.json" "packages/validation/dist/index.js"
build_typescript "packages/email-parser/tsconfig.json" "packages/email-parser/dist/index.js"
build_typescript "apps/api/tsconfig.json" "apps/api/dist/handlers/auth/sign-in.js"
build_typescript "apps/lambda/inbound-processor/tsconfig.json" "apps/lambda/inbound-processor/dist/index.js"
build_typescript "apps/lambda/outbound-sender/tsconfig.json" "apps/lambda/outbound-sender/dist/index.js"
build_typescript "apps/lambda/ses-event-processor/tsconfig.json" "apps/lambda/ses-event-processor/dist/index.js"
build_typescript "apps/lambda/webhook-dispatcher/tsconfig.json" "apps/lambda/webhook-dispatcher/dist/index.js"

bootstrap_cdk() {
  local bootstrap_status
  bootstrap_status="$(aws cloudformation describe-stacks \
    --stack-name CDKToolkit \
    --region "$REGION" \
    --query 'Stacks[0].StackStatus' \
    --output text 2>/dev/null || true)"

  if [[ "$bootstrap_status" == "UPDATE_ROLLBACK_FAILED" ]]; then
    log "Recovering the failed CDKToolkit rollback in ${REGION}"
    aws cloudformation continue-update-rollback \
      --stack-name CDKToolkit \
      --region "$REGION"
    aws cloudformation wait stack-update-rollback-complete \
      --stack-name CDKToolkit \
      --region "$REGION"
  elif [[ "$bootstrap_status" == *_IN_PROGRESS ]]; then
    fail "CDKToolkit is currently ${bootstrap_status}; wait for it to finish before deploying"
  fi

  log "Bootstrapping CDK in ${REGION}"
  if ! (cd infrastructure && npm run bootstrap -- --region "$REGION" --force); then
    bootstrap_status="$(aws cloudformation describe-stacks \
      --stack-name CDKToolkit \
      --region "$REGION" \
      --query 'Stacks[0].StackStatus' \
      --output text 2>/dev/null || true)"
    if [[ "$bootstrap_status" == "UPDATE_ROLLBACK_FAILED" ]]; then
      fail "CDKToolkit is still UPDATE_ROLLBACK_FAILED. Run 'aws cloudformation continue-update-rollback --stack-name CDKToolkit --region ${REGION}', then rerun this command."
    fi
    fail "CDK bootstrap failed in ${REGION} with CDKToolkit status ${bootstrap_status:-not found}"
  fi
}

bootstrap_cdk

log "Deploying ${STACK_NAME}"
(cd infrastructure && npm run "deploy:${ENVIRONMENT}" -- --require-approval never)

log "Reading CloudFormation outputs"
OUTPUTS="$(
  aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query 'Stacks[0].Outputs' \
    --output json
)"
output_value() {
  jq -r --arg key "$1" '.[] | select(.OutputKey == $key) | .OutputValue' <<<"$OUTPUTS"
}

API_URL="$(output_value ApiEndpoint | sed 's:/*$::')"
WEBSITE_URL="$(output_value WebsiteUrl)"
FRONTEND_BUCKET="$(output_value FrontendBucketName)"
DISTRIBUTION_ID="$(output_value CloudFrontDistributionId)"

[[ -n "$API_URL" && "$API_URL" != "null" ]] || fail "ApiEndpoint output is missing"
[[ -n "$WEBSITE_URL" && "$WEBSITE_URL" != "null" ]] || fail "WebsiteUrl output is missing"
[[ -n "$FRONTEND_BUCKET" && "$FRONTEND_BUCKET" != "null" ]] || fail "FrontendBucketName output is missing"
[[ -n "$DISTRIBUTION_ID" && "$DISTRIBUTION_ID" != "null" ]] || fail "CloudFrontDistributionId output is missing"

log "Building frontend with the deployed API endpoint"
NEXT_PUBLIC_API_URL="$API_URL" \
NEXT_PUBLIC_ENVIRONMENT="$ENVIRONMENT" \
npm run build --workspace @mailforge/web -- --no-lint

[[ -d apps/web/out ]] || fail "Static frontend output apps/web/out was not created"
log "Publishing frontend to s3://${FRONTEND_BUCKET}"
aws s3 sync apps/web/out "s3://${FRONTEND_BUCKET}" --delete --region "$REGION"
aws cloudfront create-invalidation \
  --distribution-id "$DISTRIBUTION_ID" \
  --paths '/*' \
  --region "$REGION" >/dev/null

log "Waiting for CloudFront distribution to deploy"
aws cloudfront wait distribution-deployed \
  --id "$DISTRIBUTION_ID" \
  --region "$REGION"

log "Checking frontend URL"
for attempt in {1..12}; do
  if curl --fail --silent --show-error --location "$WEBSITE_URL/" >/dev/null; then
    break
  fi
  if [[ "$attempt" -eq 12 ]]; then
    fail "CloudFront is deployed but the frontend URL did not return HTTP 2xx"
  fi
  sleep 10
done

log "Deployment complete"
cat <<EOF

Environment:        ${ENVIRONMENT}
AWS account/region: ${ACCOUNT}/${REGION}
Frontend:           ${WEBSITE_URL}
API:                ${API_URL}

The CloudFront URL may take a few minutes to finish propagating.
To remove this environment completely, run:
  ./scripts/delete-cloudshell.sh ${ENVIRONMENT}
EOF
