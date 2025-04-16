import { blank, type ReanimationState } from "@google-labs/breadboard";
import type { BoardServerStore, ServerInfo, StorageBoard } from "../store.js";

export const IN_MEMORY_SERVER_INFO: ServerInfo = {
  title: "In-memory board server",
  description: "Stores boards in memory",
  url: "https://example.com/board-server",
};

export class InMemoryStorageProvider implements BoardServerStore {
  /** API key -> user ID */
  #users: Record<string, string> = {};

  /** board name -> boards */
  #boards: Record<string, StorageBoard> = {};

  async getServerInfo(): Promise<ServerInfo | null> {
    return IN_MEMORY_SERVER_INFO;
  }

  async createUser(userId: string, apiKey: string): Promise<void> {
    if (Object.values(this.#users).includes(userId)) {
      throw Error("user exists");
    }
    this.#users[apiKey] = userId;
  }

  async findUserIdByApiKey(apiKey: string): Promise<string> {
    return this.#users[apiKey] ?? "";
  }

  async loadBoard(opts: { name: string }): Promise<StorageBoard | null> {
    return this.#boards[opts.name] ?? null;
  }

  async listBoards(userId: string): Promise<StorageBoard[]> {
    return Object.values(this.#boards).filter((board) => {
      return board.owner === userId || board.tags.includes("published");
    });
  }

  async upsertBoard(board: Readonly<Partial<StorageBoard>>): Promise<StorageBoard> {
    const updatedBoard: StorageBoard = {
      name: board.name || crypto.randomUUID(),
      owner: board.owner || "",
      displayName: board.displayName || "",
      description: board.description || "",
      tags: board.tags || [],
      thumbnail: board.thumbnail || "",
      graph: board.graph || blank(),
    };
    this.#boards[updatedBoard.name] = updatedBoard;
    return updatedBoard;
  }

  async deleteBoard(_userId: string, boardName: string): Promise<void> {
    delete this.#boards[boardName];
  }

  async loadReanimationState(
    _user: string,
    _ticket: string
  ): Promise<ReanimationState | undefined> {
    throw Error("unimplemented");
  }

  saveReanimationState(
    _user: string,
    _state: ReanimationState
  ): Promise<string> {
    throw Error("unimplemented");
  }
}
