import { withErrorHandling } from "../../utils/error-handling";
import { paginatedResponse } from "../../utils/response";
import { extractAuthContext } from "../../utils/auth";
import { DomainService } from "../../services/domain-service";
import { MailForgeError, ErrorCodes } from "@mailforge/shared";

export const handler = withErrorHandling(async (event) => {
  const auth = extractAuthContext(event);
  const organizationId =
    event.pathParameters?.organizationId ||
    event.queryStringParameters?.organizationId;

  if (!organizationId) {
    throw new MailForgeError(ErrorCodes.INVALID_INPUT, "Organization ID required", 400);
  }

  const service = new DomainService();
  const domains = await service.getOrganizationDomains(organizationId);

  return paginatedResponse(domains, domains.length, 1, 50);
});
