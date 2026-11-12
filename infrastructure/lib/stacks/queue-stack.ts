import * as cdk from "aws-cdk-lib";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as kms from "aws-cdk-lib/aws-kms";
import { Construct } from "constructs";
import { SQS_VISIBILITY_TIMEOUT } from "@mailforge/shared";

export interface QueueStackProps {
  environment: string;
}

export class QueueStack extends Construct {
  public readonly inboundQueue: sqs.Queue;
  public readonly inboundDLQ: sqs.Queue;
  public readonly outboundQueue: sqs.Queue;
  public readonly outboundDLQ: sqs.Queue;
  public readonly webhookQueue: sqs.Queue;
  public readonly webhookDLQ: sqs.Queue;
  public readonly encryptionKey: kms.Key;

  constructor(scope: Construct, id: string, props: QueueStackProps) {
    super(scope, id);

    // Create KMS key for queue encryption
    this.encryptionKey = new kms.Key(this, "QueueEncryptionKey", {
      description: "KMS key for MailForge SQS queues",
      enableKeyRotation: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Inbound email DLQ
    this.inboundDLQ = new sqs.Queue(this, "InboundDLQ", {
      queueName: `mailforge-${props.environment}-inbound-dlq`,
      encryption: sqs.QueueEncryption.KMS,
      encryptionMasterKey: this.encryptionKey,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      retentionPeriod: cdk.Duration.days(14),
    });

    // Inbound email queue
    this.inboundQueue = new sqs.Queue(this, "InboundQueue", {
      queueName: `mailforge-${props.environment}-inbound`,
      visibilityTimeout: cdk.Duration.seconds(SQS_VISIBILITY_TIMEOUT),
      encryption: sqs.QueueEncryption.KMS,
      encryptionMasterKey: this.encryptionKey,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      deadLetterQueue: {
        queue: this.inboundDLQ,
        maxReceiveCount: 3,
      },
      retentionPeriod: cdk.Duration.days(14),
    });

    // Outbound email DLQ
    this.outboundDLQ = new sqs.Queue(this, "OutboundDLQ", {
      queueName: `mailforge-${props.environment}-outbound-dlq`,
      encryption: sqs.QueueEncryption.KMS,
      encryptionMasterKey: this.encryptionKey,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      retentionPeriod: cdk.Duration.days(14),
    });

    // Outbound email queue
    this.outboundQueue = new sqs.Queue(this, "OutboundQueue", {
      queueName: `mailforge-${props.environment}-outbound`,
      visibilityTimeout: cdk.Duration.seconds(SQS_VISIBILITY_TIMEOUT),
      encryption: sqs.QueueEncryption.KMS,
      encryptionMasterKey: this.encryptionKey,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      deadLetterQueue: {
        queue: this.outboundDLQ,
        maxReceiveCount: 3,
      },
      retentionPeriod: cdk.Duration.days(14),
    });

    // Webhook DLQ
    this.webhookDLQ = new sqs.Queue(this, "WebhookDLQ", {
      queueName: `mailforge-${props.environment}-webhook-dlq`,
      encryption: sqs.QueueEncryption.KMS,
      encryptionMasterKey: this.encryptionKey,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      retentionPeriod: cdk.Duration.days(14),
    });

    // Webhook delivery queue
    this.webhookQueue = new sqs.Queue(this, "WebhookQueue", {
      queueName: `mailforge-${props.environment}-webhooks`,
      visibilityTimeout: cdk.Duration.seconds(SQS_VISIBILITY_TIMEOUT),
      encryption: sqs.QueueEncryption.KMS,
      encryptionMasterKey: this.encryptionKey,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      deadLetterQueue: {
        queue: this.webhookDLQ,
        maxReceiveCount: 3,
      },
      retentionPeriod: cdk.Duration.days(14),
    });
  }
}
