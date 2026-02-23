/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { beforeEach, afterEach, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { setDOM, unsetDOM } from "../fake-dom.js";

describe("blob-handle-to-url", () => {
  beforeEach(() => {
    setDOM();
  });

  afterEach(() => {
    unsetDOM();
    mock.restoreAll();
  });

  it("converts a relative blob handle to a URL", async () => {
    const { blobHandleToUrl } =
      await import("../../src/ui/media/blob-handle-to-url.js");

    const result = blobHandleToUrl("../../blobs/abc-123");
    assert.ok(result);
    assert.equal(result.pathname, "/board/blobs/abc-123");
  });

  it("converts a ./blobs/ handle to a URL", async () => {
    const { blobHandleToUrl } =
      await import("../../src/ui/media/blob-handle-to-url.js");

    const result = blobHandleToUrl("./blobs/def-456");
    assert.ok(result);
    assert.equal(result.pathname, "/board/blobs/def-456");
  });

  it("converts a plain blobs/ handle to a URL", async () => {
    const { blobHandleToUrl } =
      await import("../../src/ui/media/blob-handle-to-url.js");

    const result = blobHandleToUrl("blobs/ghi-789");
    assert.ok(result);
    assert.equal(result.pathname, "/board/blobs/ghi-789");
  });

  it("returns a URL for data: handles", async () => {
    const { blobHandleToUrl } =
      await import("../../src/ui/media/blob-handle-to-url.js");

    const result = blobHandleToUrl("data:image/png;base64,abc");
    assert.ok(result);
    assert.equal(result.protocol, "data:");
  });

  it("returns a URL for https: handles", async () => {
    const { blobHandleToUrl } =
      await import("../../src/ui/media/blob-handle-to-url.js");

    const result = blobHandleToUrl("https://example.com/image.png");
    assert.ok(result);
    assert.equal(result.hostname, "example.com");
  });

  it("returns a URL for drive: handles", async () => {
    const { blobHandleToUrl } =
      await import("../../src/ui/media/blob-handle-to-url.js");

    const result = blobHandleToUrl("drive:some-id");
    assert.ok(result);
    assert.equal(result.protocol, "drive:");
  });

  it("returns undefined for unrecognized handles", async () => {
    const { blobHandleToUrl } =
      await import("../../src/ui/media/blob-handle-to-url.js");

    const result = blobHandleToUrl("unknown:foo");
    assert.equal(result, undefined);
  });

  it("exports BLOB_HANDLE_PATTERN", async () => {
    const { BLOB_HANDLE_PATTERN } =
      await import("../../src/ui/media/blob-handle-to-url.js");
    assert.ok(BLOB_HANDLE_PATTERN instanceof RegExp);
    assert.ok(BLOB_HANDLE_PATTERN.test("../../blobs/abc"));
    assert.ok(!BLOB_HANDLE_PATTERN.test("not-a-blob"));
  });
});
