#!/usr/bin/env bash

set -Eeuo pipefail

ENVIRONMENT="${1:-prod}"
REPO_URL="https://github.com/prakhardoneria/aws-mailer.git"
ROOT="${TMPDIR:-/tmp}/mailforge-patch-${ENVIRONMENT}-$$"
REPO_DIR="${ROOT}/aws-mailer"
CACHE="${TMPDIR:-/tmp}/mailforge-patch-cache-${ENVIRONMENT}-$$"
STACK_NAME="mailforge-${ENVIRONMENT}"

[[ "$ENVIRONMENT" =~ ^(dev|prod)$ ]] || {
  echo "Usage: $0 [dev|prod]" >&2
  exit 2
}

log() { printf '\n[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$1"; }
fail() { echo "ERROR: $1" >&2; exit 1; }
cleanup() { rm -rf "$ROOT" "$CACHE"; }
trap cleanup EXIT

for command_name in aws git node npm jq curl; do
  command -v "$command_name" >/dev/null || fail "$command_name is required"
done
aws sts get-caller-identity >/dev/null || fail "AWS credentials are not configured"

REGION="$(aws configure get region 2>/dev/null || true)"
REGION="${REGION:-us-east-1}"
ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"

log "Inspecting existing ${STACK_NAME} resources before patching"
STACK_STATUS="$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
  --region "$REGION" --query 'Stacks[0].StackStatus' --output text 2>/dev/null || true)"
[[ "$STACK_STATUS" == "CREATE_COMPLETE" || "$STACK_STATUS" == "UPDATE_COMPLETE" ]] ||
  fail "Existing ${STACK_NAME} stack is missing or not stable (status: ${STACK_STATUS:-not found})"

RESOURCES="$(aws cloudformation list-stack-resources --stack-name "$STACK_NAME" \
  --region "$REGION" --output json)"
RESOURCE_COUNT="$(jq '.StackResourceSummaries | length' <<<"$RESOURCES")"
[[ "$RESOURCE_COUNT" -gt 0 ]] || fail "No resources were found in ${STACK_NAME}"
printf '%s\n' "$RESOURCES" | jq -r '.StackResourceSummaries[] | "\(.ResourceStatus)\t\(.ResourceType)\t\(.LogicalResourceId)"'

OUTPUTS="$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" \
  --query 'Stacks[0].Outputs' --output json)"
output_value() { jq -r --arg key "$1" '.[] | select(.OutputKey == $key) | .OutputValue' <<<"$OUTPUTS"; }
API_URL="$(output_value ApiEndpoint | sed 's:/*$::')"
WEBSITE_URL="$(output_value WebsiteUrl)"
FRONTEND_BUCKET="$(output_value FrontendBucketName)"
DISTRIBUTION_ID="$(output_value CloudFrontDistributionId)"
[[ "$API_URL" != "null" && -n "$API_URL" ]] || fail "Existing stack has no ApiEndpoint output"
[[ "$WEBSITE_URL" != "null" && -n "$WEBSITE_URL" ]] || fail "Existing stack has no WebsiteUrl output"
[[ "$FRONTEND_BUCKET" != "null" && -n "$FRONTEND_BUCKET" ]] || fail "Existing stack has no frontend bucket output"
[[ "$DISTRIBUTION_ID" != "null" && -n "$DISTRIBUTION_ID" ]] || fail "Existing stack has no CloudFront output"

mkdir -p "$ROOT"
log "Cloning the patch source into temporary CloudShell storage"
git clone --depth 1 "$REPO_URL" "$REPO_DIR"
cd "$REPO_DIR"
export npm_config_cache="$CACHE"
rm -rf node_modules apps/web/.next apps/web/out
npm cache clean --force >/dev/null 2>&1 || true
if [[ -f package-lock.json ]]; then
  npm ci --ignore-scripts --no-audit --no-fund --omit=optional --install-strategy=shallow
else
  npm install --ignore-scripts --no-audit --no-fund --omit=optional --install-strategy=shallow
fi

build() { npx tsc -p "$1"; }
log "Building patched backend assets"
build packages/shared/tsconfig.json
build packages/validation/tsconfig.json
build packages/email-parser/tsconfig.json
build apps/api/tsconfig.json
build apps/lambda/inbound-processor/tsconfig.json
build apps/lambda/outbound-sender/tsconfig.json
build apps/lambda/ses-event-processor/tsconfig.json
build apps/lambda/webhook-dispatcher/tsconfig.json

log "Updating ${STACK_NAME} in place (no delete or destroy operation)"
(cd infrastructure && npm run "deploy:${ENVIRONMENT}" -- --require-approval never)

log "Publishing the patched frontend"
NEXT_PUBLIC_API_URL="$API_URL" NEXT_PUBLIC_ENVIRONMENT="$ENVIRONMENT" \
  npm run build --workspace @mailforge/web -- --no-lint
aws s3 sync apps/web/out "s3://${FRONTEND_BUCKET}" --delete --region "$REGION"
aws cloudfront create-invalidation --distribution-id "$DISTRIBUTION_ID" \
  --paths '/*' --region "$REGION" >/dev/null
aws cloudfront wait distribution-deployed --id "$DISTRIBUTION_ID" --region "$REGION"
curl --fail --silent --show-error --location "$WEBSITE_URL/" >/dev/null ||
  fail "Patched frontend did not return HTTP 2xx"

log "Patch complete"
cat <<EOF

Environment:        ${ENVIRONMENT}
AWS account/region: ${ACCOUNT}/${REGION}
Frontend:           ${WEBSITE_URL}
API:                ${API_URL}
Resources inspected: ${RESOURCE_COUNT}
Update mode:        existing CloudFormation stack only
EOF
