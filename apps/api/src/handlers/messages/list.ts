import { withErrorHandling } from "../../utils/error-handling";
import { paginatedResponse } from "../../utils/response";
import { extractAuthContext } from "../../utils/auth";
import { MessageRepository } from "../../repositories/message-repository";
import { MailForgeError, ErrorCodes } from "@mailforge/shared";

export const handler = withErrorHandling(async (event) => {
  extractAuthContext(event);
  const mailboxId = event.queryStringParameters?.mailboxId;

  if (!mailboxId) {
    throw new MailForgeError(
      ErrorCodes.INVALID_INPUT,
      "mailboxId query parameter is required",
      400
    );
  }

  const messageRepo = new MessageRepository();
  const limit = Math.min(
    parseInt(event.queryStringParameters?.limit || "50", 10),
    100
  );

  const { items, lastKey } = await messageRepo.getMailboxMessages(
    mailboxId,
    limit
  );

  return paginatedResponse(items, items.length, 1, limit, 200);
});
