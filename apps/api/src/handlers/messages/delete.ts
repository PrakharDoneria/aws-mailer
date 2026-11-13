import { withErrorHandling } from "../../utils/error-handling";
import { successResponse } from "../../utils/response";
import { extractAuthContext } from "../../utils/auth";
import { MessageRepository } from "../../repositories/message-repository";
import { MailForgeError, ErrorCodes } from "@mailforge/shared";

export const handler = withErrorHandling(async (event) => {
  extractAuthContext(event);
  const id = event.pathParameters?.id;
  const mailboxId = event.queryStringParameters?.mailboxId;

  if (!id) {
    throw new MailForgeError(
      ErrorCodes.INVALID_INPUT,
      "Message ID required",
      400
    );
  }

  const messageRepo = new MessageRepository();
  const createdAtNum = parseInt(id, 10);

  if (mailboxId && !isNaN(createdAtNum)) {
    await messageRepo.delete(mailboxId, createdAtNum);
  } else {
    const existing = await messageRepo.getByMessageId(id);
    if (existing) {
      await messageRepo.delete(existing.mailboxId, existing.createdAt);
    }
  }

  return successResponse({ deleted: true });
});
