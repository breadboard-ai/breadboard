import { FirestoreStorageProvider } from "../src/server/storage-providers/firestore.js";

async function createApiKey(): Promise<string> {
  const uuid = crypto.randomUUID();
  const data = new TextEncoder().encode(uuid);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(digest));
  const hashHex = hashArray.map((b) => b.toString(36)).join("");
  return `bb-${hashHex.slice(0, 50)}`;
}

export async function createAccount(username: string, apiKey?: string) {
  if (!apiKey) {
    apiKey = await createApiKey();
  }
  const firestore = new FirestoreStorageProvider();
  await firestore.createUser(username, apiKey);

  console.log(`Created account for ${username} with API key:\n${apiKey}`);
}
