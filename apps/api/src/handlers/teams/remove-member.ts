import { withErrorHandling } from "../../utils/error-handling";
import { successResponse } from "../../utils/response";
import { extractAuthContext } from "../../utils/auth";
import { TeamService } from "../../services/team-service";

export const handler = withErrorHandling(async (event) => {
  const auth = extractAuthContext(event);
  const organizationId = event.pathParameters?.organizationId;
  const userId = event.pathParameters?.userId;

  if (!organizationId || !userId) {
    throw new Error("Organization ID and User ID required");
  }

  const service = new TeamService();
  await service.removeMember(organizationId, auth.userId, userId);

  return successResponse({ message: "Member removed successfully" });
});
