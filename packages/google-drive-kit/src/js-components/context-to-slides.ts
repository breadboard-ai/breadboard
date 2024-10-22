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
  TextToSlideRequestsResult,
} from "../drive-types.js";

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

  function createParagraphBullets(objectId: string): {
    createParagraphBullets: SlidesCreateParagraphBulletsRequest;
  } {
    return { createParagraphBullets: { objectId } };
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
    const lines = text.split(/\n/);
    const requests: SlidesRequest[] = [];
    const textLines: string[] = [];
    let prevPlaceholderId: string | null = null;
    let prevSlideId = startId;
    lines.forEach((line) => {
      const match = line.match(/(?<heading>^#*\W*)(?<text>.*$)/);
      if (!match) {
        return;
      }
      const heading = match.groups?.heading?.trim();
      const text = match.groups?.text?.trim();
      if (heading) {
        // first, flush the existing textLines
        if (textLines.length > 0) {
          const placeholderId = prevPlaceholderId;
          if (placeholderId) {
            requests.push(insertText(placeholderId, textLines.join("\n")));
          }
          textLines.length = 0;
        }
        const isBullet = heading === "-";
        if (isBullet) {
          const placeholderId = prevPlaceholderId;
          textLines.length = 0;
          if (placeholderId) {
            requests.push(insertText(placeholderId, `\t${text}\n`));
            requests.push(createParagraphBullets(placeholderId));
          }
        } else {
          const level = heading.length;
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
        }
      } else {
        // Only add text lines if there was a title previously specified.
        // Otherwise, drop the text.
        if (text && prevPlaceholderId) {
          textLines.push(text);
        }
      }
    });
    // Flush the last textLines
    if (textLines.length > 0 && prevPlaceholderId) {
      requests.push(insertText(prevPlaceholderId, textLines.join("\n")));
    }
    return { requests, prevSlideId };

    function createObjectId() {
      return `Slide-${++prevSlideId}`;
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
