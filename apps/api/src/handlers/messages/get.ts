import { withErrorHandling } from "../../utils/error-handling";
import { successResponse } from "../../utils/response";
import { extractAuthContext } from "../../utils/auth";
import { MessageRepository } from "../../repositories/message-repository";
import { MailForgeError, ErrorCodes } from "@mailforge/shared";

export const handler = withErrorHandling(async (event) => {
  extractAuthContext(event);
  const id = event.pathParameters?.id;

  if (!id) {
    throw new MailForgeError(
      ErrorCodes.INVALID_INPUT,
      "Message ID required",
      400
    );
  }

  const messageRepo = new MessageRepository();
  const message = await messageRepo.getByMessageId(id);

  if (!message) {
    throw new MailForgeError(
      ErrorCodes.NOT_FOUND,
      "Message not found",
      404
    );
  }

  return successResponse(message);
});

