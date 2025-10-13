import type { Express } from "express";
import assert from "node:assert";
import { afterEach, before, suite, test } from "node:test";
import request from "supertest";

import { createServer, createServerConfig } from "./server.js";
import type { BoardServerStore } from "./server/store.js";

suite("Board Server integration test", () => {
  const user = { username: "test-user", apiKey: "test-api-key" };

  let server: Express;
  let store: BoardServerStore;

  before(async () => {
    process.env.STORAGE_BUCKET = "test-bucket";
    server = createServer(
      createServerConfig({
        storageProvider: "in-memory",
      })
    );
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
  });

  // TODO Figure out how to test this endpoint
  suite.todo("Proxy API", () => {});
});
