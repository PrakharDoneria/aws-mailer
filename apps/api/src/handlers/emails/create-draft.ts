import { withErrorHandling } from "../../utils/error-handling";
import { successResponse } from "../../utils/response";
import { extractAuthContext } from "../../utils/auth";
import { EmailService } from "../../services/email-service";
import { CreateDraftSchema } from "@mailforge/validation";
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

  if (!organizationId) {
    throw new MailForgeError(
      ErrorCodes.INVALID_INPUT,
      "Organization ID required",
      400
    );
  }

  const input = CreateDraftSchema.parse(parsedBody);
  const service = new EmailService();

  const draft = await service.createDraft(organizationId, input);

  return successResponse(draft, 201);
});
