import { withErrorHandling } from "../../utils/error-handling";
import { successResponse } from "../../utils/response";
import { extractAuthContext } from "../../utils/auth";
import { EmailService } from "../../services/email-service";
import { SendEmailSchema } from "@mailforge/validation";
import { MailForgeError, ErrorCodes } from "@mailforge/shared";

export const handler = withErrorHandling(async (event) => {
  const auth = extractAuthContext(event);
  const organizationId = event.pathParameters?.organizationId;

  if (!organizationId) {
    throw new MailForgeError(ErrorCodes.INVALID_INPUT, "Organization ID required", 400);
  }

  if (!event.body) {
    throw new Error("Request body required");
  }

  const input = SendEmailSchema.parse(JSON.parse(event.body));
  const service = new EmailService();

  const message = await service.sendEmail(organizationId, input);

  return successResponse(message, 202); // 202 Accepted - email is queued
});
