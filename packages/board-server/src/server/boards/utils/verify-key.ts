import { getStore } from "../../store.js";
import type { BoardId } from "../../types.js";

// TODO Allow invocation with an access token
// TODO Convert to Express middleware

/**
 * Verify the key provided in the inputs as belonging to an authorized user.
 *
 * Accepts either an API key or invite key. If an API key is given, returns the
 * ID of the owner of the API key. If an invite key is given, returns the ID of
 * the owner of the board.
 *
 * Returns empty string otherwise.
 */
export async function verifyKey(
  boardId: BoardId,
  inputs: Record<string, any>
): Promise<string> {
  const key: string | undefined = inputs["$key"];
  delete inputs["$key"];
  if (!key) {
    return "";
  }

  const store = getStore();

  const userId = await store.findUserIdByApiKey(key);
  if (userId) {
    // TODO Determine desired behavior. Do we want to allow any user to invoke
    // with an API key, or just the owner? (Note that this doesn't check whether
    // the board is private or published, so this behaves differently from
    // viewing a board)
    return userId;
  }

  if (await store.findInvite(boardId.user, boardId.name, key)) {
    return boardId.user;
  }

  return "";
}
