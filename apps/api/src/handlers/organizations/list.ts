import { APIGatewayProxyResult } from "aws-lambda";
import { withErrorHandling } from "../../utils/error-handling";
import { paginatedResponse } from "../../utils/response";
import { extractAuthContext } from "../../utils/auth";
import { OrganizationService } from "../../services/organization-service";

export const handler = withErrorHandling(async (event) => {
  const auth = extractAuthContext(event);
  const service = new OrganizationService();

  const organizations = await service.getOrganizationsByOwner(auth.userId);

  return paginatedResponse(organizations, organizations.length, 1, 50, 200);
});
