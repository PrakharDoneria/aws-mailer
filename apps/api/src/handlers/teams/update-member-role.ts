import { withErrorHandling } from "../../utils/error-handling";
import { successResponse } from "../../utils/response";
import { extractAuthContext } from "../../utils/auth";
import { TeamService } from "../../services/team-service";
import { UpdateMemberRoleSchema } from "@mailforge/validation";

export const handler = withErrorHandling(async (event) => {
  const auth = extractAuthContext(event);
  const organizationId = event.pathParameters?.organizationId;
  const userId = event.pathParameters?.userId;

  if (!organizationId || !userId) {
    throw new Error("Organization ID and User ID required");
  }

  if (!event.body) {
    throw new Error("Request body required");
  }

  const input = UpdateMemberRoleSchema.parse(JSON.parse(event.body));
  const service = new TeamService();

  const membership = await service.updateMemberRole(
    organizationId,
    auth.userId,
    userId,
    input
  );

  return successResponse(membership);
});
