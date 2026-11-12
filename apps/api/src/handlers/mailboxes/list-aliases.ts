import { withErrorHandling } from "../../utils/error-handling";
import { paginatedResponse } from "../../utils/response";
import { extractAuthContext } from "../../utils/auth";
import { MailboxService } from "../../services/mailbox-service";
import { MailForgeError, ErrorCodes } from "@mailforge/shared";

export const handler = withErrorHandling(async (event) => {
  const auth = extractAuthContext(event);
  const mailboxId = event.pathParameters?.id;

  if (!mailboxId) {
    throw new MailForgeError(
      ErrorCodes.INVALID_INPUT,
      "Mailbox ID required",
      400
    );
  }

  const service = new MailboxService();
  const aliases = await service.getMailboxAliases(mailboxId);

  return paginatedResponse(aliases, aliases.length, 1, 50);
});
