import { withErrorHandling } from "../../utils/error-handling";
import { successResponse } from "../../utils/response";
import { extractAuthContext } from "../../utils/auth";
import { TeamService } from "../../services/team-service";
import { InviteMemberSchema } from "@mailforge/validation";

export const handler = withErrorHandling(async (event) => {
  const auth = extractAuthContext(event);
  const organizationId = event.pathParameters?.organizationId;

  if (!organizationId) {
    throw new Error("Organization ID required");
  }

  if (!event.body) {
    throw new Error("Request body required");
  }

  const input = InviteMemberSchema.parse(JSON.parse(event.body));
  const service = new TeamService();

  const membership = await service.inviteMember(
    organizationId,
    auth.userId,
    input
  );

  return successResponse(membership, 201);
});
