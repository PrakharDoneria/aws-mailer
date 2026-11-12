import * as cdk from "aws-cdk-lib";
import * as cognito from "aws-cdk-lib/aws-cognito";
import { Construct } from "constructs";

export interface AuthenticationStackProps {
  environment: string;
}

export class AuthenticationStack extends Construct {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props: AuthenticationStackProps) {
    super(scope, id);

    // Create Cognito User Pool
    this.userPool = new cognito.UserPool(this, "UserPool", {
      userPoolName: `mailforge-${props.environment}`,
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      autoVerify: {
        email: true,
      },
      mfa: cognito.Mfa.OPTIONAL,
      mfaSecondFactor: {
        sms: true,
        otp: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_AND_PHONE_WITHOUT_MFA,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Create User Pool Client
    this.userPoolClient = new cognito.UserPoolClient(
      this,
      "UserPoolClient",
      {
        userPool: this.userPool,
        userPoolClientName: `mailforge-${props.environment}-client`,
        generateSecret: false,
        authFlows: {
          userPassword: true,
          adminUserPassword: true,
          userSrp: true,
        },
        oAuth: {
          flows: {
            authorizationCodeGrant: true,
          },
          scopes: [cognito.OAuthScope.EMAIL, cognito.OAuthScope.OPENID],
          callbackUrls: [
            `http://localhost:3000/auth/callback`,
            `https://localhost:3000/auth/callback`,
          ],
          logoutUrls: [
            `http://localhost:3000/auth/logout`,
            `https://localhost:3000/auth/logout`,
          ],
        },
        preventUserExistenceErrors: true,
        enableTokenRevocation: true,
      }
    );
  }
}
