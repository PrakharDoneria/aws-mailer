#!/usr/bin/env bash

set -Eeuo pipefail

ENVIRONMENT="${1:-dev}"
REPO_URL="https://github.com/prakhardoneria/aws-mailer.git"
DEPLOY_ROOT="${TMPDIR:-/tmp}/mailforge-deploy-${ENVIRONMENT}-$$"
REPO_DIR="${DEPLOY_ROOT}/aws-mailer"
NPM_CACHE_DIR="${TMPDIR:-/tmp}/mailforge-npm-cache-${ENVIRONMENT}-$$"
SCRIPT_VERSION="2026-11-13-set-e-safe-concurrency"

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
  local execution_role
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

  execution_role="cdk-hnb659fds-cfn-exec-role-${ACCOUNT}-${REGION}"
  if [[ "$bootstrap_status" == "UPDATE_ROLLBACK_COMPLETE" ]] &&
    ! aws iam get-role --role-name "$execution_role" --region "$REGION" >/dev/null 2>&1; then
    log "Repairing CDKToolkit drift: missing ${execution_role}"
    aws cloudformation delete-stack --stack-name CDKToolkit --region "$REGION"
    aws cloudformation wait stack-delete-complete \
      --stack-name CDKToolkit --region "$REGION"
    bootstrap_status=""
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

# ---------------------------------------------------------------------------
# purge_orphaned_resources
# Detects and removes resources that were left behind by a previous failed
# CloudFormation deployment/rollback.  Only resources that are NOT currently
# tracked by any CloudFormation stack in this account/region are removed.
# S3 buckets are emptied before deletion.  DynamoDB tables and CloudWatch
# log groups are deleted directly.
# ---------------------------------------------------------------------------
is_cfn_managed() {
  # Returns 0 (true) if the resource is tracked by any CFN stack, 1 otherwise.
  # Written to be safe under set -e: always exits 0 or 1, never traps.
  local resource_id="$2"
  local stack_name
  stack_name=$(aws cloudformation describe-stack-resources \
    --region "$REGION" \
    --physical-resource-id "$resource_id" \
    --query 'StackResources[0].StackName' \
    --output text 2>/dev/null || true)
  if [[ -n "$stack_name" && "$stack_name" != "None" ]]; then
    return 0   # managed
  fi
  return 1     # orphaned
}

purge_orphaned_resources() {
  log "Scanning for orphaned MailForge resources in ${REGION} (from previous failed deployments)"

  # -- DynamoDB tables -------------------------------------------------------
  local tables
  tables=$(aws dynamodb list-tables \
    --region "$REGION" \
    --query "TableNames[?starts_with(@, 'mailforge-${ENVIRONMENT}-')]" \
    --output text 2>/dev/null || true)
  for table in $tables; do
    if ! is_cfn_managed "AWS::DynamoDB::Table" "$table"; then
      log "  Deleting orphaned DynamoDB table: ${table}"
      aws dynamodb delete-table --table-name "$table" --region "$REGION" >/dev/null
      aws dynamodb wait table-not-exists --table-name "$table" --region "$REGION" || true
    fi
  done

  # -- S3 buckets ------------------------------------------------------------
  local buckets
  buckets=$(aws s3api list-buckets \
    --query "Buckets[?starts_with(Name, 'mailforge-${ENVIRONMENT}-')].Name" \
    --output text 2>/dev/null || true)
  for bucket in $buckets; do
    if ! is_cfn_managed "AWS::S3::Bucket" "$bucket"; then
      log "  Emptying + deleting orphaned S3 bucket: ${bucket}"
      # Remove all object versions (including delete markers)
      aws s3api list-object-versions \
        --bucket "$bucket" --region "$REGION" \
        --query '{Objects: Versions[].{Key:Key,VersionId:VersionId}}' \
        --output json 2>/dev/null \
        | jq -c 'select(.Objects != null and (.Objects | length) > 0)' \
        | while IFS= read -r batch; do
            aws s3api delete-objects \
              --bucket "$bucket" \
              --delete "$batch" \
              --region "$REGION" >/dev/null
          done || true
      # Remove delete markers
      aws s3api list-object-versions \
        --bucket "$bucket" --region "$REGION" \
        --query '{Objects: DeleteMarkers[].{Key:Key,VersionId:VersionId}}' \
        --output json 2>/dev/null \
        | jq -c 'select(.Objects != null and (.Objects | length) > 0)' \
        | while IFS= read -r batch; do
            aws s3api delete-objects \
              --bucket "$bucket" \
              --delete "$batch" \
              --region "$REGION" >/dev/null
          done || true
      aws s3 rb "s3://${bucket}" --force --region "$REGION" >/dev/null || true
    fi
  done

  # -- CloudWatch log groups -------------------------------------------------
  local log_groups
  log_groups=$(aws logs describe-log-groups \
    --region "$REGION" \
    --log-group-name-prefix "/mailforge/${ENVIRONMENT}/" \
    --query 'logGroups[].logGroupName' \
    --output text 2>/dev/null || true)
  for lg in $log_groups; do
    if ! is_cfn_managed "AWS::Logs::LogGroup" "$lg"; then
      log "  Deleting orphaned CloudWatch log group: ${lg}"
      aws logs delete-log-group --log-group-name "$lg" --region "$REGION" >/dev/null || true
    fi
  done

  log "Orphan cleanup complete"
  return 0
}

