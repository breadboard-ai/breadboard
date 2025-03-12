import { Firestore } from "@google-cloud/firestore";
import {
  type ReanimationState,
  type GraphDescriptor,
  blank,
  isStoredData,
  isLLMContentArray,
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
  type StorageBoard,
} from "../store.js";
import type {
  CreateInviteResult,
  CreateUserResult,
  ListInviteResult,
  RunBoardStateStore,
} from "../types.js";

const REANIMATION_COLLECTION_ID = "resume";

export class FirestoreStorageProvider implements RunBoardStateStore {
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

  // TODO Rename this
  // It's confusing that we're referring to a string user ID as "user store"
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

  async list(userStore: string): Promise<BoardListEntry[]> {
    const docs = await this.#database.collectionGroup("boards").get();
    const boards: BoardListEntry[] = [];
    docs.forEach((doc) => {
      const storeId = doc.ref.parent.parent!.id;
      const path = asPath(storeId, doc.id);
      const title = doc.get("title") || path;
      const description = doc.get("description") || undefined;
      const tags = (doc.get("tags") as string[]) || ["published"];
      const published = tags.includes("published");

      const readonly = userStore !== storeId;
      const mine = userStore === storeId;
      const username = storeId;
      if (!published && !mine) {
        return;
      }

      let thumbnail: string | undefined = undefined;
      const graph = doc.get("graph");
      if (graph) {
        try {
          const graphData = JSON.parse(graph);
          if (graphData.assets && graphData.assets["@@splash"]) {
            if (
              isLLMContentArray(graphData.assets["@@splash"].data) &&
              graphData.assets["@@splash"].data.length > 0
            ) {
              const splashEntry = graphData.assets["@@splash"].data[0];
              if (splashEntry && isStoredData(splashEntry.parts[0])) {
                thumbnail = splashEntry.parts[0].storedData.handle;
              }
            }
          }
        } catch (err) {
          // For errors just skip the thumbnail.
        }
      }

      const board: BoardListEntry = {
        title,
        description,
        path,
        username,
        readonly,
        mine,
        tags,
      };

      if (thumbnail) {
        board.thumbnail = thumbnail;
      }

      boards.push(board);
    });
    return boards;
  }

  async loadBoard(user: string, name: string): Promise<StorageBoard | null> {
    const path = `workspaces/${user}/boards/${name}`;
    const doc = await this.#database.doc(path).get();
    if (!doc.exists) {
      return null;
    }

    const displayName: string = doc.get("title") ?? "";
    const description = doc.get("description") || "";
    const tags = doc.get("tags") ?? [];

    const graphString = doc.get("graph") ?? "";
    const graph: GraphDescriptor | undefined = graphString
      ? JSON.parse(graphString)
      : undefined;

    return {
      name,
      owner: user,
      displayName,
      description,
      tags,
      graph,
    };
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
    const { title: maybeTitle, metadata, description = "" } = graph;
    const tags = metadata?.tags || [];
    const title = maybeTitle || boardName;

    await this.#database
      .doc(`workspaces/${userStore}/boards/${boardName}`)
      .set({ graph: JSON.stringify(graph), tags, title, description });
    return { success: true };
  }

  async create(userStore: string, name: string): Promise<void> {
    await this.#database
      .doc(`workspaces/${userStore}/boards/${name}`)
      .set({ graph: JSON.stringify(blank()) });
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
