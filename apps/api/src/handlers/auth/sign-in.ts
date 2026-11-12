import { withErrorHandling } from "../../utils/error-handling";
import { successResponse } from "../../utils/response";
import { AuthService } from "../../services/auth-service";
import { SignInSchema } from "@mailforge/validation";

export const handler = withErrorHandling(async (event) => {
  if (!event.body) {
    throw new Error("Request body required");
  }

  const input = SignInSchema.parse(JSON.parse(event.body));
  const service = new AuthService();

  const tokens = await service.signIn(input);

  return successResponse(tokens);
});
