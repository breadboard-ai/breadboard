import { getStore } from "../../store.js";

export const verifyKey = async (inputs: Record<string, any> | undefined) => {
  const key = inputs?.$key;
  if (!key) {
    return { success: false, error: "No key supplied" };
  }
  const store = getStore();
  const userStore = await store.getUserStore(key);
  if (!userStore.success) {
    return { success: false, error: userStore.error };
  }
  delete inputs.$key;
  return { success: true, user: userStore.store };
};
