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
  type StorageBoard,
} from "../store.js";
import type { Invite, RunBoardStateStore } from "../types.js";

const REANIMATION_COLLECTION_ID = "resume";

export class FirestoreStorageProvider implements RunBoardStateStore {
  #database;

  constructor(storeName: string) {
    this.#database = new Firestore({
      databaseId: storeName,
    });
  }

  async createUser(username: string, apiKey: string): Promise<void> {
    const path = `users/${username}`;
    if ((await this.#database.doc(path).get()).exists) {
      throw Error(`Account ${username} already exists`);
    }
    await this.#database.doc(path).set({ apiKey: apiKey });
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

  async getServerInfo(): Promise<ServerInfo | null> {
    const metadata = await this.#database.doc("configuration/metadata").get();
    return metadata.data() ?? null;
  }

  async findUserIdByApiKey(apiKey: string): Promise<string> {
    const users = await this.#database
      .collection("users")
      .where("apiKey", "==", apiKey)
      .get();
    return users.docs[0]?.id ?? "";
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
          } else if (
            graphData.metadata?.visual?.presentation?.theme &&
            graphData.metadata?.visual?.presentation?.themes
          ) {
            const { theme, themes } = graphData.metadata.visual.presentation;
            if (
              themes[theme] &&
              themes[theme].splashScreen?.storedData?.handle
            ) {
              thumbnail = themes[theme].splashScreen.storedData.handle;
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
    userId: string,
    boardName: string,
    graph: GraphDescriptor
  ): Promise<void> {
    const { title: maybeTitle, metadata, description = "" } = graph;
    const tags = metadata?.tags || [];
    const title = maybeTitle || boardName;

    await this.#database
      .doc(asBoardPath(userId, boardName))
      .set({ graph: JSON.stringify(graph), tags, title, description });
  }

  async create(userStore: string, name: string): Promise<void> {
    await this.#database
      .doc(`workspaces/${userStore}/boards/${name}`)
      .set({ graph: JSON.stringify(blank()) });
  }

  async delete(userId: string, boardName: string): Promise<void> {
    await this.#database.doc(asBoardPath(userId, boardName)).delete();
  }

  async findInvite(
    userId: string,
    boardName: string,
    inviteName: string
  ): Promise<boolean> {
    const invites = await this.#database
      .collection(asInvitePath(userId, boardName))
      .where("invite", "==", inviteName)
      .get();
    return !invites.empty;
  }

  async createInvite(
    userId: string,
    boardName: string,
    invite: Invite
  ): Promise<void> {
    await this.#database
      .doc(asInvitePath(userId, boardName, invite.name))
      .set(invite);
  }

  async deleteInvite(
    userId: string,
    boardName: string,
    inviteName: string
  ): Promise<void> {
    await this.#database
      .doc(asInvitePath(userId, boardName, inviteName))
      .delete();
  }

  async listInvites(userId: string, boardName: string): Promise<string[]> {
    const invites = await this.#database
      .collection(asInvitePath(userId, boardName))
      .get();
    return invites.docs.map((doc) => doc.id);
  }
}

function asBoardPath(userId: string, boardName: string): string {
  return `workspaces/${userId}/boards/${boardName}`;
}

function asInvitePath(
  userId: string,
  boardName: string,
  inviteName?: string
): string {
  let path = asBoardPath(userId, boardName) + "/invites";
  if (inviteName) {
    path += `/${inviteName}`;
  }
  return path;
}
