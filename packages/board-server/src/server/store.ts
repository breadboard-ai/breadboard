/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Firestore } from "@google-cloud/firestore";
import { blankLLMContent, type GraphDescriptor, type ReanimationState } from "@google-labs/breadboard";
import type {
  CreateInviteResult,
  CreateUserResult,
  ListInviteResult,
  RunBoardStateStore,
  UserStore,
} from "./types.js";
import Database from "better-sqlite3";

const REANIMATION_COLLECTION_ID = "resume";
const EXPIRATION_TIME_MS = 1000 * 60 * 60 * 24 * 2; // 2 days
const INVITE_EXPIRATION_TIME_MS = 1000 * 60 * 60 * 24 * 4; // 4 days

export type GetUserStoreResult =
  | { success: true; store: string }
  | { success: false; error: string };

export type OperationResult =
  | { success: true }
  | { success: false; error: string };

export const getStore = () => {
  return new SQLite3BetterStore('board-server')
};

export type BoardListEntry = {
  title: string;
  path: string;
  username: string;
  readonly: boolean;
  mine: boolean;
  tags: string[];
};

export type ServerCapabilityAccess = "open" | "key";

export type ServerCapabilityInfo = {
  path: string;
  read: ServerCapabilityAccess;
  write: ServerCapabilityAccess;
};

export type ServerCapability = "boards" | "proxy";

export type ServerInfo = {
  title?: string;
  description?: string;
  capabilities?: Partial<Record<ServerCapability, ServerCapabilityInfo>>;
};

export const asPath = (userStore: string, boardName: string) => {
  return `@${userStore}/${boardName}`;
};

export const sanitize = (name: string) => {
  if (name.endsWith(".bgl.json")) {
    name = name.slice(0, -9);
  } else if (name.endsWith(".json")) {
    name = name.slice(0, -5);
  }
  name = name.replace(/[^a-zA-Z0-9]/g, "-");
  return name;
};

export const asInfo = (path: string) => {
  const [userStore, boardName] = path.split("/");
  if (!userStore || userStore[0] !== "@") {
    return {};
  }
  return { userStore: userStore.slice(1), boardName };
};

export type BoardServerCorsConfig = {
  allow: string[];
};

class Store implements RunBoardStateStore {
  #database;

