import { APIGatewayProxyEvent, APIGatewayProxyHandler, APIGatewayProxyResult } from "aws-lambda";
import { errorResponse } from "./response";
import { MailForgeError } from "@mailforge/shared";

export function withErrorHandling(
  handler: APIGatewayProxyHandler
): APIGatewayProxyHandler {
  return async (event, context) => {
    try {
      console.log("Incoming request:", {
        method: event.httpMethod,
        path: event.path,
        userId: event.requestContext.authorizer?.claims?.sub,
      });

      const response = await handler(event, context);
      return response;
    } catch (error) {
      console.error("Handler error:", error);

      if (error instanceof MailForgeError) {
        return errorResponse(error, error.statusCode);
      }

      if (error instanceof SyntaxError) {
        return errorResponse(error, 400);
      }

      return errorResponse(error, 500);
    }
  };
}

export function withValidation(
  schema: any,
  source: "body" | "query" | "path" = "body"
) {
  return (handler: APIGatewayProxyHandler): APIGatewayProxyHandler => {
    return async (event, context) => {
      try {
        let data: any;

        if (source === "body") {
          if (!event.body) {
            throw new Error("Request body is required");
          }
          data = JSON.parse(event.body);
        } else if (source === "query") {
          data = event.queryStringParameters || {};
        } else if (source === "path") {
          data = event.pathParameters || {};
        }

        const validated = schema.parse(data);

        // Inject validated data into event
        (event as any).validated = validated;

        return handler(event, context);
      } catch (error) {
        if (error instanceof MailForgeError) {
          return errorResponse(error);
        }
        return errorResponse(new Error("Validation failed"), 400);
      }
    };
  };
}
