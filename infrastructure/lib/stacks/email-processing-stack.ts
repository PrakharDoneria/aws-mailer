import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as sns from "aws-cdk-lib/aws-sns";
import * as logs from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";
import { DatabaseStack } from "./database-stack";
import { StorageStack } from "./storage-stack";
import { QueueStack } from "./queue-stack";
import { EmailStack } from "./email-stack";
import * as path from "path";

export interface EmailProcessingStackProps {
  environment: string;
  dynamoDb: DatabaseStack;
  storageStack: StorageStack;
  queueStack: QueueStack;
  emailStack: EmailStack;
}

export class EmailProcessingStack extends Construct {
  public readonly inboundProcessorFunction: lambda.Function;
  public readonly outboundSenderFunction: lambda.Function;
  public readonly webhookDispatcherFunction: lambda.Function;

  constructor(
    scope: Construct,
    id: string,
    props: EmailProcessingStackProps
  ) {
    super(scope, id);

    // Create IAM role for email processing Lambda functions
    const lambdaRole = new iam.Role(this, "EmailProcessingRole", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AWSLambdaBasicExecutionRole"
        ),
      ],
    });

    // Grant DynamoDB permissions
    props.dynamoDb.organizationsTable.grantReadWriteData(lambdaRole);
    props.dynamoDb.domainsTable.grantReadWriteData(lambdaRole);
    props.dynamoDb.mailboxesTable.grantReadWriteData(lambdaRole);
    props.dynamoDb.messagesTable.grantReadWriteData(lambdaRole);
    props.dynamoDb.attachmentsTable.grantReadWriteData(lambdaRole);
    props.dynamoDb.webhooksTable.grantReadWriteData(lambdaRole);
    props.dynamoDb.webhookDeliveriesTable.grantReadWriteData(lambdaRole);

    // Grant S3 permissions
    props.storageStack.emailBucket.grantReadWrite(lambdaRole);
    props.storageStack.attachmentsBucket.grantReadWrite(lambdaRole);

    // Grant SQS permissions
    props.queueStack.inboundQueue.grantConsumeMessages(lambdaRole);
    props.queueStack.outboundQueue.grantConsumeMessages(lambdaRole);
    props.queueStack.webhookQueue.grantConsumeMessages(lambdaRole);
    props.queueStack.inboundQueue.grantSendMessages(lambdaRole);
    props.queueStack.outboundQueue.grantSendMessages(lambdaRole);
    props.queueStack.webhookQueue.grantSendMessages(lambdaRole);

    // Grant KMS permissions
    props.storageStack.encryptionKey.grantEncryptDecrypt(lambdaRole);
    props.queueStack.encryptionKey.grantEncryptDecrypt(lambdaRole);

    // Grant SES permissions
    lambdaRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: [
          "ses:SendEmail",
          "ses:SendRawEmail",
          "ses:GetAccountSendingEnabled",
          "ses:GetSendQuota",
        ],
        resources: ["*"],
      })
    );

    // Inbound email processor
    this.inboundProcessorFunction = new lambda.Function(
      this,
      "InboundProcessor",
      {
        runtime: lambda.Runtime.NODEJS_22_X,
        handler: "index.handler",
        code: lambda.Code.fromAsset(
          path.join(
            __dirname,
            "../../../apps/lambda/inbound-processor/dist"
          )
        ),
        timeout: cdk.Duration.seconds(60),
        memorySize: 1024,
        role: lambdaRole,
        reservedConcurrentExecutions: 100,
        environment: {
          ENVIRONMENT: props.environment,
          ORGANIZATIONS_TABLE: props.dynamoDb.organizationsTable.tableName,
          DOMAINS_TABLE: props.dynamoDb.domainsTable.tableName,
          MAILBOXES_TABLE: props.dynamoDb.mailboxesTable.tableName,
          MESSAGES_TABLE: props.dynamoDb.messagesTable.tableName,
          ATTACHMENTS_TABLE: props.dynamoDb.attachmentsTable.tableName,
          EMAIL_BUCKET: props.storageStack.emailBucket.bucketName,
          ATTACHMENTS_BUCKET:
            props.storageStack.attachmentsBucket.bucketName,
          WEBHOOK_QUEUE_URL: props.queueStack.webhookQueue.queueUrl,
        },
      }
    );

    // Trigger inbound processor from SQS
    this.inboundProcessorFunction.addEventSource(
      new (require("aws-cdk-lib/aws-lambda-event-sources").SqsEventSource)(
        props.queueStack.inboundQueue,
        {
          batchSize: 10,
          maxConcurrency: 10,
        }
      )
    );

    // Outbound email sender
    this.outboundSenderFunction = new lambda.Function(
      this,
      "OutboundSender",
      {
        runtime: lambda.Runtime.NODEJS_22_X,
        handler: "index.handler",
        code: lambda.Code.fromAsset(
          path.join(
            __dirname,
            "../../../apps/lambda/outbound-sender/dist"
          )
        ),
        timeout: cdk.Duration.seconds(30),
        memorySize: 512,
        role: lambdaRole,
        reservedConcurrentExecutions: 50,
        environment: {
          ENVIRONMENT: props.environment,
          ORGANIZATIONS_TABLE: props.dynamoDb.organizationsTable.tableName,
          MAILBOXES_TABLE: props.dynamoDb.mailboxesTable.tableName,
          MESSAGES_TABLE: props.dynamoDb.messagesTable.tableName,
          ATTACHMENTS_BUCKET:
            props.storageStack.attachmentsBucket.bucketName,
          CONFIGURATION_SET: props.emailStack.configurationSet
            .configurationSetName,
        },
      }
    );

    // Trigger outbound sender from SQS
    this.outboundSenderFunction.addEventSource(
      new (require("aws-cdk-lib/aws-lambda-event-sources").SqsEventSource)(
        props.queueStack.outboundQueue,
        {
          batchSize: 5,
          maxConcurrency: 5,
        }
      )
    );

    // SES event processor (handles bounce, complaint, delivery events from SNS)
    const sesEventProcessorFunction = new lambda.Function(
      this,
      "SESEventProcessor",
      {
        runtime: lambda.Runtime.NODEJS_22_X,
        handler: "index.handler",
        code: lambda.Code.fromAsset(
          path.join(
            __dirname,
            "../../../apps/lambda/ses-event-processor/dist"
          )
        ),
        timeout: cdk.Duration.seconds(30),
        memorySize: 512,
        role: lambdaRole,
        environment: {
          ENVIRONMENT: props.environment,
          MESSAGES_TABLE: props.dynamoDb.messagesTable.tableName,
          WEBHOOK_QUEUE_URL: props.queueStack.webhookQueue.queueUrl,
        },
      }
    );

    // Subscribe SES event processor to SNS topic from Email Stack
    props.emailStack.eventTopic.addSubscription(
      new (require("aws-cdk-lib/aws-sns-subscriptions").LambdaSubscription)(
        sesEventProcessorFunction
      )
    );

    // Webhook dispatcher
    this.webhookDispatcherFunction = new lambda.Function(
      this,
      "WebhookDispatcher",
      {
        runtime: lambda.Runtime.NODEJS_22_X,
        handler: "index.handler",
        code: lambda.Code.fromAsset(
          path.join(
            __dirname,
            "../../../apps/lambda/webhook-dispatcher/dist"
          )
        ),
        timeout: cdk.Duration.seconds(60),
        memorySize: 256,
        role: lambdaRole,
        reservedConcurrentExecutions: 50,
        environment: {
          ENVIRONMENT: props.environment,
          WEBHOOKS_TABLE: props.dynamoDb.webhooksTable.tableName,
          WEBHOOK_DELIVERIES_TABLE:
            props.dynamoDb.webhookDeliveriesTable.tableName,
          MAX_RETRIES: "5",
        },
      }
    );

    // Trigger webhook dispatcher from SQS
    this.webhookDispatcherFunction.addEventSource(
      new (require("aws-cdk-lib/aws-lambda-event-sources").SqsEventSource)(
        props.queueStack.webhookQueue,
        {
          batchSize: 10,
          maxConcurrency: 10,
        }
      )
    );

    // CloudWatch log groups
    new logs.LogGroup(this, "InboundProcessorLogGroup", {
      logGroupName: `/mailforge/${props.environment}/inbound-processor`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    new logs.LogGroup(this, "OutboundSenderLogGroup", {
      logGroupName: `/mailforge/${props.environment}/outbound-sender`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    new logs.LogGroup(this, "SESEventProcessorLogGroup", {
      logGroupName: `/mailforge/${props.environment}/ses-event-processor`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    new logs.LogGroup(this, "WebhookDispatcherLogGroup", {
      logGroupName: `/mailforge/${props.environment}/webhook-dispatcher`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Outputs
    new cdk.CfnOutput(this, "InboundProcessorFunctionName", {
      value: this.inboundProcessorFunction.functionName,
      description: "Inbound email processor function",
    });

    new cdk.CfnOutput(this, "OutboundSenderFunctionName", {
      value: this.outboundSenderFunction.functionName,
      description: "Outbound email sender function",
    });

    new cdk.CfnOutput(this, "WebhookDispatcherFunctionName", {
      value: this.webhookDispatcherFunction.functionName,
      description: "Webhook dispatcher function",
    });
  }
}
