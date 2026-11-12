import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as kms from "aws-cdk-lib/aws-kms";
import { Construct } from "constructs";

export interface StorageStackProps {
  environment: string;
}

export class StorageStack extends Construct {
  public readonly emailBucket: s3.Bucket;
  public readonly attachmentsBucket: s3.Bucket;
  public readonly frontendBucket: s3.Bucket;
  public readonly encryptionKey: kms.Key;

  constructor(scope: Construct, id: string, props: StorageStackProps) {
    super(scope, id);

    // Create KMS key for encryption
    this.encryptionKey = new kms.Key(this, "EncryptionKey", {
      description: "KMS key for MailForge encryption",
      enableKeyRotation: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Email storage bucket (raw MIME messages)
    this.emailBucket = new s3.Bucket(this, "EmailBucket", {
      bucketName: `mailforge-${props.environment}-emails-${cdk.Stack.of(this).account}`,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: this.encryptionKey,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          expiration: cdk.Duration.days(90), // Archive after 90 days
        },
      ],
    });

    // Attachments storage bucket
    this.attachmentsBucket = new s3.Bucket(this, "AttachmentsBucket", {
      bucketName: `mailforge-${props.environment}-attachments-${cdk.Stack.of(this).account}`,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: this.encryptionKey,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          expiration: cdk.Duration.days(365), // Keep attachments for 1 year
        },
      ],
    });

    // Frontend hosting bucket
    this.frontendBucket = new s3.Bucket(this, "FrontendBucket", {
      bucketName: `mailforge-${props.environment}-frontend-${cdk.Stack.of(this).account}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
  }
}
