import type { Express } from "express";
import assert from "node:assert";
import { before, suite, test } from "node:test";
import request from "supertest";

import { createServer, createServerConfig } from "../../src/server.js";
import { createAccount, getStore } from "../../src/server/store.js";

// TODO There's no type defined for this. There probably should be.
type User = { account: string; api_key: string };

suite("Board Server integration test", () => {
  let server: Express;
  let user: User;

  before(async () => {
    const allowedOrigins = "";
    process.env.STORAGE_BUCKET = "test-bucket";
    const config = createServerConfig(allowedOrigins);
    server = createServer(config);
    user = await createAccount("test-user", "test-api-key");
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
      const response = await request(server).get(`/me?API_KEY=${user.api_key}`);
      assert.equal(response.status, 200);
    });
  });

  suite("Boards API", () => {
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
        `/boards?API_KEY=${user.api_key}`
      );
      assert.equal(response.status, 200);
    });

    test("POST /boards -> 401", async () => {
      const response = await request(server).post("/boards");
      assert.equal(response.status, 401);
    });

    test("POST /boards?API_KEY -> 200", async () => {
      const response = await request(server)
        .post(`/boards?API_KEY=${user.api_key}`)
        .send({ name: "board" });

      assert.equal(response.status, 200);
    });

    test("GET /boards/@:user/:name.json", async () => {
      const store = getStore();
      await store.create(user.account, "test-board");

      const response = await request(server).get(
        `/boards/@${user.account}/test-board?API_KEY=${user.api_key}`
      );

      assert.equal(response.status, 200);
    });

    test("POST /boards/@:user/:name.json -> updates", async () => {
      const store = getStore();
      await store.create(user.account, "test-board");

      const response = await request(server)
        .post(`/boards/@${user.account}/test-board?API_KEY=${user.api_key}`)
        .send({ nodes: [], edges: [] });

      assert.equal(response.status, 200);
      assert.deepEqual(response.body, {
        created: `@${user.account}/test-board`,
      });
    });

    test("POST /boards/@:user/:name.json -> deletes", async () => {
      const store = getStore();
      await store.create(user.account, "test-board");

      const response = await request(server)
        .post(`/boards/@${user.account}/test-board?API_KEY=${user.api_key}`)
        .send({ delete: true });

      assert.equal(response.status, 200);
      assert.deepEqual(response.body, {
        deleted: `@${user.account}/test-board`,
      });
    });

    // TODO Make this work. It tries to serve /index.html on the host machine, which fails
    test.skip("GET /boards/@:user/:name.app", async () => {
      const store = getStore();
      await store.create(user.account, "test-board");
      const path = `@${user.account}/test-board.app`;

      const response = await request(server).get(
        `/boards/${path}?API_KEY=${user.api_key}`
      );

      assert.equal(response.status, 200);
    });

    // TODO Make this work. It tries to serve /api.html on the host machine, which fails
    test.skip("GET /boards/@:user/:name.api", async () => {
      const store = getStore();
      await store.create(user.account, "test-board");
      const path = `@${user.account}/test-board.api`;

      const response = await request(server).get(
        `/boards/${path}?API_KEY=${user.api_key}`
      );

      assert.equal(response.status, 200);
    });

    test("POST /boards/@:user/:name.api/invoke", async () => {
      const store = getStore();
      await store.create(user.account, "test-board");
      await store.update(user.account, "test-board", {
        nodes: [{ type: "input", id: "input" }],
        edges: [],
      });
      const path = `@${user.account}/test-board.invoke`;

      const response = await request(server)
        .post(`/boards/${path}/invoke`)
        .send({ $key: user.api_key });

      assert.equal(response.status, 200);
    });

    // This test succeeds, but also hangs the test runner with no apparent error
    test.skip("POST /boards/@:user/:name.api/describe", async () => {
      const store = getStore();
      await store.create(user.account, "test-board");
      const path = `@${user.account}/test-board.invoke`;

      const response = await request(server)
        .post(`/boards/${path}/describe`)
        .send({});

      assert.equal(response.status, 200);
    });

    test("POST /boards/@:user/:name.api/run", async () => {
      const store = getStore();
      store.create(user.account, "test-board");
      const path = `@{user.account}/test-board.api/run`;

      const response = await request(server)
        .post(`/boards/${path}/run`)
        .send({});

      assert.equal(response.status, 200);
    });

    test("GET /boards/@:user/:name.invite", async () => {
      const store = getStore();
      store.create(user.account, "test-board");
      const path = `@${user.account}/test-board.invite`;

      const response = await request(server).get(
        `/boards/${path}?API_KEY=${user.api_key}`
      );

      assert.equal(response.status, 200);
    });

    test("POST /boards/@:user/:name.invite", async () => {
      const store = getStore();
      await store.create(user.account, "test-board");
      const path = `@${user.account}/test-board.invite`;

      const response = await request(server).post(
        `/boards/${path}?API_KEY=${user.api_key}`
      );

      assert.equal(response.status, 200);
    });

    // This test makes an HTTP call to the Drive API. Can't run this in a test.
    test.todo("POST /boards/@:user/:name.json/assets/drive/:id");
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