# ---------------------------------------------------------------------------
# detect_lambda_concurrency_context
# Reads the account's unreserved Lambda concurrency and emits CDK context
# flags so the stack sets safe reserved-concurrency values.
# Sets global CONCURRENCY_FLAGS and LAMBDA_ACCOUNT_LIMIT.
# NOTE: written to never return non-zero (safe under set -e).
# ---------------------------------------------------------------------------
detect_lambda_concurrency_context() {
  local account_limit usable inbound outbound webhook
  account_limit=$(aws lambda get-account-settings \
    --region "$REGION" \
    --query 'AccountLimit.ConcurrentExecutions' \
    --output text 2>/dev/null || true)
  # Default to 10 if the call failed or returned nothing
  account_limit="${account_limit:-10}"
  LAMBDA_ACCOUNT_LIMIT="$account_limit"

  # Keep at least 10 unreserved (AWS minimum).
  if (( account_limit > 10 )); then
    usable=$(( account_limit - 10 ))
  else
    usable=0
  fi

  # Distribute across the three reserved-concurrency Lambdas (50/30/20 %).
  if (( usable > 0 )); then
    inbound=$(( usable * 50 / 100 ))
    outbound=$(( usable * 30 / 100 ))
    webhook=$(( usable * 20 / 100 ))
  else
    inbound=0; outbound=0; webhook=0
  fi

  log "Lambda concurrency: account limit=${account_limit}, usable=${usable}"
  log "  inboundProcessor=${inbound}, outboundSender=${outbound}, webhookDispatcher=${webhook}"

  if (( account_limit <= 10 )); then
    log "  WARNING: account concurrency limit is at the AWS minimum (${account_limit})."
    log "  Lambdas will deploy without reserved concurrency and share the ${account_limit}-execution pool."
    log "  Request an increase after deploy: https://console.aws.amazon.com/servicequotas/home/services/lambda/quotas/L-B99A9384"
  fi

  # Build CDK --context flags (omit any that are 0 so CDK skips the property)
  CONCURRENCY_FLAGS=""
  if (( inbound  > 0 )); then CONCURRENCY_FLAGS+=" -c lambdaConcurrencyInbound=${inbound}";   fi
  if (( outbound > 0 )); then CONCURRENCY_FLAGS+=" -c lambdaConcurrencyOutbound=${outbound}"; fi
  if (( webhook  > 0 )); then CONCURRENCY_FLAGS+=" -c lambdaConcurrencyWebhook=${webhook}";   fi
  return 0
}

purge_orphaned_resources
detect_lambda_concurrency_context

bootstrap_cdk

log "Deploying ${STACK_NAME}"
# shellcheck disable=SC2086
(cd infrastructure && npm run "deploy:${ENVIRONMENT}" -- --require-approval never $CONCURRENCY_FLAGS)

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

# Show a critical warning if the account concurrency limit is dangerously low
if (( LAMBDA_ACCOUNT_LIMIT <= 10 )); then
  cat <<WARN

╔══════════════════════════════════════════════════════════╗
  🚨 CRITICAL: Lambda concurrency limit is ${LAMBDA_ACCOUNT_LIMIT}
╚══════════════════════════════════════════════════════════╝
  Your account has only ${LAMBDA_ACCOUNT_LIMIT} total concurrent Lambda executions
  in ${REGION}. All Lambdas in your account share this pool.
  The app is deployed and will work, but under ANY load it
  will throttle heavily.

  REQUEST A QUOTA INCREASE NOW (takes ~24 hours):
  https://console.aws.amazon.com/servicequotas/home/services/lambda/quotas/L-B99A9384
  Request value: 1000 (AWS default for established accounts)
WARN
fi

cat <<EOF

╔══════════════════════════════════════════════════════════╗
  MailForge deployment complete — ${ENVIRONMENT}
╚══════════════════════════════════════════════════════════╝

  Environment:        ${ENVIRONMENT}
  AWS account/region: ${ACCOUNT}/${REGION}
  Frontend:           ${WEBSITE_URL}
  API:                ${API_URL}

  The CloudFront URL may take a few minutes to finish propagating.
  To remove this environment completely, run:
    ./scripts/delete-cloudshell.sh ${ENVIRONMENT}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  🔗 Quick links
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  CloudWatch dashboard:
    https://console.aws.amazon.com/cloudwatch/home?region=${REGION}#dashboards:name=mailforge-${ENVIRONMENT}

  API Gateway:
    https://console.aws.amazon.com/apigateway/main/apis?region=${REGION}

  Lambda functions:
    https://console.aws.amazon.com/lambda/home?region=${REGION}#/functions

  DynamoDB tables:
    https://console.aws.amazon.com/dynamodbv2/home?region=${REGION}#tables

  SES (email sending):
    https://console.aws.amazon.com/ses/home?region=${REGION}

  S3 buckets:
    https://s3.console.aws.amazon.com/s3/buckets?region=${REGION}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ⚠️  Recommended quota increases (request these in AWS to
     improve reliability and performance)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Lambda – Concurrent executions (request ≥ 500):
    https://console.aws.amazon.com/servicequotas/home/services/lambda/quotas/L-B99A9384

  Lambda – Unreserved concurrency (verify ≥ 100):
    https://console.aws.amazon.com/servicequotas/home/services/lambda/quotas/L-2ACBD22F

  SES – Sending rate (increase if needed):
    https://console.aws.amazon.com/servicequotas/home/services/ses/quotas/L-804C8AE8

  DynamoDB – Table count per account (default 2500):
    https://console.aws.amazon.com/servicequotas/home/services/dynamodb/quotas/L-F98FE922

  CloudWatch – Log groups per region (default 1,000,000):
    https://console.aws.amazon.com/servicequotas/home/services/logs/quotas

  All Service Quotas dashboard:
    https://console.aws.amazon.com/servicequotas/home?region=${REGION}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EOF