  constructor(storeName: string) {
    this.#database = new Firestore({
      databaseId: storeName,
    });
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

  async getBoardServerCorsConfig(): Promise<BoardServerCorsConfig | undefined> {
    const data = await this.#database
      .collection("configuration")
      .doc("board-server-cors")
      .get();
    const config = data.data() as BoardServerCorsConfig;
    return config;
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
        const tags = (doc.get("tags") as string[]) || ["published"];
        const published = tags.includes("published");
        const readonly = userStore !== store.id;
        const mine = userStore === store.id;
        const username = store.id;
        if (!published && !mine) {
          return;
        }
        storeBoards.push({ title, path, username, readonly, mine, tags });
      });
      boards.push(...storeBoards);
    }
    return boards;
  }

  async get(userStore: string, boardName: string) {
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
    const { title: maybeTitle, metadata } = graph;
    const tags = metadata?.tags || [];
    const title = maybeTitle || boardName;

    await this.#database
      .doc(`workspaces/${userStore}/boards/${boardName}`)
      .set({ graph: JSON.stringify(graph), tags, title });
    return { success: true };
  }

  async create(userKey: string, name: string, dryRun = false) {
    const userStore = await this.getUserStore(userKey);
    if (!userStore.success) {
      return { success: false, error: userStore.error };
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
    return { success: true, path };
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

class SQLite3BetterStore implements RunBoardStateStore, UserStore {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);

    // Initialize tables
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS reanimationStates (
        id TEXT PRIMARY KEY,
        user TEXT NOT NULL,
        state TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        expire_at INTEGER NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,        
        api_key TEXT NOT NULL UNIQUE
      );
      
      CREATE TABLE IF NOT EXISTS workspaces (
        id TEXT PRIMARY KEY
      );

      CREATE TABLE IF NOT EXISTS boards (
        workspace_id TEXT,
        board_id TEXT,
        title TEXT,
        tags TEXT,
        graph TEXT,
        PRIMARY KEY (workspace_id, board_id),
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
      );

      CREATE TABLE IF NOT EXISTS invites (
        workspace_id TEXT,
        board_id TEXT,
        invite TEXT,
        expire_at INTEGER,
        PRIMARY KEY (workspace_id, board_id, invite),
        FOREIGN KEY (workspace_id, board_id) REFERENCES boards(workspace_id, board_id)
      );
      
      CREATE TABLE IF NOT EXISTS configuration (
        key TEXT PRIMARY KEY,
        value TEXT
      );

      CREATE TABLE IF NOT EXISTS serverInfo (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);
  }

  async saveReanimationState(user: string, state: ReanimationState): Promise<string> {
    const timestamp = Date.now();
    const expireAt = timestamp + EXPIRATION_TIME_MS;
    const id = uuidv4(); // Generate a UUID

    const stmt = this.db.prepare(`
      INSERT INTO reanimation_states (id, user, state, timestamp, expireAt)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(id, user, JSON.stringify(state), timestamp, expireAt);

    return id;
  }

  async loadReanimationState(user: string, ticket: string): Promise<ReanimationState | undefined> {
    const stmt = this.db.prepare(`
      SELECT state FROM reanimation_states
      WHERE user = ? AND id = ? AND expireAt > ?
    `);

    const row = stmt.get(user, ticket, Date.now());
    if (!row) {
      return undefined;
    }

    const state = JSON.parse(row.state);
    if (!state.states) {
      return undefined;
    }

    return state;
  }

  async getBoardServerCorsConfig(): Promise<BoardServerCorsConfig | undefined> {
    const stmt = this.db.prepare(`
      SELECT value FROM configuration
      WHERE key = ?
    `);

    const row = stmt.get('board-server-cors');
    if (!row) {
      return undefined;
    }

    try {
      const config: BoardServerCorsConfig = JSON.parse(row.value);
      return config;
    } catch (error) {
      console.error('Error parsing configuration:', error);
      return undefined;
    }
  }

  async getServerInfo(): Promise<ServerInfo | undefined> {
    const stmt = this.db.prepare(`
      SELECT value FROM configuration
      WHERE key = ?
    `);

    const row = stmt.get('metadata');
    if (!row) {
      return undefined;
    }

    try {
      return JSON.parse(row.value);
    } catch (error) {
      console.error('Error parsing server info:', error);
      return undefined;
    }
  }

  async getUserStore(userKey: string | null): Promise<{ success: boolean, store?: string, error?: string }> {
    if (!userKey) {
      return { success: false, error: "No user key supplied" };
    }
    const stmt = this.db.prepare(`
      SELECT id FROM users
      WHERE api_key = ?
    `);
    const row = stmt.get(userKey);
    if (!row) {
      return { success: false, error: "User not found" };
    }
    return { success: true, store: row.id };
  }

  async list(userKey: string | null): Promise<BoardListEntry[]> {
    const userStoreResult = await this.getUserStore(userKey);
    const userStore = userStoreResult.success ? userStoreResult.store : null;

    const allStoresStmt = this.db.prepare(`
      SELECT id FROM workspaces
    `);
    const allStores = allStoresStmt.all();

    const boards: BoardListEntry[] = [];
    for (const store of allStores) {
      const docsStmt = this.db.prepare(`
        SELECT board_id, title, tags FROM boards
        WHERE workspace_id = ?
      `);
      const docs = docsStmt.all(store.id);

      for (const doc of docs) {
        const path = `${store.id}/${doc.board_id}`;
        const title = doc.title || path;
        const tags = JSON.parse(doc.tags) as string[] || ["published"];
        const published = tags.includes("published");
        const readonly = userStore !== store.id;
        const mine = userStore === store.id;
        const username = store.id;
        if (!published && !mine) {
          continue;
        }
        boards.push({ title, path, username, readonly, mine, tags });
      }
    }
    return boards;
  }

  async get(userStore: string, boardName: string): Promise<any> {
    // Prepare and execute the SQL query to get the board details
    const stmt = this.db.prepare(`
      SELECT graph FROM boards
      WHERE workspace_id = ? AND board_id = ?
    `);
    const row = stmt.get(userStore, boardName);

    // Return the 'graph' column data if it exists, or undefined if not found
    return row ? JSON.parse(row.graph) : undefined;
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

    const { title: maybeTitle, metadata } = graph;
    const tags = metadata?.tags || [];
    const title = maybeTitle || boardName;

    // Convert tags array to a comma-separated string for storage
    const tagsString = tags.join(',');

    try {
      const stmt = this.db.prepare(`
        INSERT INTO boards (workspace_id, board_id, title, tags, graph)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(workspace_id, board_id)
        DO UPDATE SET title = excluded.title, tags = excluded.tags, graph = excluded.graph
      `);
      stmt.run(userStore, boardName, title, tagsString, JSON.stringify(graph));

      return { success: true };
    } catch (error) {
      console.error('Error updating board:', error);
      return { success: false, error: 'Update failed' };
    }
  }

  async create(userKey: string, name: string, dryRun = false) {
    const userStoreResult = await this.getUserStore(userKey);
    if (!userStoreResult.success) {
      return { success: false, error: userStoreResult.error };
    }
    const userStore = userStoreResult.store!;

    // The format for finding the unique name is {name}-copy[-number].
    let proposal = sanitize(name);
    let copyNumber = 0;

    // Check for existing board names
    while (true) {
      const stmt = this.db.prepare("SELECT 1 FROM boards WHERE workspace_id = ? AND board_id = ?");
      const exists = stmt.get(userStore, proposal);

      if (!exists) {
        break;
      }

      if (copyNumber === 0) {
        proposal = `${proposal}-copy`;
      } else if (copyNumber === 1) {
        proposal = `${proposal}-${copyNumber + 1}`;
      } else {
        proposal = proposal.slice(0, -2); // Remove last "-number"
        proposal = `${proposal}-${copyNumber + 1}`;
      }

      copyNumber++;
    }

    if (!dryRun) {
      // Create a blank board with the proposed name
      const stmt = this.db.prepare(`
        INSERT INTO boards (workspace_id, board_id, title, tags, graph)
        VALUES (?, ?, ?, ?, ?)
      `);
      stmt.run(userStore, proposal, proposal, '', JSON.stringify({})); // Empty title, tags, and graph
    }

    const path = asPath(userStore, `${proposal}.bgl.json`);
    return { success: true, path };
  }

  async delete(userStore: string, path: string): Promise<{ success: boolean; error?: string }> {
    const { userStore: pathUserStore, boardName } = this.asInfo(path);

    // Check authorization
    if (pathUserStore !== userStore) {
      return { success: false, error: "Unauthorized" };
    }

    // Delete the board
    const stmt = this.db.prepare(`
      DELETE FROM boards
      WHERE workspace_id = ? AND board_id = ?
    `);
    const result = stmt.run(userStore, boardName);

    // Check if the deletion was successful
    if (result.changes > 0) {
      return { success: true };
    } else {
      return { success: false, error: "Board not found" };
    }
  }

  async findInvite(
    userStore: string,
    boardName: string,
    invite: string
  ): Promise<{ success: boolean; error?: string }> {
    // Prepare and execute SQL query
    const stmt = this.db.prepare(`
      SELECT 1
      FROM invites
      WHERE workspace_id = ? AND board_id = ? AND invite = ?
    `);
    const row = stmt.get(userStore, boardName, invite);

    // Check if invite exists
    if (row) {
      return { success: true };
    } else {
      return { success: false, error: "Board or invite not found" };
    }
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
    const expireAt = Date.now() + INVITE_EXPIRATION_TIME_MS;

    // Check if invite already exists
    const existingInvite = this.findInvite(userStore, boardName, invite)

    if (existingInvite) {
      return { success: false, error: "Invite already exists." };
    }

    // Insert new invite
    const stmt = this.db.prepare(`
      INSERT INTO invites (workspace_id, board_id, invite, expire_at)
      VALUES (?, ?, ?, ?)
    `);
    try {
      stmt.run(userStore, boardName, invite, expireAt);
      return { success: true, invite };
    } catch (error) {
      return { success: false, error: "Failed to create invite." };
    }
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

    const stmt = this.db.prepare(`
      DELETE FROM invites
      WHERE workspace_id = ? AND board_id = ? AND invite = ?
    `);

    try {
      const result = stmt.run(userStore, boardName, invite);
      // Check if any rows were affected
      if (result.changes === 0) {
        return { success: false, error: "Invite not found or already deleted." };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: "Failed to delete invite." };
    }
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

    const stmt = this.db.prepare(`
      SELECT invite FROM invites
      WHERE workspace_id = ? AND board_id = ?
    `);

    try {
      const rows = stmt.all(userStore, boardName);
      const invites = rows.map(row => row.invite);
      return { success: true, invites };
    } catch (error) {
      return { success: false, error: "Failed to list invites." };
    }
  }

  async createUser(username: string, apiKey: string): Promise<CreateUserResult> {
    return new Promise((resolve) => {
      try {
        // Check if the user already exists
        const checkStmt = this.db.prepare('SELECT api_key FROM users WHERE id = ?');
        const existingUser = checkStmt.get(username);

        if (existingUser) {
          resolve({
            success: false,
            message: `Account ${username} already exists with API key:\n${existingUser.apiKey}`
          });
          return;
        }

        // Insert new user
        const userInsertStmt = this.db.prepare('INSERT INTO users (id, api_key) VALUES (?, ?)');
        userInsertStmt.run(username, apiKey);

        // Insert workspace
        const wsInsertStmt = this.db.prepare('INSERT INTO workspaces (id) VALUES (?)');
        wsInsertStmt.run(username);

        resolve({ success: true, apiKey });
      } catch (error) {
        resolve({ success: false, message: error.message });
      }
    });
  }
}
