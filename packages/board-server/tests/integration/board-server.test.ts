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
      const board = await store.create(user.account, "test-board", false);

      const response = await request(server).get(
        `/boards/${board.path}?API_KEY=${user.api_key}`
      );

      assert.equal(response.status, 200);
    });

    test("POST /boards/@:user/:name.json", async () => {
      const store = getStore();
      const board = await store.create(user.account, "test-board", false);

      const response = await request(server)
        .post(`/boards/${board.path}?API_KEY=${user.api_key}`)
        .send({ nodes: [], edges: [] });

      assert.equal(response.status, 200);
    });

    // TODO Make this work. It tries to serve /index.html on the host machine, which fails
    test.skip("GET /boards/@:user/:name.app", async () => {
      const store = getStore();
      const board = await store.create(user.account, "test-board", false);
      const path = board.path!.replace(".json", ".app");

      const response = await request(server).get(
        `/boards/${path}?API_KEY=${user.api_key}`
      );

      assert.equal(response.status, 200);
    });

    // TODO Make this work. It tries to serve /api.html on the host machine, which fails
    test.skip("GET /boards/@:user/:name.api", async () => {
      const store = getStore();
      const board = await store.create(user.account, "test-board", false);
      const path = board.path!.replace(".json", ".api");

      const response = await request(server).get(
        `/boards/${path}?API_KEY=${user.api_key}`
      );

      assert.equal(response.status, 200);
    });

    test("POST /boards/@:user/:name.api/invoke", async () => {
      const store = getStore();
      const board = await store.create(user.account, "test-board", false);
      await store.update(user.account, "test-board", {
        nodes: [{ type: "input", id: "input" }],
        edges: [],
      });
      const path = board.path!.replace(".json", ".api");

      const response = await request(server)
        .post(`/boards/${path}/invoke`)
        .send({ $key: user.api_key });

      assert.equal(response.status, 200);
    });

    // This test succeeds, but also hangs the test runner with no apparent error
    test.skip("POST /boards/@:user/:name.api/describe", async () => {
      const store = getStore();
      const board = await store.create(user.account, "test-board", false);
      const path = board.path!.replace(".json", ".api");

      const response = await request(server)
        .post(`/boards/${path}/describe`)
        .send({});

      assert.equal(response.status, 200);
    });

    test("POST /boards/@:user/:name.api/run", async () => {
      const store = getStore();
      const board = await store.create(user.account, "test-board", false);
      const path = board.path!.replace(".json", ".api");

      const response = await request(server)
        .post(`/boards/${path}/run`)
        .send({});

      assert.equal(response.status, 200);
    });

    test("GET /boards/@:user/:name.invite", async () => {
      const store = getStore();
      const board = await store.create(user.account, "test-board", false);
      const path = board.path!.replace(".json", ".invite");

      const response = await request(server).get(
        `/boards/${path}?API_KEY=${user.api_key}`
      );

      assert.equal(response.status, 200);
    });

    test("POST /boards/@:user/:name.invite", async () => {
      const store = getStore();
      const board = await store.create(user.account, "test-board", false);
      const path = board.path!.replace(".json", ".invite");

      const response = await request(server).post(
        `/boards/${path}?API_KEY=${user.api_key}`
      );

      assert.equal(response.status, 200);
    });

    // This test makes an HTTP call to the Drive API. Can't run this in a test.
    test.todo("POST /boards/@:user/:name.json/assets/drive:id");
  });

  // TODO Figure out how to test these endpoint
  suite.todo("Proxy API", () => {});
  suite.todo("Blobs API", () => {});
});
