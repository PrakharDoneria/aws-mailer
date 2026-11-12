import { withErrorHandling } from "../../utils/error-handling";
import { paginatedResponse } from "../../utils/response";
import { extractAuthContext } from "../../utils/auth";
import { TeamService } from "../../services/team-service";

export const handler = withErrorHandling(async (event) => {
  const auth = extractAuthContext(event);
  const organizationId = event.pathParameters?.organizationId;

  if (!organizationId) {
    throw new Error("Organization ID required");
  }

  const service = new TeamService();
  const members = await service.getMembers(organizationId, auth.userId);

  return paginatedResponse(members, members.length, 1, 50);
});
