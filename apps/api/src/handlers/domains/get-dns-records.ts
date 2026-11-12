import { withErrorHandling } from "../../utils/error-handling";
import { successResponse } from "../../utils/response";
import { extractAuthContext } from "../../utils/auth";
import { DomainService } from "../../services/domain-service";
import { MailForgeError, ErrorCodes } from "@mailforge/shared";

export const handler = withErrorHandling(async (event) => {
  const auth = extractAuthContext(event);
  const domainId = event.pathParameters?.id;

  if (!domainId) {
    throw new MailForgeError(ErrorCodes.INVALID_INPUT, "Domain ID required", 400);
  }

  const service = new DomainService();
  const domain = await service.getDomain(domainId);
  const dnsRecords = await service.getDNSRecords(domain.domainName);

  return successResponse(dnsRecords);
});
