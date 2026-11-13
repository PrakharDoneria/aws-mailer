import { withErrorHandling } from "../../utils/error-handling";
import { successResponse } from "../../utils/response";
import { extractAuthContext } from "../../utils/auth";
import { EmailService } from "../../services/email-service";
import { SendEmailSchema } from "@mailforge/validation";
import { MailForgeError, ErrorCodes } from "@mailforge/shared";

export const handler = withErrorHandling(async (event) => {
  const auth = extractAuthContext(event);
  let organizationId =
    event.pathParameters?.organizationId ||
    event.queryStringParameters?.organizationId;

  if (!event.body) {
    throw new Error("Request body required");
  }

  const parsedBody = JSON.parse(event.body);
  if (!organizationId && parsedBody.organizationId) {
    organizationId = parsedBody.organizationId;
  }

  // Normalize text / body into textBody and html / content into htmlBody
  if (!parsedBody.textBody && parsedBody.text) {
    parsedBody.textBody = parsedBody.text;
  }
  if (!parsedBody.textBody && parsedBody.body) {
    parsedBody.textBody = parsedBody.body;
  }
  if (!parsedBody.htmlBody && parsedBody.html) {
    parsedBody.htmlBody = parsedBody.html;
  }

  if (!organizationId) {
    throw new MailForgeError(
      ErrorCodes.INVALID_INPUT,
      "Organization ID required (in path, query, or body)",
      400
    );
  }

  const input = SendEmailSchema.parse(parsedBody);
  const service = new EmailService();

  const message = await service.sendEmail(organizationId, input);

  return successResponse(message, 202); // 202 Accepted - email is queued
});
