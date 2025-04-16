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
    assertNoBoard("test-user", "test-board");

    await provider.createBoard("test-user", "test-board");

    assertBoard({
      name: "test-board",
      owner: "test-user",
      description: "",
      displayName: "",
      tags: [],
      thumbnail: "",
    });
  });

  test("update board", async () => {
    assertNoBoard("test-user", "test-board");

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
    await provider.upsertBoard(updatedBoard);

    assertBoard(updatedBoard);
    assertGraph(updatedBoard);
  });

  test("load board by name", async () => {
    const ownedBoard = {
      name: "owned-board",
      owner: "me",
      displayName: "Owned Board",
      description: "",
      tags: [],
      thumbnail: "",
      graph: GRAPH,
    };
    const publishedBoard = {
      name: "published-board",
      owner: "you",
      displayName: "Published Board",
      description: "",
      tags: ["published"],
      thumbnail: "",
      graph: GRAPH,
    };
    const unlistedBoard = {
      name: "unlisted-board",
      owner: "you",
      displayName: "Unlisted Board",
      description: "",
      tags: [],
      thumbnail: "",
      graph: GRAPH,
    };
    const privateBoard = {
      name: "private-board",
      owner: "you",
      displayName: "Private Board",
      description: "",
      tags: ["private"],
      thumbnail: "",
      graph: GRAPH,
    };

    await provider.upsertBoard(ownedBoard);
    await provider.upsertBoard(publishedBoard);
    await provider.upsertBoard(unlistedBoard);
    await provider.upsertBoard(privateBoard);

    const ownedBoardResult = await provider.loadBoard({
      name: "owned-board",
      requestingUserId: "me",
    });
    const publishedBoardResult = await provider.loadBoard({
      name: "published-board",
      requestingUserId: "me",
    });
    const unlistedBoardResult = await provider.loadBoard({
      name: "unlisted-board",
      requestingUserId: "me",
    });
    const privateBoardResult = await provider.loadBoard({
      name: "private-board",
      requestingUserId: "me",
    });
    const nonExistentBoard = await provider.loadBoard({
      name: "non-existent",
      requestingUserId: "me",
    });

    assert.deepEqual(ownedBoardResult, ownedBoard);
    assert.deepEqual(publishedBoardResult, publishedBoard);
    assert.deepEqual(unlistedBoardResult, unlistedBoard);
    assert.equal(privateBoardResult, null);
    assert.equal(nonExistentBoard, null);
  });

  test("list boards", async () => {
    const ownedBoard = {
      name: "owned-board",
      owner: "me",
      displayName: "Owned Board",
      description: "",
      tags: [],
      thumbnail: "",
      graph: GRAPH,
    };
    const publishedBoard = {
      name: "published-board",
      owner: "you",
      displayName: "Published Board",
      description: "",
      tags: ["published"],
      thumbnail: "",
      graph: GRAPH,
    };
    const privateBoard = {
      name: "private-board",
      owner: "you",
      displayName: "Private Board",
      description: "",
      tags: [],
      thumbnail: "",
      graph: GRAPH,
    };

    await provider.upsertBoard(ownedBoard);
    await provider.upsertBoard(publishedBoard);
    await provider.upsertBoard(privateBoard);

    const boards = await provider.listBoards("me");
    assert.equal(boards.length, 2);

    const ownedBoardResult = boards.find(
      (board) => board.name === "owned-board"
    );
    const publishedBoardResult = boards.find(
      (board) => board.name === "published-board"
    );
    const privateBoardResult = boards.find(
      (board) => board.name === "private-board"
    );

    assert.deepEqual(ownedBoardResult, ownedBoard);
    assert.deepEqual(publishedBoardResult, publishedBoard);
    assert.equal(privateBoardResult, undefined);
  });

  async function assertNoBoard(owner: string, name: string) {
    const path = `/workspaces/${owner}/boards/${name}`;
    const doc = await database.doc(path).get();
    assert(!doc.exists);
  }

  async function assertBoard(expected: StorageBoard) {
    const path = `/workspaces/${expected.owner}/boards/${expected.name}`;
    const doc = await database.doc(path).get();

    assert(doc.exists);
    assert.equal(doc.get("name"), expected.name);
    assert.equal(doc.get("title") ?? "", expected.displayName);
    assert.equal(doc.get("description") ?? "", expected.description);
    assert.deepEqual(doc.get("tags") ?? [], expected.tags);
  }

  async function assertGraph(expected: StorageBoard) {
    const path = `/workspaces/${expected.owner}/boards/${expected.name}`;
    const doc = await database.doc(path).get();
    assert(doc.exists);
    assert.deepEqual(JSON.parse(doc.get("graph")), expected.graph);
  }
});

const SERVER_INFO: ServerInfo = {
  title: "Firestore Storage Provider Test",
};

const GRAPH: GraphDescriptor = {
  nodes: [{ type: "output", id: "output" }],
  edges: [],
};
