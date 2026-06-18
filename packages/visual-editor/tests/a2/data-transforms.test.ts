/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, mock, afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { stubModuleArgs } from "../useful-stubs.js";
import { ok } from "@breadboard-ai/utils/outcome.js";
import { setDOM, unsetDOM } from "../fake-dom.js";

// Lazy imports — these modules access `window` at module scope.
let driveFileToBlob: typeof import("../../src/a2/a2/data-transforms.js").driveFileToBlob;
let createDataPartTansformer: typeof import("../../src/a2/a2/data-transforms.js").createDataPartTansformer;

describe("data-transforms: callBackend migration", () => {

  beforeEach(async () => {
    setDOM();
    // Dynamic import after DOM globals are available.
    const mod = await import("../../src/a2/a2/data-transforms.js");
    driveFileToBlob = mod.driveFileToBlob;
    createDataPartTansformer = mod.createDataPartTansformer;
  });

  afterEach(() => {
    mock.restoreAll();
    unsetDOM();
  });

  // ---------- uploadBlobFile (via driveFileToBlob / D2B transform) ----------

  describe("uploadBlobFile (driveFileToBlob)", () => {

    it("sends HTTP request via backend client", async () => {

      const backendClientMock = {
        sendHttpRequest: mock.fn(async () => {
          return new Response(
            JSON.stringify({
              blobId: "def-456",
              mimeType: "image/jpeg",
            }),
            { status: 200 }
          );
        }),
      };

      const fetchMock = mock.fn();

      const moduleArgs = {
        ...stubModuleArgs,
        fetchWithCreds: fetchMock as unknown as typeof globalThis.fetch,
        backendClient: Promise.resolve(backendClientMock as any),
      };

      const result = await driveFileToBlob(moduleArgs, {
        storedData: { handle: "drive:/another-file-id", mimeType: "image/jpeg" },
      });

      assert.ok(ok(result));
      assert.match(result.part.storedData.handle, /\/board\/blobs\/def-456$/);
      assert.equal(result.part.storedData.mimeType, "image/jpeg");
      assert.equal(backendClientMock.sendHttpRequest.mock.calls.length, 1);
      assert.equal(fetchMock.mock.calls.length, 0);

      const [methodName, options] = backendClientMock.sendHttpRequest.mock
        .calls[0].arguments as unknown as [string, any];
      assert.equal(methodName, "uploadBlobFile");
      assert.equal(options.method, "POST");
      assert.deepStrictEqual(options.body, { driveFileId: "another-file-id" });
    });

    it("returns error on non-ok response", async () => {

      const backendClientMock = {
        sendHttpRequest: mock.fn(async () => {
          return new Response(
            JSON.stringify({
              error: {
                code: 500,
                message: "Internal error",
                status: "INTERNAL",
              },
            }),
            { status: 500 }
          );
        }),
      };

      const moduleArgs = {
        ...stubModuleArgs,
        fetchWithCreds: mock.fn() as unknown as typeof globalThis.fetch,
        backendClient: Promise.resolve(backendClientMock as any),
      };

      const result = await driveFileToBlob(moduleArgs, {
        storedData: { handle: "drive:/fail-id", mimeType: "image/png" },
      });

      assert.ok(!ok(result));
    });

    it("skips backend call for already-blobbed handles", async () => {

      const fetchMock = mock.fn();
      const moduleArgs = {
        ...stubModuleArgs,
        fetchWithCreds: fetchMock as unknown as typeof globalThis.fetch,
      };

      const blobHandle = `${globalThis.window.location.origin}/board/blobs/12345678-1234-1234-1234-123456789abc`;
      const result = await driveFileToBlob(moduleArgs, {
        storedData: { handle: blobHandle, mimeType: "image/png" },
      });

      assert.ok(ok(result));
      assert.equal(result.part.storedData.handle, blobHandle);
      assert.equal(fetchMock.mock.calls.length, 0);
    });
  });

  // ---------- uploadGeminiFile (via toFileData / D2F transform) ----------

  describe("uploadGeminiFile (toFileData)", () => {

    it("sends HTTP request via backend client", async () => {

      const backendClientMock = {
        sendHttpRequest: mock.fn(async () => {
          return new Response(
            JSON.stringify({
              fileUrl: "files/backend-file-456",
              mimeType: "image/jpeg",
            }),
            { status: 200 }
          );
        }),
      };

      const fetchMock = mock.fn();

      const moduleArgs = {
        ...stubModuleArgs,
        fetchWithCreds: fetchMock as unknown as typeof globalThis.fetch,
        backendClient: Promise.resolve(backendClientMock as any),
      };

      const transformer = createDataPartTansformer(moduleArgs);
      const result = await transformer.toFileData(new URL("drive:/stub"), {
        storedData: {
          handle: "drive:/drive-file-id",
          mimeType: "image/jpeg",
        },
      });

      assert.ok(ok(result));
      assert.match(result.fileData.fileUri, /files\/backend-file-456$/);
      assert.equal(result.fileData.mimeType, "image/jpeg");
      assert.equal(backendClientMock.sendHttpRequest.mock.calls.length, 1);
      assert.equal(fetchMock.mock.calls.length, 0);

      const [methodName, options] = backendClientMock.sendHttpRequest.mock
        .calls[0].arguments as unknown as [string, any];
      assert.equal(methodName, "uploadGeminiFile");
      assert.equal(options.method, "POST");
      assert.deepStrictEqual(options.body, { driveFileId: "drive-file-id" });
    });

    it("uses sendHttpRequest for blob-to-gemini path", async () => {

      const backendClientMock = {
        sendHttpRequest: mock.fn(async () => {
          return new Response(
            JSON.stringify({
              fileUrl: "files/blob-file-789",
              mimeType: "application/octet-stream",
            }),
            { status: 200 }
          );
        }),
      };

      const fetchMock = mock.fn();

      const blobHandle = `${globalThis.window.location.origin}/board/blobs/12345678-1234-1234-1234-123456789abc`;
      const moduleArgs = {
        ...stubModuleArgs,
        fetchWithCreds: fetchMock as unknown as typeof globalThis.fetch,
        backendClient: Promise.resolve(backendClientMock as any),
      };

      const transformer = createDataPartTansformer(moduleArgs);
      const result = await transformer.toFileData(new URL("drive:/stub"), {
        storedData: {
          handle: blobHandle,
          mimeType: "application/octet-stream",
        },
      });

      assert.ok(ok(result));
      assert.match(result.fileData.fileUri, /files\/blob-file-789$/);
      assert.equal(backendClientMock.sendHttpRequest.mock.calls.length, 1);
      assert.equal(fetchMock.mock.calls.length, 0);

      const [methodName, options] = backendClientMock.sendHttpRequest.mock
        .calls[0].arguments as unknown as [string, any];
      assert.equal(methodName, "uploadGeminiFile");
      assert.deepStrictEqual(options.body, {
        blobId: "12345678-1234-1234-1234-123456789abc",
      });
    });

    it("returns error on non-ok response", async () => {

      const backendClientMock = {
        sendHttpRequest: mock.fn(async () => {
          return new Response(
            JSON.stringify({
              error: {
                code: 400,
                message: "Bad request",
                status: "BAD_REQUEST",
              },
            }),
            { status: 400 }
          );
        }),
      };

      const moduleArgs = {
        ...stubModuleArgs,
        fetchWithCreds: mock.fn() as unknown as typeof globalThis.fetch,
        backendClient: Promise.resolve(backendClientMock as any),
      };

      const transformer = createDataPartTansformer(moduleArgs);
      const result = await transformer.toFileData(new URL("drive:/stub"), {
        storedData: {
          handle: "drive:/fail-file",
          mimeType: "image/png",
        },
      });

      assert.ok(!ok(result));
    });
  });
});
