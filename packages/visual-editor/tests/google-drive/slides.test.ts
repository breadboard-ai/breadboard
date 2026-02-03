/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from "node:test";
import { strictEqual, deepStrictEqual } from "node:assert";
import { SimpleSlideBuilder } from "../../src/a2/google-drive/slides.js";

describe("SimpleSlideBuilder", () => {
  it("builds requests with insertionIndex and objectsToDelete", () => {
    const builder = new SimpleSlideBuilder(
      0, // last (count)
      ["old-slide-1", "old-slide-2"], // objectsToDelete
      5 // insertionIndex
    );

    builder.addSlide({
      title: "New Slide 1",
      body: "Body 1",
    });

    builder.addSlide({
      title: "New Slide 2",
      body: "Body 2",
    });

    const requests = builder.build([]);

    // Check delete requests (prepended)
    strictEqual(requests.length, 8); // 2 deletes + 2 creates + 2 inserts (title/body) per slide = 2 + 2 * 3 = 8

    // First 2 should be deletes (because SimpleSlideBuilder unshifts them)
    // "old-slide-1" unshifted -> ["old-slide-1"]
    // "old-slide-2" unshifted -> ["old-slide-2", "old-slide-1"]
    deepStrictEqual(requests[0], {
      deleteObject: { objectId: "old-slide-2" },
    });

    deepStrictEqual(requests[1], {
      deleteObject: { objectId: "old-slide-1" },
    });

    // Next requests are for Slide 1
    // slidesToRequests uses insertionIndex + index.
    // Slide 1 index 0. Insertion index 5. Result 5.
    const createSlide1 = requests[2] as any;
    strictEqual(createSlide1.createSlide.insertionIndex, 5);

    // Slide 2 index 1. Insertion index 6.
    // Slide 1 requests take 3 slots.
    // 2, 3, 4 are Slide 1.
    // 5, 6, 7 are Slide 2.

    const createSlide2 = requests[5] as any;
    strictEqual(createSlide2.createSlide.insertionIndex, 6);
  });
});
