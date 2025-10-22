import type { Express } from "express";
import assert from "node:assert";
import { before, suite, test } from "node:test";
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
