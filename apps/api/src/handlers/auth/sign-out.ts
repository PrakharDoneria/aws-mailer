import { withErrorHandling } from "../../utils/error-handling";
import { successResponse } from "../../utils/response";
import { extractAuthContext } from "../../utils/auth";
import { AuthService } from "../../services/auth-service";

export const handler = withErrorHandling(async (event) => {
  const auth = extractAuthContext(event);
  const service = new AuthService();

  await service.signOut(auth.userId);

  return successResponse({ message: "Signed out successfully" });
});
