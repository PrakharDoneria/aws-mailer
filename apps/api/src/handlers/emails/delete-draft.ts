import { withErrorHandling } from "../../utils/error-handling";
import { successResponse } from "../../utils/response";
import { extractAuthContext } from "../../utils/auth";
import { EmailService } from "../../services/email-service";
import { MailForgeError, ErrorCodes } from "@mailforge/shared";

export const handler = withErrorHandling(async (event) => {
  const auth = extractAuthContext(event);
  const organizationId =
    event.pathParameters?.organizationId ||
    event.queryStringParameters?.organizationId;
  const draftId =
    event.pathParameters?.draftId ||
    event.queryStringParameters?.draftId;

  if (!organizationId || !draftId) {
    throw new MailForgeError(
      ErrorCodes.INVALID_INPUT,
      "Organization ID and Draft ID required",
      400
    );
  }

  const service = new EmailService();
  await service.deleteDraft(organizationId, draftId);

  return successResponse(null, 204);
});
