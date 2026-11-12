import { withErrorHandling } from "../../utils/error-handling";
import { successResponse } from "../../utils/response";
import { extractAuthContext } from "../../utils/auth";
import { MailboxService } from "../../services/mailbox-service";
import { CreateMailboxSchema } from "@mailforge/validation";
import { MailForgeError, ErrorCodes } from "@mailforge/shared";

export const handler = withErrorHandling(async (event) => {
  const auth = extractAuthContext(event);
  const organizationId = event.pathParameters?.organizationId;

  if (!organizationId) {
    throw new MailForgeError(
      ErrorCodes.INVALID_INPUT,
      "Organization ID required",
      400
    );
  }

  if (!event.body) {
    throw new Error("Request body required");
  }

  const input = CreateMailboxSchema.parse(JSON.parse(event.body));
  const service = new MailboxService();

  const mailbox = await service.createMailbox(organizationId, input);

  return successResponse(mailbox, 201);
});
