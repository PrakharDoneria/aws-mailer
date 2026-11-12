import { APIGatewayProxyResult } from "aws-lambda";
import { withErrorHandling } from "../../utils/error-handling";
import { successResponse } from "../../utils/response";
import { extractAuthContext } from "../../utils/auth";
import { OrganizationService } from "../../services/organization-service";
import { CreateOrganizationSchema } from "@mailforge/validation";

export const handler = withErrorHandling(async (event) => {
  const auth = extractAuthContext(event);

  if (!event.body) {
    throw new Error("Request body required");
  }

  const input = CreateOrganizationSchema.parse(JSON.parse(event.body));
  const service = new OrganizationService();

  const organization = await service.createOrganization(input, auth.userId);

  return successResponse(organization, 201);
});
