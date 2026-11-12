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

    // Import or create CloudWatch log groups (import-safe: won't fail if they
    // already exist from a previous partial deployment).
    const apiLogGroup = logs.LogGroup.fromLogGroupName(
      this,
      "ApiLogGroup",
      `/mailforge/${props.environment}/api`
    );

    const lambdaLogGroup = logs.LogGroup.fromLogGroupName(
      this,
      "LambdaLogGroup",
      `/mailforge/${props.environment}/lambda`
    );

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
