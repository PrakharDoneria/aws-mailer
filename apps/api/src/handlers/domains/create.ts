import { withErrorHandling } from "../../utils/error-handling";
import { successResponse } from "../../utils/response";
import { extractAuthContext } from "../../utils/auth";
import { DomainService } from "../../services/domain-service";
import { CreateDomainSchema } from "@mailforge/validation";
import { MailForgeError, ErrorCodes } from "@mailforge/shared";

export const handler = withErrorHandling(async (event) => {
  const auth = extractAuthContext(event);
  const organizationId =
    event.pathParameters?.organizationId ||
    event.queryStringParameters?.organizationId ||
    (event.body ? JSON.parse(event.body).organizationId : undefined);

  if (!organizationId) {
    throw new MailForgeError(ErrorCodes.INVALID_INPUT, "Organization ID required", 400);
  }

  if (!event.body) {
    throw new Error("Request body required");
  }

  const input = CreateDomainSchema.parse(JSON.parse(event.body));
  const service = new DomainService();

  const domain = await service.createDomain(organizationId, input);

  return successResponse(domain, 201);
});
