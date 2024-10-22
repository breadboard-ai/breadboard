/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { JsonSerializable } from "@breadboard-ai/build";
import { type LLMContent } from "@breadboard-ai/types";
import type {
  SlidesCreateImageRequest,
  SlidesCreateParagraphBulletsRequest,
  SlidesCreateSlideRequest,
  SlidesDeleteObjectRequest,
  SlidesInsertTextRequest,
  SlidesPredefinedLayout,
  SlidesRequest,
  SlidesTextRange,
  TextToSlideRequestsResult,
} from "../drive-types.js";
import { parseMarkdown } from "../util/markdown.js";
import type { ParsedBullet, ParsedText } from "../util/types.js";

export {
  contextToSlides,
  isDeleteObjectRequest,
  isCreateSlideRequest,
  isInsertTextRequest,
  isCreateImageRequest,
};

export type Inputs = {
  context: JsonSerializable;
  slideId: string;
};

export type Outputs = {
  body: JsonSerializable;
};

export function run(inputs: Inputs): Outputs {
  const requests = contextToSlides(
    inputs.context as LLMContent[],
    inputs.slideId
  );
  return {
    body: { requests } as JsonSerializable,
  };
}

function contextToSlides(
  context: LLMContent[],
  slideToDelete: string
): SlidesRequest[] {
  const requests: SlidesRequest[] = [
    {
      deleteObject: {
        objectId: slideToDelete,
      },
    },
  ];
  const last = context.at(-1);
  if (!last || !last.parts) {
    return requests;
  }

  let slideId = 0;

  last.parts.forEach((part) => {
    if ("text" in part) {
      const { prevSlideId, requests: newRequests } = textToSlideRequests(
        slideId,
        part.text
      );
      slideId = prevSlideId;
      requests.push(...newRequests);
    } else if ("storedData" in part) {
      const { handle } = part.storedData;
      if (handle) {
        const id = `Slide-${++slideId}`;
        requests.push(createSlide(id, "", "BLANK"), createImage(id, handle));
      }
    }
  });

  return requests;

  function insertText(
    objectId: string,
    text: string,
    insertionIndex?: number
  ): { insertText: SlidesInsertTextRequest } {
    return { insertText: { objectId, text, insertionIndex } };
  }

  function createParagraphBullets(
    objectId: string,
    textRange?: SlidesTextRange
  ): {
    createParagraphBullets: SlidesCreateParagraphBulletsRequest;
  } {
    return { createParagraphBullets: { objectId, textRange } };
  }

  function createImage(
    objectId: string,
    url: string
  ): { createImage: SlidesCreateImageRequest } {
    return {
      createImage: {
        url,
        elementProperties: {
          pageObjectId: objectId,
        },
      },
    };
  }

  function createSlide(
    slideId: string,
    placeholderId: string,
    layout: SlidesPredefinedLayout
  ) {
    const result: SlidesCreateSlideRequest = {
      objectId: slideId,
      slideLayoutReference: { predefinedLayout: layout },
      placeholderIdMappings: [],
    };

    switch (layout) {
      case "TITLE": {
        result.placeholderIdMappings.push({
          layoutPlaceholder: { type: "CENTERED_TITLE", index: 0 },
          objectId: `${slideId}-title`,
        });
        result.placeholderIdMappings.push({
          layoutPlaceholder: { type: "SUBTITLE", index: 0 },
          objectId: placeholderId,
        });
        break;
      }
      case "TITLE_AND_BODY": {
        result.placeholderIdMappings.push({
          layoutPlaceholder: { type: "TITLE", index: 0 },
          objectId: `${slideId}-title`,
        });
        result.placeholderIdMappings.push({
          layoutPlaceholder: { type: "BODY", index: 0 },
          objectId: placeholderId,
        });
        break;
      }
    }
    return { createSlide: result };
  }

  function textToSlideRequests(
    startId: number,
    text: string
  ): TextToSlideRequestsResult {
    const lines = parseMarkdown(text);
    const requests: SlidesRequest[] = [];
    const textLines: (ParsedText | ParsedBullet)[] = [];
    let prevPlaceholderId: string | null = null;
    let prevSlideId = startId;
    let offset = 0;
    lines.forEach((line) => {
      switch (line.type) {
        case "bullet": {
          addToBody(line);
          break;
        }
        case "heading": {
          finalizeSlide();
          const { level, text } = line;
          if (level == 1) {
            if (!text) {
              return;
            }
            // For level 1 headings, create a new TITLE slide
            const slideId = createObjectId();
            prevPlaceholderId = `${slideId}-subtitle`;
            requests.push(
              createSlide(slideId, prevPlaceholderId, "TITLE"),
              insertText(`${slideId}-title`, text!)
            );
          } else {
            // For level 2+ headings, create a new TITLE_AND_BODY slide
            const slideId = createObjectId();
            prevPlaceholderId = `${slideId}-body`;
            requests.push(
              createSlide(slideId, prevPlaceholderId, "TITLE_AND_BODY"),
              insertText(`${slideId}-title`, text!)
            );
          }
          offset = line.end;
          break;
        }
        case "text": {
          addToBody(line);
          break;
        }
      }
    });

    // Flush the last textLines
    if (textLines.length > 0 && prevPlaceholderId) {
      finalizeSlide();
    }
    return { requests, prevSlideId };

    function createObjectId() {
      return `Slide-${++prevSlideId}`;
    }

    function addToBody(line: ParsedText | ParsedBullet) {
      if (prevPlaceholderId) {
        textLines.push(line);
      }
    }

    function finalizeSlide() {
      if (!prevPlaceholderId) return;

      requests.push(
        insertText(
          prevPlaceholderId,
          textLines.map((line) => line.text).join("\n")
        )
      );

      // Identify bullet ranges, if any
      let bulletStart = -1;
      let bulletEnd = 0;
      textLines.forEach((line) => {
        if (bulletStart === -1) {
          if (line.type === "bullet") bulletStart = line.start;
        } else {
          if (line.type === "text") bulletEnd = line.start - 1;
        }
      });
      if (bulletStart !== -1) {
        if (bulletEnd === 0) {
          bulletEnd = textLines.at(-1)!.end;
        }
        const textRange: SlidesTextRange = {
          startIndex: bulletStart - offset,
          endIndex: bulletEnd - offset,
          type: "FIXED_RANGE",
        };
        requests.push(createParagraphBullets(prevPlaceholderId, textRange));
      }
      textLines.length = 0;
    }
  }
}

function isDeleteObjectRequest(
  request: SlidesRequest
): request is { deleteObject: SlidesDeleteObjectRequest } {
  return "deleteObject" in request;
}

function isCreateSlideRequest(
  request: SlidesRequest
): request is { createSlide: SlidesCreateSlideRequest } {
  return "createSlide" in request;
}

function isInsertTextRequest(
  request: SlidesRequest
): request is { insertText: SlidesInsertTextRequest } {
  return "insertText" in request;
}

function isCreateImageRequest(
  request: SlidesRequest
): request is { createImage: SlidesCreateImageRequest } {
  return "createImage" in request;
}
