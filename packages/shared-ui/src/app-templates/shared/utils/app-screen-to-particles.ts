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
import { BehaviorHint } from "@breadboard-ai/particles";
import { Field } from "@breadboard-ai/particles-ui/particles";

function as(mimeType: string, isStored = false): Field["as"] {
  const mimePrefix = mimeType.split("/").at(0);

  switch (mimePrefix) {
    case "audio":
      return "audio";
    case "video":
      return "video";
    case "image":
      return "image";
    case "text":
      if (mimeType === "text/plain") {
        return "pre";
      }
      return isStored ? "file" : "text";
    default:
      return "file";
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
): ParticlesUI.Particles.Presentation {
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
              as: "text",
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
              src: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
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
              src: part.storedData.handle,
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
                as: "video",
                src: part.fileData.fileUri,
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
                as: "googledrive",
                src: part.fileData.fileUri,
              },
            },
            orientation: "vertical",
          },
        ],
        orientation: "vertical",
      };
    }
  }

  return {} as ParticlesUI.Particles.Presentation;
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
        data = { src: data.inlineData.data };
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

  console.log(appScreenOutput, items);

  return {
    items,
    presentation: {
      type: "list",
      orientation: "vertical",
      behaviors: [],
    },
  } satisfies ParticlesUI.Types.ItemList;
}
