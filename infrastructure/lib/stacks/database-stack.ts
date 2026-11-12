import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { Construct } from "constructs";

export interface DatabaseStackProps {
  environment: string;
}

export class DatabaseStack extends Construct {
  public readonly organizationsTable: dynamodb.Table;
  public readonly usersTable: dynamodb.Table;
  public readonly membershipsTable: dynamodb.Table;
  public readonly domainsTable: dynamodb.Table;
  public readonly mailboxesTable: dynamodb.Table;
  public readonly messagesTable: dynamodb.Table;
  public readonly attachmentsTable: dynamodb.Table;
  public readonly apiKeysTable: dynamodb.Table;
  public readonly webhooksTable: dynamodb.Table;
  public readonly webhookDeliveriesTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    super(scope, id);

    const billingMode = dynamodb.BillingMode.PAY_PER_REQUEST; // On-demand pricing

    // Organizations table
    this.organizationsTable = new dynamodb.Table(this, "Organizations", {
      tableName: `mailforge-${props.environment}-organizations`,
      partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
      billingMode,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecovery: true,
    });

    this.organizationsTable.addGlobalSecondaryIndex({
      indexName: "owner-index",
      partitionKey: { name: "ownerId", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Users table
    this.usersTable = new dynamodb.Table(this, "Users", {
      tableName: `mailforge-${props.environment}-users`,
      partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
      billingMode,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecovery: true,
    });

    this.usersTable.addGlobalSecondaryIndex({
      indexName: "email-index",
      partitionKey: { name: "email", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Organization Memberships table
    this.membershipsTable = new dynamodb.Table(this, "Memberships", {
      tableName: `mailforge-${props.environment}-memberships`,
      partitionKey: {
        name: "organizationId",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      billingMode,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Domains table
    this.domainsTable = new dynamodb.Table(this, "Domains", {
      tableName: `mailforge-${props.environment}-domains`,
      partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
      billingMode,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecovery: true,
    });

    this.domainsTable.addGlobalSecondaryIndex({
      indexName: "org-domain-index",
      partitionKey: {
        name: "organizationId",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: { name: "domainName", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.domainsTable.addGlobalSecondaryIndex({
      indexName: "domain-name-index",
      partitionKey: {
        name: "domainName",
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Mailboxes table
    this.mailboxesTable = new dynamodb.Table(this, "Mailboxes", {
      tableName: `mailforge-${props.environment}-mailboxes`,
      partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
      billingMode,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecovery: true,
    });

    this.mailboxesTable.addGlobalSecondaryIndex({
      indexName: "org-mailbox-index",
      partitionKey: {
        name: "organizationId",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: { name: "localPart", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Messages table (complex access patterns)
    this.messagesTable = new dynamodb.Table(this, "Messages", {
      tableName: `mailforge-${props.environment}-messages`,
      partitionKey: {
        name: "mailboxId",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: { name: "createdAt", type: dynamodb.AttributeType.NUMBER },
      billingMode,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecovery: true,
    });

    this.messagesTable.addGlobalSecondaryIndex({
      indexName: "org-message-index",
      partitionKey: {
        name: "organizationId",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: { name: "createdAt", type: dynamodb.AttributeType.NUMBER },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.messagesTable.addGlobalSecondaryIndex({
      indexName: "message-id-index",
      partitionKey: { name: "messageId", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Attachments table
    this.attachmentsTable = new dynamodb.Table(this, "Attachments", {
      tableName: `mailforge-${props.environment}-attachments`,
      partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
      billingMode,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // API Keys table
    this.apiKeysTable = new dynamodb.Table(this, "APIKeys", {
      tableName: `mailforge-${props.environment}-api-keys`,
      partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
      billingMode,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    this.apiKeysTable.addGlobalSecondaryIndex({
      indexName: "key-hash-index",
      partitionKey: {
        name: "keyHash",
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.apiKeysTable.addGlobalSecondaryIndex({
      indexName: "org-key-index",
      partitionKey: {
        name: "organizationId",
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Webhooks table
    this.webhooksTable = new dynamodb.Table(this, "Webhooks", {
      tableName: `mailforge-${props.environment}-webhooks`,
      partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
      billingMode,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    this.webhooksTable.addGlobalSecondaryIndex({
      indexName: "org-webhook-index",
      partitionKey: {
        name: "organizationId",
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Webhook Deliveries table
    this.webhookDeliveriesTable = new dynamodb.Table(
      this,
      "WebhookDeliveries",
      {
        tableName: `mailforge-${props.environment}-webhook-deliveries`,
        partitionKey: {
          name: "webhookId",
          type: dynamodb.AttributeType.STRING,
        },
        sortKey: { name: "createdAt", type: dynamodb.AttributeType.NUMBER },
        billingMode,
        removalPolicy: cdk.RemovalPolicy.RETAIN,
        timeToLiveAttribute: "expiresAt",
      }
    );
  }
}
