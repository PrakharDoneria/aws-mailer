import { APIGatewayProxyEvent, APIGatewayProxyHandler } from "aws-lambda";
import { MailForgeError, ErrorCodes } from "@mailforge/shared";

export interface AuthContext {
  userId: string;
  email: string;
  organizationId?: string;
  role?: string;
  sub: string;
}

export function extractAuthContext(event: APIGatewayProxyEvent): AuthContext {
  const authorizer = event.requestContext.authorizer as any;

  if (!authorizer) {
    throw new MailForgeError(
      ErrorCodes.UNAUTHORIZED,
      "Missing authorization",
      401
    );
  }

  const claims = authorizer.claims || authorizer;
  const userId = claims.sub || claims.userId;
  const email = claims.email;
  const organizationId = claims["custom:organization_id"];

  if (!userId || !email) {
    throw new MailForgeError(
      ErrorCodes.UNAUTHORIZED,
      "Invalid authorization token",
      401
    );
  }

  return {
    userId,
    email,
    organizationId,
    sub: userId,
  };
}

export function withAuth(
  handler: (
    event: APIGatewayProxyEvent,
    context: any,
    auth: AuthContext
  ) => Promise<any>
): APIGatewayProxyHandler {
  return async (event, context) => {
    const auth = extractAuthContext(event);
    return handler(event, context, auth);
  };
}

export interface APIKeyAuthContext {
  organizationId: string;
  keyId: string;
  permissions: string[];
}

export function extractAPIKeyFromHeader(event: APIGatewayProxyEvent): string {
  const authHeader = event.headers["Authorization"] || event.headers["authorization"];

  if (!authHeader) {
    throw new MailForgeError(
      ErrorCodes.INVALID_API_KEY,
      "Missing API key",
      401
    );
  }

  const [scheme, credentials] = authHeader.split(" ");

  if (scheme !== "Bearer" && scheme !== "ApiKey") {
    throw new MailForgeError(
      ErrorCodes.INVALID_API_KEY,
      "Invalid authorization scheme",
      401
    );
  }

  return credentials;
}

export function withAPIKeyAuth(
  handler: (
    event: APIGatewayProxyEvent,
    context: any,
    auth: APIKeyAuthContext
  ) => Promise<any>
): APIGatewayProxyHandler {
  return async (event, context) => {
    const apiKey = extractAPIKeyFromHeader(event);
    // In real implementation, verify key against database
    // For now, this is a placeholder
    const auth: APIKeyAuthContext = {
      organizationId: "",
      keyId: "",
      permissions: [],
    };
    return handler(event, context, auth);
  };
}

export function requireRole(...roles: string[]) {
  return (auth: AuthContext) => {
    if (!auth.role || !roles.includes(auth.role)) {
      throw new MailForgeError(
        ErrorCodes.FORBIDDEN,
        "Insufficient permissions",
        403
      );
    }
  };
}

export function requirePermission(...permissions: string[]) {
  return (auth: APIKeyAuthContext) => {
    const hasPermission = permissions.some((p) =>
      auth.permissions.includes(p)
    );
    if (!hasPermission) {
      throw new MailForgeError(
        ErrorCodes.FORBIDDEN,
        "Insufficient permissions",
        403
      );
    }
  };
}
