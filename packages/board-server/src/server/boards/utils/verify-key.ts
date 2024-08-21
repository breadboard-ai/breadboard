import { getStore } from "../../store.js";

export const verifyKey = async (
  user: string,
  boardName: string,
  inputs: Record<string, any> | undefined
) => {
  const key = inputs?.$key;
  if (!key) {
    return { success: false, error: "No key supplied" };
  }
  delete inputs.$key;
  const store = getStore();
  const userStore = await store.getUserStore(key);
  if (userStore.success) {
    return { success: true, user: userStore.store };
  }
  const found = await store.findInvite(user, boardName, key);
  if (found.success) {
    return { success: true, user };
  }
  return { success: false, error: found.error };
};
