import { APIGatewayProxyResult } from "aws-lambda";
import { withErrorHandling } from "../../utils/error-handling";
import { successResponse } from "../../utils/response";
import { extractAuthContext } from "../../utils/auth";
import { OrganizationService } from "../../services/organization-service";
import { UpdateOrganizationSchema } from "@mailforge/validation";

export const handler = withErrorHandling(async (event) => {
  const auth = extractAuthContext(event);
  const organizationId = event.pathParameters?.id;

  if (!organizationId) {
    throw new Error("Organization ID required");
  }

  if (!event.body) {
    throw new Error("Request body required");
  }

  // Verify user has access to this organization
  const service = new OrganizationService();
  await service.validateOrganizationAccess(organizationId, auth.userId);

  const input = UpdateOrganizationSchema.parse(JSON.parse(event.body));
  const updated = await service.updateOrganization(organizationId, input);

  return successResponse(updated);
});
