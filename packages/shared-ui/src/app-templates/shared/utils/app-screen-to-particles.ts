/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { DataPart, LLMContent } from "@breadboard-ai/types";
import { AppScreenOutput } from "../../../state";
import {
  isFileDataCapabilityPart,
  isInlineData,
  isLLMContent,
  isLLMContentArray,
  isStoredData,
} from "@google-labs/breadboard";
import { isTextCapabilityPart } from "@google-labs/breadboard";
import {
  BehaviorHint,
  Presentation,
  Field,
  GroupParticle,
  Particle,
  ParticleIdentifier,
} from "@breadboard-ai/particles";
import { SignalMap } from "signal-utils/map";
import { partToDriveFileId } from "@breadboard-ai/google-drive-kit/board-server/utils.js";

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
    } satisfies Presentation;
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
              behaviors:
                asType === "particle-viewer-image" ? ["clone", "download"] : [],
            },
          },
          orientation: "vertical",
        },
      ],
      orientation: "vertical",
    } satisfies Presentation;
  } else if (isStoredData(part)) {
    const asType = as(part.storedData.mimeType, true);
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
              behaviors:
                asType === "particle-viewer-image" ? ["clone", "download"] : [],
            },
          },
          orientation: "vertical",
        },
      ],
      orientation: "vertical",
    } satisfies Presentation;
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
      } satisfies Presentation;
    } else {
      const possibleGDriveFileId = partToDriveFileId(part);
      if (
        part.fileData.mimeType.startsWith("application/vnd.google-apps") ||
        possibleGDriveFileId
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
        } satisfies Presentation;
      }
    }
  }

  return {} as Presentation;
}

function appendToItems(
  llmContent: LLMContent,
  group: Map<ParticleIdentifier, Particle>,
  behaviors: BehaviorHint[]
) {
  // Remap each part to a particle and append to the group.
  for (const part of llmContent.parts) {
    let particle: Particle | undefined = undefined;
    if (isFileDataCapabilityPart(part)) {
      particle = {
        data: part.fileData.fileUri,
        mimeType: part.fileData.mimeType,
      };
    } else if (isStoredData(part)) {
      particle = {
        data: part.storedData.handle,
        mimeType: part.storedData.mimeType,
      };
    } else if (isInlineData(part)) {
      if (part.inlineData.mimeType === "text/plain") {
        particle = { text: base64toUTF8(part.inlineData.data) };
      } else {
        particle = {
          data: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
          mimeType: part.inlineData.mimeType,
        };
      }
    } else if (isTextCapabilityPart(part)) {
      if (part.text.trim() === "") {
        continue;
      }
      particle = { text: part.text };
    }

    if (!particle) {
      console.warn("[App View] Unexpected particle information", part);
      continue;
    }

    // Append the presentation information.
    particle.presentation = llmContentPartPresentation(part, behaviors);
    group.set(globalThis.crypto.randomUUID(), particle);
  }
}

export function appScreenToParticles(
  appScreenOutput: AppScreenOutput
): GroupParticle | null {
  if (!appScreenOutput.output) {
    return null;
  }

  const group = new SignalMap<ParticleIdentifier, Particle>();
  for (const [name, outputData] of Object.entries(appScreenOutput.output)) {
    const behaviors =
      appScreenOutput.schema?.properties?.[name]?.behavior ?? [];

    if (isLLMContent(outputData)) {
      appendToItems(outputData, group, behaviors);
    } else if (isLLMContentArray(outputData)) {
      for (const llmContent of outputData) {
        appendToItems(llmContent, group, behaviors);
      }
    }
  }

  return {
    group,
    presentation: {
      orientation: "vertical",
      behaviors: [],
      type: "list",
    },
  } satisfies GroupParticle;
}
