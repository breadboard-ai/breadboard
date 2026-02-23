/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Schema } from "@breadboard-ai/types";
import {
  getMinItemsFromProperty,
  createAllowListFromProperty,
  isImageURL,
} from "../../src/utils/schema/llm-content.js";

describe("llm-content", () => {
  describe("getMinItemsFromProperty", () => {
    it("returns 0 for undefined", () => {
      assert.equal(getMinItemsFromProperty(undefined), 0);
    });

    it("returns minItems from the property", () => {
      assert.equal(getMinItemsFromProperty({ minItems: 3 }), 3);
    });

    it("returns minItems from nested items", () => {
      const schema: Schema = {
        items: { minItems: 5 },
      };
      assert.equal(getMinItemsFromProperty(schema), 5);
    });

    it("returns 0 when items is an array (tuple)", () => {
      const schema: Schema = {
        items: [{ minItems: 5 }],
      };
      assert.equal(getMinItemsFromProperty(schema), 0);
    });

    it("returns 0 when no minItems anywhere", () => {
      assert.equal(getMinItemsFromProperty({}), 0);
    });
  });

  describe("createAllowListFromProperty", () => {
    it("returns defaults with textInline true for undefined", () => {
      const allow = createAllowListFromProperty(undefined);
      assert.equal(allow.textInline, true);
      assert.equal(allow.audioFile, false);
      assert.equal(allow.imageFile, false);
    });

    it("enables audio-file format", () => {
      const allow = createAllowListFromProperty({ format: "audio-file" });
      assert.equal(allow.audioFile, true);
      assert.equal(allow.imageFile, false);
    });

    it("enables image-file format", () => {
      const allow = createAllowListFromProperty({ format: "image-file" });
      assert.equal(allow.imageFile, true);
    });

    it("enables video-webcam format", () => {
      const allow = createAllowListFromProperty({ format: "video-webcam" });
      assert.equal(allow.videoWebcam, true);
    });

    it("handles comma-separated formats", () => {
      const allow = createAllowListFromProperty({
        format: "audio-file,image-file",
      });
      assert.equal(allow.audioFile, true);
      assert.equal(allow.imageFile, true);
      assert.equal(allow.videoFile, false);
    });

    it("enables all when no format is present", () => {
      const allow = createAllowListFromProperty({});
      assert.equal(allow.audioFile, true);
      assert.equal(allow.audioMicrophone, true);
      assert.equal(allow.videoFile, true);
      assert.equal(allow.imageFile, true);
      assert.equal(allow.textFile, true);
      assert.equal(allow.textInline, true);
    });

    it("reads format from nested array items", () => {
      const schema: Schema = {
        type: "array",
        items: { type: "object", format: "image-file" },
      };
      const allow = createAllowListFromProperty(schema);
      assert.equal(allow.imageFile, true);
      assert.equal(allow.audioFile, false);
    });
  });

  describe("isImageURL", () => {
    it("returns true for object with image_url", () => {
      assert.equal(
        isImageURL({ image_url: "https://example.com/img.png" }),
        true
      );
    });

    it("returns false for string", () => {
      assert.equal(isImageURL("string"), false);
    });

    it("returns false for null", () => {
      assert.equal(isImageURL(null), false);
    });

    it("returns false for object without image_url", () => {
      assert.equal(isImageURL({ url: "https://example.com" }), false);
    });

    it("returns false for number", () => {
      assert.equal(isImageURL(42), false);
    });
  });
});
