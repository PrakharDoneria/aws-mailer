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
  const mailboxId =
    event.pathParameters?.mailboxId ||
    event.queryStringParameters?.mailboxId;

  if (!organizationId || !mailboxId) {
    throw new MailForgeError(
      ErrorCodes.INVALID_INPUT,
      "Organization ID and Mailbox ID required",
      400
    );
  }

  const limit = event.queryStringParameters?.limit
    ? parseInt(event.queryStringParameters.limit, 10)
    : 50;

  const service = new EmailService();
  const drafts = await service.getDrafts(organizationId, mailboxId, limit);

  return successResponse({
    items: drafts,
    total: drafts.length,
  });
});
