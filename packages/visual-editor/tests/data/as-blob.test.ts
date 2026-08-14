/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, mock, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { asBlob } from "../../src/data/common.js";

describe("asBlob", () => {
  beforeEach(() => {
    mock.restoreAll();
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it("rejects a relative URL handle", async () => {
    const fakeFetch = mock.fn(async () => new Response("data"));
    mock.method(globalThis, "fetch", fakeFetch);

    const part = {
      storedData: {
        handle: "/path/to/resource",
        mimeType: "application/json",
      },
    };

    await assert.rejects(
      () => asBlob(part),
      (error: Error) => {
        assert.ok(
          error.message.length > 0,
          "Expected a validation error message"
        );
        return true;
      },
      "asBlob should reject storedData handles that are relative URLs"
    );

    assert.equal(
      fakeFetch.mock.callCount(),
      0,
      "fetch must not be called for a relative URL handle"
    );
  });

  it("rejects an https: URL handle", async () => {
    const fakeFetch = mock.fn(async () => new Response("data"));
    mock.method(globalThis, "fetch", fakeFetch);

    const part = {
      storedData: {
        handle: "https://example.com/data",
        mimeType: "application/json",
      },
    };

    await assert.rejects(
      () => asBlob(part),
      (error: Error) => {
        assert.ok(
          error.message.length > 0,
          "Expected a validation error message"
        );
        return true;
      },
      "asBlob should reject storedData handles with https: scheme"
    );

    assert.equal(
      fakeFetch.mock.callCount(),
      0,
      "fetch must not be called for an https: storedData handle"
    );
  });

  it("rejects an http: URL handle", async () => {
    const fakeFetch = mock.fn(async () => new Response("data"));
    mock.method(globalThis, "fetch", fakeFetch);

    const part = {
      storedData: {
        handle: "http://example.com/data",
        mimeType: "application/json",
      },
    };

    await assert.rejects(
      () => asBlob(part),
      (error: Error) => {
        assert.ok(
          error.message.length > 0,
          "Expected a validation error message"
        );
        return true;
      },
      "asBlob should reject storedData handles with http: scheme"
    );

    assert.equal(
      fakeFetch.mock.callCount(),
      0,
      "fetch must not be called for an http: storedData handle"
    );
  });

  it("fetches a valid blob: URL handle", async () => {
    const fakeFetch = mock.fn(async () => new Response("blob-data"));
    mock.method(globalThis, "fetch", fakeFetch);

    const part = {
      storedData: {
        handle: "blob:http://localhost/1234-5678",
        mimeType: "image/png",
      },
    };

    const blob = await asBlob(part);
    assert.ok(blob);
    assert.equal(fakeFetch.mock.callCount(), 1);
  });

  it("fetches a valid data: URL handle", async () => {
    const fakeFetch = mock.fn(async () => new Response("data-content"));
    mock.method(globalThis, "fetch", fakeFetch);

    const part = {
      storedData: {
        handle: "data:text/plain;base64,SGVsbG8=",
        mimeType: "text/plain",
      },
    };

    const blob = await asBlob(part);
    assert.ok(blob);
    assert.equal(fakeFetch.mock.callCount(), 1);
  });
});
