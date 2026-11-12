import * as cdk from "aws-cdk-lib";
import * as ses from "aws-cdk-lib/aws-ses";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as sns from "aws-cdk-lib/aws-sns";
import * as subscriptions from "aws-cdk-lib/aws-sns-subscriptions";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import { Construct } from "constructs";
import { SES_REGION } from "@mailforge/shared";

export interface EmailStackProps {
  environment: string;
  s3Bucket: s3.Bucket;
  sqsQueue: sqs.Queue;
}

export class EmailStack extends Construct {
  public readonly configurationSet: ses.ConfigurationSet;
  public readonly sesRole: iam.Role;
  public readonly eventTopic: sns.Topic;

  constructor(scope: Construct, id: string, props: EmailStackProps) {
    super(scope, id);

    // Create SES Configuration Set for tracking deliveries
    this.configurationSet = new ses.ConfigurationSet(this, "ConfigSet", {
      configurationSetName: `mailforge-${props.environment}`,
    });

    // Create SNS topic for SES events
    this.eventTopic = new sns.Topic(this, "SESEventTopic", {
      topicName: `mailforge-${props.environment}-ses-events`,
      displayName: "MailForge SES Events",
    });

    // Subscribe SQS queue to SNS topic for inbound events
    this.eventTopic.addSubscription(
      new subscriptions.SqsSubscription(props.sqsQueue)
    );

    // Create IAM role for SES to publish to SNS
    this.sesRole = new iam.Role(this, "SESRole", {
      assumedBy: new iam.ServicePrincipal("ses.amazonaws.com"),
      inlinePolicies: {
        SESSendPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: ["ses:SendEmail", "ses:SendRawEmail"],
              resources: ["*"],
            }),
            new iam.PolicyStatement({
              actions: ["sns:Publish"],
              resources: [this.eventTopic.topicArn],
            }),
          ],
        }),
      },
    });

    // Note: SES receipt rules configuration requires manual setup or custom resource
    // This is because CDK doesn't fully support SES receipt rules yet
    // TODO: Use custom resource to:
    // 1. Create receipt rule set
    // 2. Add rule for domain(s)
    // 3. Store raw email in S3
    // 4. Publish to SNS

    new cdk.CfnOutput(this, "ConfigurationSetName", {
      value: this.configurationSet.configurationSetName,
      description: "SES Configuration Set Name",
    });

    new cdk.CfnOutput(this, "SNSTopicArn", {
      value: this.eventTopic.topicArn,
      description: "SNS Topic for SES Events",
    });
  }
}
