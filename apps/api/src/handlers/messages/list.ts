import { withErrorHandling } from "../../utils/error-handling";
import { paginatedResponse } from "../../utils/response";
import { extractAuthContext } from "../../utils/auth";
import { MessageRepository } from "../../repositories/message-repository";
import { MailForgeError, ErrorCodes } from "@mailforge/shared";

export const handler = withErrorHandling(async (event) => {
  extractAuthContext(event);
  const mailboxId = event.queryStringParameters?.mailboxId;
  const organizationId = event.queryStringParameters?.organizationId;

  const messageRepo = new MessageRepository();
  const limit = Math.min(
    parseInt(event.queryStringParameters?.limit || "50", 10),
    100
  );

  if (mailboxId) {
    const { items } = await messageRepo.getMailboxMessages(mailboxId, limit);
    return paginatedResponse(items, items.length, 1, limit, 200);
  }

  if (organizationId) {
    const items = await messageRepo.getOrganizationMessages(organizationId, limit);
    return paginatedResponse(items, items.length, 1, limit, 200);
  }

  throw new MailForgeError(
    ErrorCodes.INVALID_INPUT,
    "mailboxId or organizationId query parameter is required",
    400
  );
});

