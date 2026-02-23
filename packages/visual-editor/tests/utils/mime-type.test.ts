/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { LLMContent } from "@breadboard-ai/types";
import { getAssetType, getMimeType } from "../../src/utils/media/mime-type.js";

describe("mime-type", () => {
  describe("getAssetType", () => {
    it("returns 'image' for image/* types", () => {
      assert.equal(getAssetType("image/png"), "image");
      assert.equal(getAssetType("image/jpeg"), "image");
    });

    it("returns 'audio' for audio/* types", () => {
      assert.equal(getAssetType("audio/wav"), "audio");
      assert.equal(getAssetType("audio/mp3"), "audio");
    });

    it("returns 'video' for video/* types", () => {
      assert.equal(getAssetType("video/mp4"), "video");
    });

    it("returns 'text' for text/* types", () => {
      assert.equal(getAssetType("text/plain"), "text");
      assert.equal(getAssetType("text/html"), "text");
    });

    it("returns undefined for unknown types", () => {
      assert.equal(getAssetType("application/json"), undefined);
    });

    it("returns undefined for undefined input", () => {
      assert.equal(getAssetType(undefined), undefined);
    });

    it("returns undefined for empty string", () => {
      assert.equal(getAssetType(""), undefined);
    });
  });

  describe("getMimeType", () => {
    it("returns mimeType from inlineData part", () => {
      const data: LLMContent[] = [
        {
          parts: [{ inlineData: { data: "abc", mimeType: "image/png" } }],
        },
      ];
      assert.equal(getMimeType(data), "image/png");
    });

    it("returns mimeType from storedData part", () => {
      const data: LLMContent[] = [
        {
          parts: [{ storedData: { handle: "h1", mimeType: "audio/wav" } }],
        },
      ];
      assert.equal(getMimeType(data), "audio/wav");
    });

    it("returns mimeType from fileData part", () => {
      const data: LLMContent[] = [
        {
          parts: [
            {
              fileData: { fileUri: "gs://bucket/file", mimeType: "video/mp4" },
            },
          ],
        },
      ];
      assert.equal(getMimeType(data), "video/mp4");
    });

    it("returns undefined when no parts have a mimeType", () => {
      const data: LLMContent[] = [{ parts: [{ text: "hello" }] }];
      assert.equal(getMimeType(data), undefined);
    });

    it("returns undefined for empty array", () => {
      assert.equal(getMimeType([]), undefined);
    });

    it("returns the first mimeType found", () => {
      const data: LLMContent[] = [
        {
          parts: [
            { text: "hello" },
            { inlineData: { data: "abc", mimeType: "image/png" } },
          ],
        },
      ];
      assert.equal(getMimeType(data), "image/png");
    });
  });
});
