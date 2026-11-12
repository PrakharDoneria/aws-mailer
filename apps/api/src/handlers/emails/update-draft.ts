import { withErrorHandling } from "../../utils/error-handling";
import { successResponse } from "../../utils/response";
import { extractAuthContext } from "../../utils/auth";
import { EmailService } from "../../services/email-service";
import { CreateDraftSchema } from "@mailforge/validation";
import { MailForgeError, ErrorCodes } from "@mailforge/shared";

export const handler = withErrorHandling(async (event) => {
  const auth = extractAuthContext(event);
  const organizationId = event.pathParameters?.organizationId;
  const draftId = event.pathParameters?.draftId;

  if (!organizationId || !draftId) {
    throw new MailForgeError(
      ErrorCodes.INVALID_INPUT,
      "Organization ID and Draft ID required",
      400
    );
  }

  if (!event.body) {
    throw new Error("Request body required");
  }

  const input = CreateDraftSchema.partial().parse(JSON.parse(event.body));
  const service = new EmailService();

  const draft = await service.updateDraft(organizationId, draftId, input);

  return successResponse(draft);
});
