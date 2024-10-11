/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { LLMContent } from "@breadboard-ai/types";
import { equal, fail } from "node:assert";
import test, { describe } from "node:test";
import {
  contextToSlides,
  isCreateSlideRequest,
  isInsertTextRequest,
} from "../internal/context-to-slides.js";

describe("contextToSlides", () => {
  test("converts simple header and body to slide requests", () => {
    const context: LLMContent[] = [
      {
        parts: [{ text: "# Heading\nBody" }],
        role: "user",
      },
    ];
    const requests = contextToSlides(context);
    equal(requests.length, 3);
    if (isCreateSlideRequest(requests[0]!)) {
      equal(requests[0].createSlide.objectId, "Slide-1");
    } else {
      fail("Expected a createSlide request");
    }
    if (isInsertTextRequest(requests[1]!)) {
      equal(requests[1].insertText.objectId, "Slide-1-title");
      equal(requests[1].insertText.text, "Heading");
    } else {
      fail("Expected an insertText request");
    }
    if (isInsertTextRequest(requests[2]!)) {
      equal(requests[2].insertText.objectId, "Slide-1-subtitle");
      equal(requests[2].insertText.text, "Body");
    } else {
      fail("Expected an insertText request");
    }
  });

  test("converts multiple headers and bodies to slide requests", () => {
    const context: LLMContent[] = [
      {
        parts: [{ text: "# Heading\nBody" }, { text: "# Heading 2\nBody 2" }],
        role: "user",
      },
    ];
    const requests = contextToSlides(context);
    equal(requests.length, 6);
    if (isCreateSlideRequest(requests[0]!)) {
      equal(requests[0].createSlide.objectId, "Slide-1");
      equal(
        requests[0].createSlide.slideLayoutReference.predefinedLayout,
        "TITLE"
      );
    } else {
      fail("Expected a createSlide request");
    }
    if (isInsertTextRequest(requests[1]!)) {
      equal(requests[1].insertText.objectId, "Slide-1-title");
      equal(requests[1].insertText.text, "Heading");
    } else {
      fail("Expected an insertText request");
    }
    if (isInsertTextRequest(requests[2]!)) {
      equal(requests[2].insertText.objectId, "Slide-1-subtitle");
      equal(requests[2].insertText.text, "Body");
    } else {
      fail("Expected an insertText request");
    }
    if (isCreateSlideRequest(requests[3]!)) {
      equal(requests[3].createSlide.objectId, "Slide-2");
    } else {
      fail("Expected a createSlide request");
    }
    if (isInsertTextRequest(requests[4]!)) {
      equal(requests[4].insertText.objectId, "Slide-2-title");
      equal(requests[4].insertText.text, "Heading 2");
    } else {
      fail("Expected an insertText request");
    }
    if (isInsertTextRequest(requests[5]!)) {
      equal(requests[5].insertText.objectId, "Slide-2-subtitle");
      equal(requests[5].insertText.text, "Body 2");
    } else {
      fail("Expected an insertText request");
    }
  });

  test("converts correctly to body and text slide requests", () => {
    const context: LLMContent[] = [
      {
        parts: [{ text: "## Heading\n\nBody" }],
        role: "user",
      },
    ];
    const requests = contextToSlides(context);
    equal(requests.length, 3);
    if (isCreateSlideRequest(requests[0]!)) {
      equal(requests[0].createSlide.objectId, "Slide-1");
      equal(
        requests[0].createSlide.slideLayoutReference.predefinedLayout,
        "TITLE_AND_BODY"
      );
    } else {
      fail("Expected a createSlide request");
    }
    if (isInsertTextRequest(requests[1]!)) {
      equal(requests[1].insertText.objectId, "Slide-1-title");
      equal(requests[1].insertText.text, "Heading");
    } else {
      fail("Expected an insertText request");
    }
    if (isInsertTextRequest(requests[2]!)) {
      equal(requests[2].insertText.objectId, "Slide-1-body");
      equal(requests[2].insertText.text, "Body");
    }
  });
});
