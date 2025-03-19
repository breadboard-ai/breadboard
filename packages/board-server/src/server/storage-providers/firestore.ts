import { Firestore, QueryDocumentSnapshot } from "@google-cloud/firestore";
import {
  type ReanimationState,
  type GraphDescriptor,
  blank,
  isStoredData,
  isLLMContentArray,
} from "@google-labs/breadboard";
import {
  EXPIRATION_TIME_MS,
  type BoardServerStore,
  type ServerInfo,
  type StorageBoard,
} from "../store.js";
import type { RunBoardStateStore } from "../types.js";

const REANIMATION_COLLECTION_ID = "resume";

export class FirestoreStorageProvider
  implements BoardServerStore, RunBoardStateStore
{
  #database: Firestore;

  constructor(opts?: { database?: Firestore }) {
    this.#database =
      opts?.database ||
      new Firestore({
        databaseId: process.env["FIRESTORE_DB_NAME"] || "board-server",
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

  async listBoards(userId: string): Promise<StorageBoard[]> {
    const boards: StorageBoard[] = [];

    const docs = await this.#database.collectionGroup("boards").get();
    docs.forEach((doc: QueryDocumentSnapshot): void => {
      const owner = doc.ref.parent.parent!.id;
      const tags = (doc.get("tags") as string[]) || [];

      // TODO Save on query and serving costs by filtering on the server
      // instead of post-filtering
      const mine = owner === userId;
      const published = tags.includes("published");
      if (!mine && !published) {
        return;
      }

      const graphJson = doc.get("graph");
      const graph = graphJson
        ? (JSON.parse(graphJson) as GraphDescriptor)
        : undefined;

      const board: StorageBoard = {
        name: doc.id,
        owner,
        displayName: doc.get("title") || doc.id,
        description: doc.get("description") ?? "",
        thumbnail: getThumbnail(graph),
        tags,
        graph,
      };
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
      thumbnail: "",
      graph,
    };
  }

  async updateBoard(board: StorageBoard): Promise<void> {
    await this.#database.doc(asBoardPath(board.owner, board.name)).set({
      title: board.displayName,
      description: board.description,
      tags: board.tags,
      graph: JSON.stringify(board.graph),
    });
  }

  async createBoard(userId: string, name: string): Promise<void> {
    await this.#database
      .doc(asBoardPath(userId, name))
      .set({ graph: JSON.stringify(blank()) });
  }

  async deleteBoard(userId: string, boardName: string): Promise<void> {
    await this.#database.doc(asBoardPath(userId, boardName)).delete();
  }
}

function asBoardPath(userId: string, boardName: string): string {
  return `workspaces/${userId}/boards/${boardName}`;
}

function getThumbnail(graph?: GraphDescriptor): string {
  if (!graph) {
    return "";
  }
  try {
    const splashData = graph.assets?.["@@splash"]?.data;
    if (splashData && isLLMContentArray(splashData) && splashData.length > 0) {
      const splashEntry = splashData[0];
      if (splashEntry && isStoredData(splashEntry.parts[0])) {
        return splashEntry.parts[0].storedData.handle;
      }
      return "";
    }

    const presentation = graph.metadata?.visual?.presentation;
    const theme = presentation?.theme;
    const themes = presentation?.themes;
    if (!theme || !themes) {
      return "";
    }

    const handle = themes?.[theme]?.splashScreen?.storedData?.handle;
    if (handle) {
      return handle;
    }
  } catch (e) {
    // If an error is encountered, skip the thumbnail
  }

  return "";
}
