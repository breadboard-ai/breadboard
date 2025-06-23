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
              title: "Your todo",
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
    return {
      behaviors: [],
      type: "card",
      segments: [
        {
          weight: 1,
          type: "block",
          fields: {
            text: {
              title: "Generated Item",
              as: part.inlineData.mimeType.startsWith("image")
                ? "image"
                : part.inlineData.mimeType.startsWith("video")
                  ? "video"
                  : "audio",
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
          type: "block",
          fields: {
            text: {
              title: "Generated Item",
              as: part.storedData.mimeType.startsWith("image")
                ? "image"
                : part.storedData.mimeType.startsWith("video")
                  ? "video"
                  : "audio",
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
              text: {
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
    const behaviors = appScreenOutput.schema?.properties?.[name].behavior ?? [];

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
