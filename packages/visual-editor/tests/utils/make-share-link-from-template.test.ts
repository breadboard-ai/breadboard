/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { makeShareLinkFromTemplate } from "../../src/utils/make-share-link-from-template.js";

describe("makeShareLinkFromTemplate", () => {
  it("substitutes fileId into the template", () => {
    const result = makeShareLinkFromTemplate({
      urlTemplate: "https://example.com/share/{fileId}",
      fileId: "abc-123",
      resourceKey: undefined,
    });
    assert.equal(result, "https://example.com/share/abc-123");
  });

  it("substitutes resourceKey into the template", () => {
    const result = makeShareLinkFromTemplate({
      urlTemplate: "https://example.com/share/{fileId}?rk={resourceKey}",
      fileId: "abc-123",
      resourceKey: "key-456",
    });
    assert.equal(result, "https://example.com/share/abc-123?rk=key-456");
  });

  it("removes empty query params when resourceKey is undefined", () => {
    const result = makeShareLinkFromTemplate({
      urlTemplate: "https://example.com/share/{fileId}?rk={resourceKey}",
      fileId: "abc-123",
      resourceKey: undefined,
    });
    // Empty rk= param should be stripped
    assert.equal(result, "https://example.com/share/abc-123");
  });

  it("handles multiple occurrences of fileId", () => {
    const result = makeShareLinkFromTemplate({
      urlTemplate: "https://example.com/{fileId}/preview/{fileId}",
      fileId: "doc-id",
      resourceKey: undefined,
    });
    assert.equal(result, "https://example.com/doc-id/preview/doc-id");
  });
});
