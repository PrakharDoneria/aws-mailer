import * as cdk from "aws-cdk-lib";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as logs from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";

export interface MonitoringStackProps {
  environment: string;
}

export class MonitoringStack extends Construct {
  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id);

    // Create CloudWatch log groups
    const apiLogGroup = new logs.LogGroup(this, "ApiLogGroup", {
      logGroupName: `/mailforge/${props.environment}/api`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const lambdaLogGroup = new logs.LogGroup(this, "LambdaLogGroup", {
      logGroupName: `/mailforge/${props.environment}/lambda`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Create CloudWatch dashboard
    const dashboard = new cloudwatch.Dashboard(this, "Dashboard", {
      dashboardName: `mailforge-${props.environment}`,
    });

    // Add widgets to dashboard
    dashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: `# MailForge ${props.environment.toUpperCase()} Dashboard`,
        height: 1,
        width: 24,
      })
    );

    new cdk.CfnOutput(this, "DashboardUrl", {
      value: `https://console.aws.amazon.com/cloudwatch/home#dashboards:name=mailforge-${props.environment}`,
      description: "CloudWatch Dashboard URL",
    });
  }
}
