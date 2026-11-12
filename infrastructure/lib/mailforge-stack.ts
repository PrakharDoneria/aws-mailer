import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { AuthenticationStack } from "./stacks/authentication-stack";
import { DatabaseStack } from "./stacks/database-stack";
import { StorageStack } from "./stacks/storage-stack";
import { ApiStack } from "./stacks/api-stack";
import { QueueStack } from "./stacks/queue-stack";
import { EmailStack } from "./stacks/email-stack";
import { EmailProcessingStack } from "./stacks/email-processing-stack";
import { FrontendStack } from "./stacks/frontend-stack";
import { MonitoringStack } from "./stacks/monitoring-stack";

export interface MailForgeStackProps extends cdk.StackProps {
  environment: string;
}

export class MailForgeStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: MailForgeStackProps) {
    super(scope, id, props);

    const environment = props.environment;

    // Order matters: dependencies first
    const authStack = new AuthenticationStack(this, "AuthStack", {
      environment,
    });

    const dbStack = new DatabaseStack(this, "DbStack", {
      environment,
    });

    const storageStack = new StorageStack(this, "StorageStack", {
      environment,
    });

    const queueStack = new QueueStack(this, "QueueStack", {
      environment,
    });

    const emailStack = new EmailStack(this, "EmailStack", {
      environment,
      s3Bucket: storageStack.emailBucket,
      sqsQueue: queueStack.inboundQueue,
    });

    const apiStack = new ApiStack(this, "ApiStack", {
      environment,
      userPool: authStack.userPool,
      userPoolClient: authStack.userPoolClient,
      dynamoDb: dbStack,
      storageStack,
      queueStack,
      emailStack,
    });

    const emailProcessingStack = new EmailProcessingStack(
      this,
      "EmailProcessingStack",
      {
        environment,
        dynamoDb: dbStack,
        storageStack,
        queueStack,
        emailStack,
      }
    );

    const frontendStack = new FrontendStack(this, "FrontendStack", {
      environment,
      apiEndpoint: apiStack.apiEndpoint,
      userPoolId: authStack.userPool.userPoolId,
      userPoolClientId: authStack.userPoolClient.userPoolClientId,
      bucket: storageStack.frontendBucket,
    });

    new MonitoringStack(this, "MonitoringStack", {
      environment,
    });

    // Outputs
    new cdk.CfnOutput(this, "UserPoolId", {
      value: authStack.userPool.userPoolId,
      description: "Cognito User Pool ID",
      exportName: `mailforge-${environment}-user-pool-id`,
    });

    new cdk.CfnOutput(this, "UserPoolClientId", {
      value: authStack.userPoolClient.userPoolClientId,
      description: "Cognito User Pool Client ID",
      exportName: `mailforge-${environment}-user-pool-client-id`,
    });

    new cdk.CfnOutput(this, "ApiEndpoint", {
      value: apiStack.apiEndpoint,
      description: "API Gateway endpoint",
      exportName: `mailforge-${environment}-api-endpoint`,
    });

    new cdk.CfnOutput(this, "WebsiteUrl", {
      value: `https://${frontendStack.distribution.domainName}`,
      description: "CloudFront distribution URL",
      exportName: `mailforge-${environment}-website-url`,
    });

    new cdk.CfnOutput(this, "FrontendBucketName", {
      value: frontendStack.bucket.bucketName,
      description: "S3 bucket for frontend assets",
      exportName: `mailforge-${environment}-frontend-bucket`,
    });

    new cdk.CfnOutput(this, "CloudFrontDistributionId", {
      value: frontendStack.distribution.distributionId,
      description: "CloudFront distribution ID",
      exportName: `mailforge-${environment}-cloudfront-distribution-id`,
    });

    new cdk.CfnOutput(this, "EmailBucket", {
      value: storageStack.emailBucket.bucketName,
      description: "S3 bucket for email storage",
      exportName: `mailforge-${environment}-email-bucket`,
    });

    new cdk.CfnOutput(this, "ConfigurationSetName", {
      value: emailStack.configurationSet.configurationSetName,
      description: "SES Configuration Set",
      exportName: `mailforge-${environment}-config-set`,
    });
  }
}
