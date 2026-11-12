import { withErrorHandling } from "../utils/error-handling";
import { successResponse } from "../utils/response";
import { extractAuthContext } from "../utils/auth";

export const handler = withErrorHandling(async (event) => {
  const auth = extractAuthContext(event);
  return successResponse({ success: true, message: "Placeholder endpoint" });
});
