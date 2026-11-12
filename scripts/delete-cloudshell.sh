#!/usr/bin/env bash

set -Eeuo pipefail

ENVIRONMENT="${1:-dev}"
CONFIRM="${2:-}"

if [[ ! "$ENVIRONMENT" =~ ^(dev|prod)$ ]]; then
  echo "Usage: $0 [dev|prod] [--yes]" >&2
  exit 2
fi

command -v aws >/dev/null || { echo "AWS CLI is required" >&2; exit 1; }
command -v jq >/dev/null || { echo "jq is required" >&2; exit 1; }
aws sts get-caller-identity >/dev/null || {
  echo "AWS credentials are not configured" >&2
  exit 1
}

REGION="$(aws configure get region 2>/dev/null || true)"
REGION="${REGION:-us-east-1}"
STACK_NAME="mailforge-${ENVIRONMENT}"
PREFIX="mailforge-${ENVIRONMENT}-"
TMP_FILE="$(mktemp)"
trap 'rm -f "$TMP_FILE"' EXIT

if [[ "$CONFIRM" != "--yes" ]]; then
  cat >&2 <<EOF
This permanently deletes the ${ENVIRONMENT} MailForge environment in AWS.
It removes application data, S3 objects, databases, queues, logs, and the CloudFront distribution.
KMS keys are scheduled for deletion using AWS's minimum seven-day waiting period.
EOF
  read -r -p "Type DELETE-${ENVIRONMENT} to continue: " ANSWER
  [[ "$ANSWER" == "DELETE-${ENVIRONMENT}" ]] || {
    echo "Deletion cancelled."
    exit 0
  }
fi

echo "Deleting ${STACK_NAME} in ${REGION}..."
if aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" >/dev/null 2>&1; then
  aws cloudformation list-stack-resources \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query 'StackResourceSummaries[?ResourceType==`AWS::KMS::Key`].PhysicalResourceId' \
    --output text >"$TMP_FILE" || true
  aws cloudformation delete-stack --stack-name "$STACK_NAME" --region "$REGION"
  aws cloudformation wait stack-delete-complete --stack-name "$STACK_NAME" --region "$REGION"
else
  echo "CloudFormation stack not found; cleaning matching retained resources."
fi

echo "Removing retained S3 buckets..."
for bucket in $(aws s3api list-buckets \
  --query "Buckets[?starts_with(Name, \`${PREFIX}\`)].Name" \
  --output text); do
  aws s3 rm "s3://${bucket}" --recursive --region "$REGION"
  aws s3api delete-bucket --bucket "$bucket" --region "$REGION"
done

echo "Removing retained DynamoDB tables..."
for table in $(aws dynamodb list-tables \
  --region "$REGION" \
  --query "TableNames[?starts_with(@, \`${PREFIX}\`)]" \
  --output text); do
  aws dynamodb delete-table --table-name "$table" --region "$REGION" >/dev/null
done

echo "Removing retained Cognito user pools..."
for pool in $(aws cognito-idp list-user-pools \
  --max-results 60 \
  --region "$REGION" \
  --query "UserPools[?starts_with(Name, \`mailforge-${ENVIRONMENT}\`)].Id" \
  --output text); do
  aws cognito-idp delete-user-pool --user-pool-id "$pool" --region "$REGION"
done

echo "Removing retained CloudWatch log groups..."
for group in $(aws logs describe-log-groups \
  --region "$REGION" \
  --log-group-name-prefix "/mailforge/${ENVIRONMENT}/" \
  --query 'logGroups[].logGroupName' \
  --output text); do
  aws logs delete-log-group --log-group-name "$group" --region "$REGION"
done

echo "Removing matching queues and topics..."
for queue in $(aws sqs list-queues \
  --queue-name-prefix "$PREFIX" \
  --region "$REGION" \
  --query 'QueueUrls[]' \
  --output text); do
  aws sqs delete-queue --queue-url "$queue" --region "$REGION"
done
for topic in $(aws sns list-topics \
  --region "$REGION" \
  --query "Topics[?contains(TopicArn, \`:${PREFIX}\`)].TopicArn" \
  --output text); do
  aws sns delete-topic --topic-arn "$topic" --region "$REGION"
done

echo "Scheduling retained KMS keys for deletion..."
while read -r key; do
  [[ -n "$key" && "$key" != "None" ]] || continue
  aws kms schedule-key-deletion \
    --key-id "$key" \
    --pending-window-in-days 7 \
    --region "$REGION" >/dev/null 2>&1 || true
done <"$TMP_FILE"

echo "MailForge ${ENVIRONMENT} resources have been removed."
echo "Note: AWS will permanently delete retained KMS keys after the mandatory seven-day waiting period."
