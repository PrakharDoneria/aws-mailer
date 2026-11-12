import { withErrorHandling } from "../../utils/error-handling";
import { successResponse } from "../../utils/response";
import { extractAuthContext } from "../../utils/auth";
import { AuthService } from "../../services/auth-service";
import { UpdateProfileSchema } from "@mailforge/validation";

export const handler = withErrorHandling(async (event) => {
  const auth = extractAuthContext(event);

  if (!event.body) {
    throw new Error("Request body required");
  }

  const input = UpdateProfileSchema.parse(JSON.parse(event.body));
  const service = new AuthService();

  const user = await service.updateProfile(auth.userId, input);

  return successResponse(user);
});
