/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isEmbedUri,
  isShareUri,
  isWatchUri,
  isShortsUri,
  convertShareUriToEmbedUri,
  convertWatchOrShortsUriToEmbedUri,
  videoIdFromWatchOrShortsOrEmbedUri,
  createWatchUriFromVideoId,
} from "../../src/utils/media/youtube.js";

describe("youtube", () => {
  describe("isEmbedUri", () => {
    it("returns true for embed URIs", () => {
      assert.equal(
        isEmbedUri("https://www.youtube.com/embed/dQw4w9WgXcQ"),
        true
      );
    });

    it("returns false for watch URIs", () => {
      assert.equal(
        isEmbedUri("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
        false
      );
    });

    it("returns false for null", () => {
      assert.equal(isEmbedUri(null), false);
    });

    it("returns false for empty string", () => {
      assert.equal(isEmbedUri(""), false);
    });
  });

  describe("isShareUri", () => {
    it("returns true for youtu.be URIs", () => {
      assert.equal(isShareUri("https://youtu.be/dQw4w9WgXcQ"), true);
    });

    it("returns false for full youtube.com URIs", () => {
      assert.equal(
        isShareUri("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
        false
      );
    });

    it("returns false for null", () => {
      assert.equal(isShareUri(null), false);
    });
  });

  describe("isWatchUri", () => {
    it("returns true for watch URIs", () => {
      assert.equal(
        isWatchUri("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
        true
      );
    });

    it("returns false for embed URIs", () => {
      assert.equal(
        isWatchUri("https://www.youtube.com/embed/dQw4w9WgXcQ"),
        false
      );
    });
  });

  describe("isShortsUri", () => {
    it("returns true for shorts URIs", () => {
      assert.equal(
        isShortsUri("https://www.youtube.com/shorts/dQw4w9WgXcQ"),
        true
      );
    });

    it("returns false for watch URIs", () => {
      assert.equal(
        isShortsUri("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
        false
      );
    });
  });

  describe("convertShareUriToEmbedUri", () => {
    it("converts share URI to embed URI", () => {
      assert.equal(
        convertShareUriToEmbedUri("https://youtu.be/dQw4w9WgXcQ"),
        "https://www.youtube.com/embed/dQw4w9WgXcQ"
      );
    });

    it("handles share URI with query params", () => {
      assert.equal(
        convertShareUriToEmbedUri("https://youtu.be/dQw4w9WgXcQ?t=42"),
        "https://www.youtube.com/embed/dQw4w9WgXcQ"
      );
    });

    it("returns null for non-share URI", () => {
      assert.equal(
        convertShareUriToEmbedUri("https://www.youtube.com/watch?v=xyz"),
        null
      );
    });
  });

  describe("convertWatchOrShortsUriToEmbedUri", () => {
    it("converts watch URI to embed URI", () => {
      assert.equal(
        convertWatchOrShortsUriToEmbedUri(
          "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        ),
        "https://www.youtube.com/embed/dQw4w9WgXcQ"
      );
    });

    it("converts shorts URI to embed URI", () => {
      assert.equal(
        convertWatchOrShortsUriToEmbedUri(
          "https://www.youtube.com/shorts/dQw4w9WgXcQ"
        ),
        "https://www.youtube.com/embed/dQw4w9WgXcQ"
      );
    });

    it("returns null for unrelated URI", () => {
      assert.equal(
        convertWatchOrShortsUriToEmbedUri("https://example.com"),
        null
      );
    });
  });

  describe("videoIdFromWatchOrShortsOrEmbedUri", () => {
    it("extracts ID from watch URI", () => {
      assert.equal(
        videoIdFromWatchOrShortsOrEmbedUri(
          "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        ),
        "dQw4w9WgXcQ"
      );
    });

    it("extracts ID from shorts URI", () => {
      assert.equal(
        videoIdFromWatchOrShortsOrEmbedUri(
          "https://www.youtube.com/shorts/abc123"
        ),
        "abc123"
      );
    });

    it("extracts ID from embed URI", () => {
      assert.equal(
        videoIdFromWatchOrShortsOrEmbedUri(
          "https://www.youtube.com/embed/xyz789"
        ),
        "xyz789"
      );
    });

    it("returns null for unrelated URI", () => {
      assert.equal(
        videoIdFromWatchOrShortsOrEmbedUri("https://example.com"),
        null
      );
    });
  });

  describe("createWatchUriFromVideoId", () => {
    it("creates a watch URI from a video ID", () => {
      assert.equal(
        createWatchUriFromVideoId("dQw4w9WgXcQ"),
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
      );
    });
  });
});
