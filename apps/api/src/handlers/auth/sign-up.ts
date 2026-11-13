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

  // Automatically sign in the user to return auth tokens immediately
  let tokens = null;
  try {
    tokens = await service.signIn({
      email: input.email,
      password: input.password,
    });
  } catch (e) {
    console.warn("Auto-signin failed after signup:", e);
  }

  return successResponse({ user, ...tokens }, 201);
});
