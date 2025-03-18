import assert from "node:assert";
import test, { afterEach, before, suite } from "node:test";

import { Firestore } from "@google-cloud/firestore";

import type { GraphDescriptor } from "@google-labs/breadboard";

import type { ServerInfo, StorageBoard } from "../../src/server/store.js";
import { FirestoreStorageProvider } from "../../src/server/storage-providers/firestore.js";

suite("Firestore storage provider", () => {
  let database: Firestore;
  let provider: FirestoreStorageProvider;

  before(async () => {
    database = new Firestore({ databaseId: "firestore-provider-test" });
    provider = new FirestoreStorageProvider({ database });

    await database.doc("configuration/metadata").set(SERVER_INFO);
  });

  afterEach(async () => {
    await database.recursiveDelete(database.collection("users"));
    await database.recursiveDelete(database.collection("workspaces"));
  });

  test("users", async () => {
    await provider.createUser("user0", "key0");
    await provider.createUser("user1", "key1");

    assert.equal(await provider.findUserIdByApiKey("key0"), "user0");
    assert.equal(await provider.findUserIdByApiKey("key1"), "user1");
    assert.equal(await provider.findUserIdByApiKey("key2"), "");
  });

  test("errors on existing user", async () => {
    await provider.createUser("user0", "key0");
    assert.rejects(async () => await provider.createUser("user0", "key1"));
  });

  test("getServerInfo", async () => {
    assert.deepEqual(await provider.getServerInfo(), SERVER_INFO);
  });

  test("create board", async () => {
    assert.equal(await provider.loadBoard("test-user", "test-board"), null);

    await provider.createBoard("test-user", "test-board");

    assert.deepEqual(await provider.loadBoard("test-user", "test-board"), {
      description: "",
      displayName: "",
      graph: {
        description: "",
        edges: [],
        nodes: [],
        title: "Untitled Flow",
        version: "0.0.1",
      },
      name: "test-board",
      owner: "test-user",
      tags: [],
      thumbnail: "",
    });
  });

  test("update board", async () => {
    assert.equal(await provider.loadBoard("test-user", "test-board"), null);

    const updatedBoard: StorageBoard = {
      name: "test-board",
      owner: "test-user",
      displayName: "Test Board",
      description: "Board For Testing",
      tags: ["published"],
      thumbnail: "",
      graph: GRAPH,
    };

    // Technically, it's not necessary to create the board first
    await provider.updateBoard(updatedBoard);

    assert.deepEqual(
      await provider.loadBoard("test-user", "test-board"),
      updatedBoard
    );
  });

  test("list boards", async () => {
    await provider.updateBoard({
      name: "owned-board",
      owner: "me",
      displayName: "Owned Board",
      description: "",
      tags: [],
      thumbnail: "",
      graph: GRAPH,
    });
    await provider.updateBoard({
      name: "published-board",
      owner: "you",
      displayName: "Published Board",
      description: "",
      tags: ["published"],
      thumbnail: "",
      graph: GRAPH,
    });
    await provider.updateBoard({
      name: "private-board",
      owner: "you",
      displayName: "Private Board",
      description: "",
      tags: [],
      thumbnail: "",
      graph: GRAPH,
    });

    const boards = await provider.listBoards("me");
    const boardNames = boards.map((board) => board.name);

    assert(boardNames.includes("owned-board"));
    assert(boardNames.includes("published-board"));
    assert(!boardNames.includes("private-board"));
  });
});

const SERVER_INFO: ServerInfo = {
  title: "Firestore Storage Provider Test",
};

const GRAPH: GraphDescriptor = {
  nodes: [{ type: "output", id: "output" }],
  edges: [],
};
