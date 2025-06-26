/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { DataPart, LLMContent } from "@breadboard-ai/types";
import * as ParticlesUI from "@breadboard-ai/particles-ui";
import { AppScreenOutput } from "../../../state";
import {
  isFileDataCapabilityPart,
  isInlineData,
  isLLMContent,
  isLLMContentArray,
  isStoredData,
} from "@google-labs/breadboard";
import { isTextCapabilityPart } from "@google-labs/breadboard";
import { BehaviorHint, Presentation, Field } from "@breadboard-ai/particles";

function as(mimeType: string, isStored = false): Field["as"] {
  const mimePrefix = mimeType.split("/").at(0);

  switch (mimePrefix) {
    case "audio":
      return "particle-viewer-audio";
    case "video":
      return "particle-viewer-video";
    case "image":
      return "particle-viewer-image";
    case "text":
      if (mimeType === "text/plain") {
        return "particle-viewer-code";
      }
      return isStored ? "particle-viewer-file" : "particle-viewer-text";
    default:
      return "particle-viewer-file";
  }
}

function base64toUTF8(str: string) {
  const binaryString = atob(str);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const decoder = new TextDecoder("utf-8");
  return decoder.decode(bytes);
}

function llmContentPartPresentation(
  part: DataPart,
  behaviors: BehaviorHint[]
): Presentation {
  if (isTextCapabilityPart(part)) {
    return {
      behaviors: [],
      type: "card",
      segments: [
        {
          weight: 1,
          type: "block",
          fields: {
            text: {
              title: "Text part",
              modifiers: behaviors.includes("hint-chat-mode") ? ["hero"] : [],
              as: "particle-viewer-text",
            },
          },
          orientation: "vertical",
        },
      ],
      orientation: "vertical",
    };
  } else if (isInlineData(part)) {
    const asType = as(part.inlineData.mimeType);
    return {
      behaviors: [],
      type: "card",
      segments: [
        {
          weight: 1,
          type: "media",
          fields: {
            src: {
              title: "Generated Item",
              as: asType,
            },
          },
          orientation: "vertical",
        },
      ],
      orientation: "vertical",
    };
  } else if (isStoredData(part)) {
    return {
      behaviors: [],
      type: "card",
      segments: [
        {
          weight: 1,
          type: "media",
          fields: {
            src: {
              title: "Generated Item",
              as: as(part.storedData.mimeType, true),
            },
          },
          orientation: "vertical",
        },
      ],
      orientation: "vertical",
    };
  } else if (isFileDataCapabilityPart(part)) {
    if (part.fileData.mimeType.startsWith("video")) {
      return {
        behaviors: [],
        type: "card",
        segments: [
          {
            weight: 1,
            type: "block",
            fields: {
              src: {
                title: "Generated Image",
                as: "particle-viewer-video",
              },
            },
            orientation: "vertical",
          },
        ],
        orientation: "vertical",
      };
    } else if (
      part.fileData.mimeType.startsWith("application/vnd.google-apps")
    ) {
      return {
        behaviors: [],
        type: "card",
        segments: [
          {
            weight: 1,
            type: "block",
            fields: {
              src: {
                title: "Google Drive File",
                as: "particle-viewer-google-drive",
              },
            },
            orientation: "vertical",
          },
        ],
        orientation: "vertical",
      };
    }
  }

  return {} as Presentation;
}

function appendToItems(
  llmContent: LLMContent,
  items: Map<string, ParticlesUI.Types.ItemState>,
  behaviors: BehaviorHint[]
) {
  for (const part of llmContent.parts) {
    let data = part as ParticlesUI.Types.ItemData;
    if (isFileDataCapabilityPart(data)) {
      data = { src: data.fileData.fileUri };
    } else if (isStoredData(data)) {
      data = { src: data.storedData.handle };
    } else if (isInlineData(data)) {
      if (data.inlineData.mimeType === "text/plain") {
        data = { src: base64toUTF8(data.inlineData.data) };
      } else {
        data = {
          src: `data:${data.inlineData.mimeType};base64,${data.inlineData.data}`,
        };
      }
    }

    if (isTextCapabilityPart(data) && data.text.trim() === "") {
      continue;
    }

    items.set(globalThis.crypto.randomUUID(), {
      data,
      presentation: llmContentPartPresentation(part, behaviors),
    });
  }
}

export function appScreenToParticles(
  appScreenOutput: AppScreenOutput
): ParticlesUI.Types.ItemList | null {
  if (!appScreenOutput.output) {
    return null;
  }

  const items = new Map<string, ParticlesUI.Types.ItemState>();
  for (const [name, outputData] of Object.entries(appScreenOutput.output)) {
    const behaviors =
      appScreenOutput.schema?.properties?.[name]?.behavior ?? [];

    if (isLLMContent(outputData)) {
      appendToItems(outputData, items, behaviors);
    } else if (isLLMContentArray(outputData)) {
      for (const llmContent of outputData) {
        appendToItems(llmContent, items, behaviors);
      }
    }
  }

  return {
    items,
    presentation: {
      type: "list",
      orientation: "vertical",
      behaviors: [],
    },
  } satisfies ParticlesUI.Types.ItemList;
}
