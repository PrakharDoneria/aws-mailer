import { withErrorHandling } from "../../utils/error-handling";
import { successResponse } from "../../utils/response";
import { AuthService } from "../../services/auth-service";
import { SignUpSchema } from "@mailforge/validation";

export const handler = withErrorHandling(async (event) => {
  if (!event.body) {
    throw new Error("Request body required");
  }

  const input = SignUpSchema.parse(JSON.parse(event.body));
  const service = new AuthService();

  const user = await service.signUp(input);

  return successResponse(user, 201);
});
