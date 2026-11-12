import { withErrorHandling } from "../../utils/error-handling";
import { paginatedResponse } from "../../utils/response";
import { extractAuthContext } from "../../utils/auth";
import { MailboxService } from "../../services/mailbox-service";
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

  const service = new MailboxService();
  const mailboxes = await service.getOrganizationMailboxes(organizationId);

  return paginatedResponse(mailboxes, mailboxes.length, 1, 50);
});
