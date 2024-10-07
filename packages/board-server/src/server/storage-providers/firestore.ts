import { Firestore } from "@google-cloud/firestore";
import {
  type ReanimationState,
  type GraphDescriptor,
  blankLLMContent,
} from "@google-labs/breadboard";
import {
  EXPIRATION_TIME_MS,
  type ServerInfo,
  type GetUserStoreResult,
  type BoardListEntry,
  asPath,
  type OperationResult,
  asInfo,
  sanitize,
  INVITE_EXPIRATION_TIME_MS,
} from "../store.js";
import type {
  BoardServerStore,
  CreateInviteResult,
  CreateUserResult,
  ListInviteResult,
  RunBoardStateStore,
} from "../types.js";

const REANIMATION_COLLECTION_ID = "resume";

export class FirestoreStorageProvider
  implements RunBoardStateStore, BoardServerStore
{
  #database;

  constructor(storeName: string) {
    this.#database = new Firestore({
      databaseId: storeName,
    });
  }

  async createUser(
    username: string,
    apiKey: string
  ): Promise<CreateUserResult> {
    const existing = await this.#database.doc(`users/${username}`).get();
    if (existing.exists) {
      console.error(
        `Account ${username} already exists with API key:\n${existing.data()!.apiKey}`
      );
    }

    await this.#database.doc(`users/${username}`).set({ apiKey: apiKey });

    return { success: true, apiKey };
  }

  #getReanimationStateDoc(user: string, ticket?: string) {
    const collection = this.#database
      .collection("runs")
      .doc(user)
      .collection(REANIMATION_COLLECTION_ID);
    if (ticket) {
      return collection.doc(ticket);
    }
    return collection.doc();
  }

  async saveReanimationState(
    user: string,
    state: ReanimationState
  ): Promise<string> {
    const timestamp = new Date();
    const expireAt = new Date(timestamp.getTime() + EXPIRATION_TIME_MS);
    const docRef = this.#getReanimationStateDoc(user);
    await docRef.set({ state: JSON.stringify(state), timestamp, expireAt });
    return docRef.id;
  }

  async loadReanimationState(
    user: string,
    ticket: string
  ): Promise<ReanimationState | undefined> {
    const data = await this.#getReanimationStateDoc(user, ticket).get();
    if (!data.exists) {
      return undefined;
    }
    const state = JSON.parse(data.get("state"));
    if (!state.states) {
      return undefined;
    }
    return state;
  }

  async getServerInfo(): Promise<ServerInfo | undefined> {
    const data = await this.#database
      .collection("configuration")
      .doc("metadata")
      .get();
    return data.data() as ServerInfo | undefined;
  }

  async getUserStore(userKey: string | null): Promise<GetUserStoreResult> {
    if (!userKey) {
      return { success: false, error: "No user key supplied" };
    }
    const users = this.#database.collection(`users`);
    const key = await users.where("apiKey", "==", userKey).get();
    if (key.empty) {
      return { success: false, error: "User not found" };
    }
    const doc = key.docs[0];
    if (!doc) {
      return { success: false, error: "User not found" };
    }
    return { success: true, store: doc.id };
  }

  async list(userKey: string | null): Promise<BoardListEntry[]> {
    const userStoreResult = await this.getUserStore(userKey);
    const userStore = userStoreResult.success ? userStoreResult.store : null;

    const allStores = await this.#database
      .collection("workspaces")
      .listDocuments();
    const boards = [];
    for (const store of allStores) {
      const docs = await store.collection("boards").get();
      const storeBoards: BoardListEntry[] = [];
      docs.forEach((doc) => {
        const path = asPath(store.id, doc.id);
        const title = doc.get("title") || path;
        const description = doc.get("description") || undefined;
        const tags = (doc.get("tags") as string[]) || ["published"];
        const published = tags.includes("published");
        const readonly = userStore !== store.id;
        const mine = userStore === store.id;
        const username = store.id;
        if (!published && !mine) {
          return;
        }
        storeBoards.push({
          title,
          description,
          path,
          username,
          readonly,
          mine,
          tags,
        });
      });
      boards.push(...storeBoards);
    }
    return boards;
  }

  async get(userStore: string, boardName: string): Promise<string> {
    const doc = await this.#database
      .doc(`workspaces/${userStore}/boards/${boardName}`)
      .get();
    return doc.get("graph");
  }

  async update(
    userStore: string,
    path: string,
    graph: GraphDescriptor
  ): Promise<OperationResult> {
    const { userStore: pathUserStore, boardName } = asInfo(path);
    if (pathUserStore !== userStore) {
      return { success: false, error: "Unauthorized" };
    }
    const { title: maybeTitle, metadata, description } = graph;
    const tags = metadata?.tags || [];
    const title = maybeTitle || boardName;

    await this.#database
      .doc(`workspaces/${userStore}/boards/${boardName}`)
      .set({ graph: JSON.stringify(graph), tags, title, description });
    return { success: true };
  }

  async create(
    userKey: string,
    name: string,
    dryRun = false
  ): Promise<{
    success: boolean;
    path: string | undefined;
    error: string | undefined;
  }> {
    const userStore = await this.getUserStore(userKey);
    if (!userStore.success) {
      return { success: false, path: undefined, error: userStore.error };
    }
    // The format for finding the unique name is {name}-copy[-number].
    // We'll first start with the sanitized name, then move on to {name}-copy.
    // If that's taken, we'll try {name}-copy-2, {name}-copy-3, etc.
    // Start with a board name proposal based on the sanitized name.
    let proposal = sanitize(name);
    let copyNumber = 0;
    for (;;) {
      // Check if the proposed name is already taken.
      const doc = await this.#database
        .doc(`workspaces/${userStore.store}/boards/${proposal}.bgl.json`)
        .get();
      if (!doc.exists) {
        break;
      }
      if (copyNumber === 0) {
        // If the name is taken, add  "-copy" to the end and try again.
        proposal = `${proposal}-copy`;
      } else if (copyNumber === 1) {
        proposal = `${proposal}-${copyNumber + 1}`;
      } else {
        // Slice off the "number" part of the name.
        proposal = proposal.slice(0, -2);
        // Add the next number to the end of the name.
        proposal = `${proposal}-${copyNumber + 1}`;
      }
      copyNumber++;
    }
    if (!dryRun) {
      // Create a blank board with the proposed name.
      await this.#database
        .doc(`workspaces/${userStore.store}/boards/${proposal}.bgl.json`)
        .set({ graph: blankLLMContent() });
    }
    const path = asPath(userStore.store, `${proposal}.bgl.json`);
    return { success: true, path, error: undefined };
  }

  async delete(userStore: string, path: string): Promise<OperationResult> {
    const { userStore: pathUserStore, boardName } = asInfo(path);
    if (pathUserStore !== userStore) {
      return { success: false, error: "Unauthorized" };
    }
    await this.#database
      .doc(`workspaces/${userStore}/boards/${boardName}`)
      .delete();
    return { success: true };
  }

  async findInvite(
    userStore: string,
    boardName: string,
    invite: string
  ): Promise<OperationResult> {
    const invites = this.#database.collection(
      `workspaces/${userStore}/boards/${boardName}/invites`
    );
    const inviteDoc = await invites.where("invite", "==", invite).get();
    if (inviteDoc.empty) {
      return { success: false, error: "Board or invite not found" };
    }
    return { success: true };
  }

  async createInvite(
    userStore: string,
    path: string
  ): Promise<CreateInviteResult> {
    const { userStore: pathUserStore, boardName } = asInfo(path);
    if (pathUserStore !== userStore) {
      return {
        success: false,
        error: "This user can't create invite for this board.",
      };
    }
    const invite = Math.random().toString(36).slice(2, 10);
    const expireAt = new Date(Date.now() + INVITE_EXPIRATION_TIME_MS);
    await this.#database
      .doc(`workspaces/${userStore}/boards/${boardName}/invites/${invite}`)
      .set({ invite, expireAt });
    return { success: true, invite };
  }

  async deleteInvite(
    userStore: string,
    path: string,
    invite: string
  ): Promise<OperationResult> {
    const { userStore: pathUserStore, boardName } = asInfo(path);
    if (pathUserStore !== userStore) {
      return {
        success: false,
        error: "This user can't delete invite for this board.",
      };
    }
    await this.#database
      .doc(`workspaces/${userStore}/boards/${boardName}/invites/${invite}`)
      .delete();
    return { success: true };
  }

  async listInvites(
    userStore: string,
    path: string
  ): Promise<ListInviteResult> {
    const { userStore: pathUserStore, boardName } = asInfo(path);
    if (pathUserStore !== userStore) {
      return {
        success: false,
        error: "This user can't list invites for this board.",
      };
    }
    const invites = await this.#database
      .collection(`workspaces/${userStore}/boards/${boardName}/invites`)
      .get();
    return { success: true, invites: invites.docs.map((doc) => doc.id) };
  }
}
