import assert from "node:assert";
import test, { beforeEach, suite } from "node:test";
import { IN_MEMORY_SERVER_INFO, InMemoryStorageProvider } from "./inmemory.js";
import type { StorageBoard } from "../store.js";
import type { GraphDescriptor } from "@google-labs/breadboard";

suite("In-memory storage provider", () => {
  let provider: InMemoryStorageProvider;

  beforeEach(() => {
    provider = new InMemoryStorageProvider();
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
    assert.deepEqual(await provider.getServerInfo(), IN_MEMORY_SERVER_INFO);
  });

  test("create board", async () => {
    assert.equal(await provider.loadBoard({ name: "test-board" }), null);

    provider.createBoard("user", "test-board");

    assert.deepEqual(await provider.loadBoard({ name: "test-board" }), {
      name: "test-board",
      owner: "user",
      displayName: "test-board",
      description: "",
      tags: [],
      thumbnail: "",
      graph: {
        description: "",
        edges: [],
        nodes: [],
        title: "Untitled Flow",
        version: "0.0.1",
      },
    });
  });

  test("update board", async () => {
    assert.equal(await provider.loadBoard({ name: "test-board" }), null);

    const updatedBoard: StorageBoard = {
      name: "test-board",
      owner: "user",
      displayName: "Test Board",
      description: "Board For Testing",
      tags: ["published"],
      thumbnail: "",
      graph: GRAPH,
    };

    // Technically, it's not necessary to create the board first
    provider.updateBoard(updatedBoard);

    assert.deepEqual(
      await provider.loadBoard({ name: "test-board" }),
      updatedBoard
    );
  });

  test("upsert board", async () => {
    const board: StorageBoard = {
      name: '',  // Explicitly no name - new board.
      owner: '',
      displayName: "Test Board",
      description: "Board For Testing",
      tags: ["published"],
      thumbnail: "tbnail",
      graph: GRAPH,
    };

    const created = await provider.upsertBoard(board);
    assert.notEqual(created.name, ""); // The result must have a name assigned.
    board.name = created.name;
    assert.deepEqual(created, board);
    board.description = 'updated';
    const updated = await provider.upsertBoard(board);
    assert.deepEqual(updated, board);
  });

  test("load board by name", async () => {
    const board = {
      name: "test-board",
      owner: "me",
      displayName: "Owned Board",
      description: "",
      tags: [],
      thumbnail: "",
      graph: GRAPH,
    };

    await provider.updateBoard(board);

    assert.deepEqual(await provider.loadBoard({ name: "test-board" }), board);
    assert.equal(await provider.loadBoard({ name: "other-board" }), null);
  });

  test("list boards", async () => {
    const ownedBoard: StorageBoard = {
      name: "ownedBoard",
      owner: "me",
      displayName: "Owned Board",
      description: "",
      tags: [],
      thumbnail: "",
      graph: GRAPH,
    };
    const publishedBoard: StorageBoard = {
      name: "publishedBoard",
      owner: "you",
      displayName: "Published Board",
      description: "",
      tags: ["published"],
      thumbnail: "",
      graph: GRAPH,
    };
    const privateBoard: StorageBoard = {
      name: "privateBoard",
      owner: "you",
      displayName: "Private Board",
      description: "",
      tags: [],
      thumbnail: "",
      graph: GRAPH,
    };

    provider.updateBoard(ownedBoard);
    provider.updateBoard(publishedBoard);
    provider.updateBoard(privateBoard);

    const boards = await provider.listBoards("me");

    assert(boards.includes(ownedBoard));
    assert(boards.includes(publishedBoard));
    assert(!boards.includes(privateBoard));
  });
});

const GRAPH: GraphDescriptor = {
  nodes: [{ type: "output", id: "output" }],
  edges: [],
};
