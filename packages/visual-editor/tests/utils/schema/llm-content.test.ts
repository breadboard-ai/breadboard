/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Schema } from "@breadboard-ai/types";
import {
  createAllowListFromProperty,
  getMinItemsFromProperty,
  isImageURL,
} from "../../../src/utils/schema/llm-content.js";

// ---------------------------------------------------------------------------
// getMinItemsFromProperty
// ---------------------------------------------------------------------------

describe("getMinItemsFromProperty", () => {
  it("returns 0 for undefined property", () => {
    assert.equal(getMinItemsFromProperty(undefined), 0);
  });

  it("returns minItems from the top-level property", () => {
    const schema: Schema = { type: "array", minItems: 3 };
    assert.equal(getMinItemsFromProperty(schema), 3);
  });

  it("returns minItems from nested items", () => {
    const schema: Schema = {
      type: "array",
      items: { type: "object", minItems: 5 },
    };
    assert.equal(getMinItemsFromProperty(schema), 5);
  });

  it("returns 0 when neither top-level nor items have minItems", () => {
    const schema: Schema = { type: "string" };
    assert.equal(getMinItemsFromProperty(schema), 0);
  });

  it("ignores items when it is an array", () => {
    const schema: Schema = {
      type: "array",
      items: [{ type: "string" }] as never,
    };
    assert.equal(getMinItemsFromProperty(schema), 0);
  });
});

// ---------------------------------------------------------------------------
// createAllowListFromProperty — exercising updateAllowList switch cases
// ---------------------------------------------------------------------------

describe("createAllowListFromProperty", () => {
  it("returns all-false (except textInline) for undefined property", () => {
    const allow = createAllowListFromProperty(undefined);
    assert.equal(allow.audioFile, false);
    assert.equal(allow.audioMicrophone, false);
    assert.equal(allow.videoFile, false);
    assert.equal(allow.videoWebcam, false);
    assert.equal(allow.imageFile, false);
    assert.equal(allow.imageWebcam, false);
    assert.equal(allow.imageDrawable, false);
    assert.equal(allow.textFile, false);
    assert.equal(allow.textInline, true);
  });

  it("enables all types when no format specified", () => {
    const allow = createAllowListFromProperty({ type: "object" });
    assert.equal(allow.audioFile, true);
    assert.equal(allow.audioMicrophone, true);
    assert.equal(allow.videoFile, true);
    assert.equal(allow.videoWebcam, true);
    assert.equal(allow.imageFile, true);
    assert.equal(allow.imageWebcam, true);
    assert.equal(allow.imageDrawable, true);
    assert.equal(allow.textFile, true);
    assert.equal(allow.textInline, true);
  });

  it("sets audioFile for 'audio-file' format", () => {
    const allow = createAllowListFromProperty({ format: "audio-file" });
    assert.equal(allow.audioFile, true);
    assert.equal(allow.videoFile, false);
  });

  it("sets audioMicrophone for 'audio-microphone' format", () => {
    const allow = createAllowListFromProperty({ format: "audio-microphone" });
    assert.equal(allow.audioMicrophone, true);
    assert.equal(allow.audioFile, false);
  });

  it("sets videoFile for 'video-file' format", () => {
    const allow = createAllowListFromProperty({ format: "video-file" });
    assert.equal(allow.videoFile, true);
    assert.equal(allow.audioFile, false);
  });

  it("sets videoWebcam for 'video-webcam' format", () => {
    const allow = createAllowListFromProperty({ format: "video-webcam" });
    assert.equal(allow.videoWebcam, true);
    assert.equal(allow.videoFile, false);
  });

  it("sets imageFile for 'image-file' format", () => {
    const allow = createAllowListFromProperty({ format: "image-file" });
    assert.equal(allow.imageFile, true);
    assert.equal(allow.imageWebcam, false);
  });

  it("sets imageWebcam for 'image-webcam' format", () => {
    const allow = createAllowListFromProperty({ format: "image-webcam" });
    assert.equal(allow.imageWebcam, true);
    assert.equal(allow.imageFile, false);
  });

  it("sets imageDrawable for 'image-drawable' format", () => {
    const allow = createAllowListFromProperty({ format: "image-drawable" });
    assert.equal(allow.imageDrawable, true);
    assert.equal(allow.imageFile, false);
  });

  it("sets textFile for 'text-file' format", () => {
    const allow = createAllowListFromProperty({ format: "text-file" });
    assert.equal(allow.textFile, true);
    assert.equal(allow.audioFile, false);
  });

  it("handles comma-separated format strings", () => {
    const allow = createAllowListFromProperty({
      format: "audio-file,image-file,text-file",
    });
    assert.equal(allow.audioFile, true);
    assert.equal(allow.imageFile, true);
    assert.equal(allow.textFile, true);
    assert.equal(allow.videoFile, false);
    assert.equal(allow.videoWebcam, false);
  });

  it("reads format from items when property is an array type", () => {
    const schema: Schema = {
      type: "array",
      items: { type: "object", format: "video-webcam" },
    };
    const allow = createAllowListFromProperty(schema);
    assert.equal(allow.videoWebcam, true);
    assert.equal(allow.audioFile, false);
  });

  it("ignores unrecognized format strings", () => {
    const allow = createAllowListFromProperty({ format: "unknown-format" });
    // All should stay false except textInline (default)
    assert.equal(allow.audioFile, false);
    assert.equal(allow.videoFile, false);
    assert.equal(allow.imageFile, false);
    assert.equal(allow.textFile, false);
    assert.equal(allow.textInline, true);
  });
});

// ---------------------------------------------------------------------------
// isImageURL
// ---------------------------------------------------------------------------

describe("isImageURL", () => {
  it("returns true for an object with image_url", () => {
    assert.equal(
      isImageURL({ image_url: "https://example.com/img.png" }),
      true
    );
  });

  it("returns false for null", () => {
    assert.equal(isImageURL(null), false);
  });

  it("returns false for a string", () => {
    assert.equal(isImageURL("hello"), false);
  });

  it("returns false for an object without image_url", () => {
    assert.equal(isImageURL({ text: "hello" }), false);
  });

  it("returns false for undefined", () => {
    assert.equal(isImageURL(undefined), false);
  });
});
