import type { BoardServerStore } from "../../store.js";

// TODO Allow invocation with an access token
// TODO Convert to Express middleware

/**
 * Verify the key provided in the inputs as belonging to an authorized user.
 *
 * Returns the ID of the owner of the API key, or empty string
 */
export async function verifyKey(
  inputs: Record<string, any>,
  store: BoardServerStore
): Promise<string> {
  const key: string | undefined = inputs["$key"];
  delete inputs["$key"];
  if (!key) {
    return "";
  }
  return store.findUserIdByApiKey(key);
}
