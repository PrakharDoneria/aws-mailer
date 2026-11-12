import { APIGatewayProxyResult } from "aws-lambda";
import { withErrorHandling } from "../../utils/error-handling";
import { successResponse } from "../../utils/response";
import { extractAuthContext } from "../../utils/auth";
import { OrganizationService } from "../../services/organization-service";

export const handler = withErrorHandling(async (event) => {
  const auth = extractAuthContext(event);
  const organizationId = event.pathParameters?.id;

  if (!organizationId) {
    throw new Error("Organization ID required");
  }

  // Verify user has access to this organization
  await new OrganizationService().validateOrganizationAccess(
    organizationId,
    auth.userId
  );

  const organization = await new OrganizationService().getOrganization(
    organizationId
  );

  return successResponse(organization);
});
