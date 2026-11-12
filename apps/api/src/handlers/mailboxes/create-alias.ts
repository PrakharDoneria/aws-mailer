import { withErrorHandling } from "../../utils/error-handling";
import { successResponse } from "../../utils/response";
import { extractAuthContext } from "../../utils/auth";
import { MailboxService } from "../../services/mailbox-service";
import { CreateMailboxAliasSchema } from "@mailforge/validation";
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

  if (!event.body) {
    throw new Error("Request body required");
  }

  const input = CreateMailboxAliasSchema.parse(JSON.parse(event.body));
  const service = new MailboxService();

  const alias = await service.createAlias(mailboxId, input);

  return successResponse(alias, 201);
});
