import { withErrorHandling } from "../../utils/error-handling";
import { successResponse } from "../../utils/response";
import { extractAuthContext } from "../../utils/auth";
import { AuthService } from "../../services/auth-service";

export const handler = withErrorHandling(async (event) => {
  const auth = extractAuthContext(event);
  const service = new AuthService();

  const user = await service.getUser(auth.userId);

  return successResponse(user);
});
