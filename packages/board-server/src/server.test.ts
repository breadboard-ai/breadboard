import type { Express } from "express";
import assert from "node:assert";
import { afterEach, before, suite, test } from "node:test";
import request from "supertest";

import { createServer, createServerConfig } from "./server.js";
import type { BoardServerStore, StorageBoard } from "./server/store.js";

suite("Board Server integration test", () => {
  const user = { username: "test-user", apiKey: "test-api-key" };

  let server: Express;
  let store: BoardServerStore;
  const defaultBoard: Readonly<Partial<StorageBoard>> = {
    name: "test-board",
    owner: user.username,
    graph: {
      nodes: [{ type: "input", id: "input" }],
      edges: [],
    },
  };

  before(async () => {
    process.env.STORAGE_BUCKET = "test-bucket";
    server = createServer(createServerConfig({ storageProvider: "in-memory" }));
    store = server.locals.store;
    await store.createUser(user.username, user.apiKey);
  });

  suite("Info API", () => {
    test("GET / -> 200", async () => {
      const response = await request(server).get("/");
      assert.equal(response.status, 200);
    });
  });

  suite("Me API", () => {
    test("GET /me -> 401", async () => {
      const response = await request(server).get("/me");
      assert.equal(response.status, 401);
    });

    test("GET /me?API_KEY -> 200", async () => {
      const response = await request(server).get(`/me?API_KEY=${user.apiKey}`);
      assert.equal(response.status, 200);
    });
  });

  suite("Boards API", () => {
    afterEach(async () => {
      await store.deleteBoard(user.username, "test-board");
      await store.deleteBoard(user.username, "test-board.json");
    });

    test("OPTIONS /boards -> 204", async () => {
      const response = await request(server).options(`/boards`);
      assert.equal(response.status, 204);
    });

    test("GET /boards -> 401", async () => {
      const response = await request(server).get("/boards");
      assert.equal(response.status, 401);
    });

    test("GET /boards?API_KEY -> 200", async () => {
      const response = await request(server).get(
        `/boards?API_KEY=${user.apiKey}`
      );
      assert.equal(response.status, 200);
    });

    test("POST /boards -> 401", async () => {
      const response = await request(server).post("/boards");
      assert.equal(response.status, 401);
    });

    test("POST /boards?API_KEY -> 200", async () => {
      const response = await request(server)
        .post(`/boards?API_KEY=${user.apiKey}`)
        .send({ name: "board" });

      assert.equal(response.status, 200);
    });

    test("GET /boards/@:user/:name", async () => {
      await store.upsertBoard(defaultBoard);

      const response = await request(server).get(
        `/boards/@${user.username}/test-board?API_KEY=${user.apiKey}`
      );

      assert.equal(response.status, 200);
    });

    test("GET /:name", async () => {
      await store.upsertBoard(defaultBoard);

      const response = await request(server).get(
        `/boards/test-board?API_KEY=${user.apiKey}`
      );

      assert.equal(response.status, 200);
    });

    test("POST /boards/@:user/:name -> updates", async () => {
      await store.upsertBoard(defaultBoard);

      const response = await request(server)
        .post(`/boards/@${user.username}/test-board?API_KEY=${user.apiKey}`)
        .send({ nodes: [], edges: [] });

      assert.equal(response.status, 200);
      assert.equal(response.body.created, `@${user.username}/test-board`);
    });

    test("POST /boards/:name -> updates", async () => {
      await store.upsertBoard(defaultBoard);

      const response = await request(server)
        .post(`/boards/test-board?API_KEY=${user.apiKey}`)
        .send({ nodes: [], edges: [] });

      assert.equal(response.status, 200);
      assert.equal(response.body.created, `@${user.username}/test-board`);
    });

    test("POST /boards/@:user/:name -> deletes", async () => {
      await store.upsertBoard(defaultBoard);

      const response = await request(server)
        .post(`/boards/@${user.username}/test-board?API_KEY=${user.apiKey}`)
        .send({ delete: true });

      assert.equal(response.status, 200);
      assert.deepEqual(response.body, {
        deleted: `@${user.username}/test-board`,
      });
    });

    test("POST /boards/:name -> deletes", async () => {
      await store.upsertBoard(defaultBoard);

      const response = await request(server)
        .post(`/boards/test-board?API_KEY=${user.apiKey}`)
        .send({ delete: true });

      assert.equal(response.status, 200);
      assert.deepEqual(response.body, {
        deleted: `@${user.username}/test-board`,
      });
    });

    test("POST /boards/@:user/:name.api/invoke", async () => {
      await store.upsertBoard({...defaultBoard, name: 'test-board.json'});

      const response = await request(server)
        .post(`/boards/@${user.username}/test-board.api/invoke`)
        .send({ $key: user.apiKey });

      assert.equal(response.status, 200);
    });

    test("POST /boards/@:user/:name/invoke", async () => {
      await store.upsertBoard(defaultBoard);

      const response = await request(server)
        .post(`/boards/@${user.username}/test-board/invoke`)
        .send({ $key: user.apiKey });

      assert.equal(response.status, 200);
    });

    test("POST /boards/@:user/:name.api/describe", async () => {
      await store.upsertBoard({...defaultBoard, name: 'test-board.json'});
      const path = `@${user.username}/test-board.api`;

      const response = await request(server)
        .post(`/boards/${path}/describe`)
        .send({});

      assert.equal(response.status, 200);
    });

    test("POST /boards/@:user/:name/describe", async () => {
      await store.upsertBoard(defaultBoard);
      const path = `@${user.username}/test-board`;

      const response = await request(server)
        .post(`/boards/${path}/describe`)
        .send({});

      assert.equal(response.status, 200);
    });

    test("POST /boards/:name/describe", async () => {
      await store.upsertBoard(defaultBoard);

      const response = await request(server)
        .post(`/boards/test-board/describe?API_KEY=${user.apiKey}`)
        .send({});

      assert.equal(response.status, 200);
    });

    test("POST /boards/@:user/:name.api/run", async () => {
      await store.upsertBoard({...defaultBoard, name: 'test-board.json'});

      const response = await request(server)
        .post(`/boards/@${user.username}/test-board.api/run`)
        .send({});

      assert.equal(response.status, 200);
    });

    test("POST /boards/@:user/:name/run", async () => {
      await store.upsertBoard(defaultBoard);

      const response = await request(server)
        .post(`/boards/@${user.username}/test-board/run`)
        .send({});

      assert.equal(response.status, 200);
    });

    // This test makes an HTTP call to the Drive API. Can't run this in a test.
    test.todo("POST /boards/@:user/:name.json/assets/drive/:id");
    test.todo("POST /boards/@:user/:name/assets/drive/:id");
    test.todo("POST /boards/:name/assets/drive/:id");
  });

  suite.todo("Blobs API", () => {
    test("GET /blobs/:blobId", async () => {
      const response = await request(server).get("/blobs/abc");

      assert.equal(response.status, 400);
      assert.equal(response.text, "Invalid blob ID");
    });

    test("POST /blobs/:blobId/file", async () => {
      const response = await request(server).post("/blobs/abc/file");

      assert.equal(response.status, 400);
      assert.equal(response.text, "Invalid blob ID");
    });

    // TODO Figure out how to test these. They make request against blobstore.
    test("GET /blobs/:blobId");
    test.todo("POST /blobs");
    test.todo("POST /blobs/:blobId/file", async () => {});
  });

  // TODO Figure out how to test this endpoint
  suite.todo("Proxy API", () => {});
});
