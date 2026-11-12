#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { MailForgeStack } from "../lib/mailforge-stack";

const app = new cdk.App();

const environment = app.node.tryGetContext("environment") || "dev";

new MailForgeStack(app, `MailForgeStack-${environment}`, {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || "us-east-1",
  },
  environment,
  stackName: `mailforge-${environment}`,
});
