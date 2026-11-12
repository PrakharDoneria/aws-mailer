import { APIGatewayProxyResult } from "aws-lambda";
import { APIResponse, MailForgeError, ErrorCodes } from "@mailforge/shared";

export function successResponse<T>(
  data: T,
  statusCode: number = 200
): APIGatewayProxyResult {
  const response: APIResponse<T> = {
    success: true,
    data,
  };

  return {
    statusCode,
    body: JSON.stringify(response),
    headers: {
      "Content-Type": "application/json",
    },
  };
}

export function errorResponse(
  error: unknown,
  statusCode?: number
): APIGatewayProxyResult {
  let errorCode: (typeof ErrorCodes)[keyof typeof ErrorCodes] =
    ErrorCodes.INTERNAL_ERROR;
  let message = "Internal server error";
  let finalStatusCode = 500;

  if (error instanceof MailForgeError) {
    errorCode = error.code as (typeof ErrorCodes)[keyof typeof ErrorCodes];
    message = error.message;
    finalStatusCode = error.statusCode;
  } else if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === "string") {
    message = error;
  }

  if (statusCode) {
    finalStatusCode = statusCode;
  }

  const response: APIResponse<null> = {
    success: false,
    error: {
      code: errorCode,
      message,
    },
  };

  return {
    statusCode: finalStatusCode,
    body: JSON.stringify(response),
    headers: {
      "Content-Type": "application/json",
    },
  };
}

export function paginatedResponse<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number,
  statusCode: number = 200
): APIGatewayProxyResult {
  const response = {
    success: true,
    data: {
      items,
      total,
      page,
      pageSize,
      hasMore: page * pageSize < total,
    },
  };

  return {
    statusCode,
    body: JSON.stringify(response),
    headers: {
      "Content-Type": "application/json",
    },
  };
}
