/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LLMContent } from "@breadboard-ai/types";
import { v0_8 } from "../../a2ui/index.js";
import {
  isFileDataCapabilityPart,
  isInlineData,
  isStoredData,
  isTextCapabilityPart,
} from "../../data/common.js";

export { llmContentToA2UIComponents, type ConvertedLLMContent };

type ConvertedLLMContent = {
  ids: string[];
  parts: v0_8.Types.ComponentInstance[];
};

type ConversionOptions = {
  /**
   * Prefix for generated component IDs.
   * If not provided, uses crypto.randomUUID() for each component.
   */
  idPrefix?: string;
  /**
   * If true, text content will be rendered as h1.
   */
  textAsH1?: boolean;
  /**
   * If true, media will be wrapped in a container card.
   * Useful for app screen output where media needs sizing constraints.
   */
  wrapMediaInCard?: boolean;
};

function base64toUTF8(str: string) {
  const binaryString = atob(str);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const decoder = new TextDecoder("utf-8");
  return decoder.decode(bytes);
}

/**
 * Converts LLMContent to A2UI ComponentInstances.
 *
 * @param content The LLMContent to convert
 * @param options Conversion options
 * @returns Object with top-level component IDs and all component parts
 */
function llmContentToA2UIComponents(
  content: LLMContent,
  options: ConversionOptions = {}
): ConvertedLLMContent {
  const { idPrefix, textAsH1 = false, wrapMediaInCard = false } = options;

  const result: ConvertedLLMContent = {
    ids: [],
    parts: [],
  };

  let partIndex = 0;

  const generateId = (suffix: string): string => {
    if (idPrefix) {
      return `${idPrefix}-${suffix}-${partIndex++}`;
    }
    return globalThis.crypto.randomUUID();
  };

  const addTopLevel = (
    id: string,
    component: v0_8.Types.ComponentProperties
  ) => {
    result.parts.push({ id, component });
    result.ids.push(id);
  };

  const addMedia = (
    type:
      | "Image"
      | "a2ui-custom-video"
      | "AudioPlayer"
      | "a2ui-custom-pdf-viewer",
    url: string,
    isFileUri = false
  ) => {
    const mediaId = generateId(type.toLowerCase());
    const urlProp = isFileUri
      ? { fileUri: { literalString: url } }
      : { url: { literalString: url } };

    const mediaComponent: v0_8.Types.ComponentProperties = {
      [type]: urlProp,
    };

    if (wrapMediaInCard) {
      result.parts.push({ id: mediaId, component: mediaComponent });
      const cardId = generateId("card");
      addTopLevel(cardId, {
        "a2ui-custom-media-container": { child: mediaId },
      });
    } else {
      addTopLevel(mediaId, mediaComponent);
    }
  };

  for (const part of content.parts) {
    if (isTextCapabilityPart(part)) {
      const text = part.text.trim();
      if (text === "") continue;

      addTopLevel(generateId("text"), {
        Text: {
          text: { literalString: text },
          usageHint: textAsH1 ? "h1" : "body",
        },
      });
    } else if (isFileDataCapabilityPart(part)) {
      if (part.fileData.mimeType === "video/mp4") {
        addMedia("a2ui-custom-video", part.fileData.fileUri, true);
      }
    } else if (isStoredData(part)) {
      if (part.storedData.handle.startsWith("drive:/")) {
        addTopLevel(generateId("drive"), {
          "a2ui-custom-google-drive": {
            fileUri: { literalString: part.storedData.handle },
            resourceKey: { literalString: part.storedData.resourceKey },
          },
        });
      } else if (part.storedData.mimeType === "text/html") {
        addTopLevel(generateId("html"), {
          "a2ui-custom-html": {
            url: { literalString: part.storedData.handle },
          },
        });
      } else if (part.storedData.mimeType.startsWith("image")) {
        addMedia("Image", part.storedData.handle);
      } else if (part.storedData.mimeType.startsWith("video")) {
        addMedia("a2ui-custom-video", part.storedData.handle);
      } else if (part.storedData.mimeType.startsWith("audio")) {
        addMedia("AudioPlayer", part.storedData.handle);
      } else if (part.storedData.mimeType === "application/pdf") {
        addMedia("a2ui-custom-pdf-viewer", part.storedData.handle);
      }
    } else if (isInlineData(part)) {
      if (part.inlineData.mimeType === "text/html") {
        addTopLevel(generateId("html"), {
          "a2ui-custom-html": {
            srcdoc: { literalString: part.inlineData.data },
          },
        });
      } else if (part.inlineData.mimeType === "text/plain") {
        addTopLevel(generateId("text"), {
          Text: {
            text: { literalString: base64toUTF8(part.inlineData.data) },
            usageHint: "body",
          },
        });
      } else {
        const url = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        if (part.inlineData.mimeType.startsWith("image")) {
          addMedia("Image", url);
        } else if (part.inlineData.mimeType.startsWith("video")) {
          addMedia("a2ui-custom-video", url);
        } else if (part.inlineData.mimeType.startsWith("audio")) {
          addMedia("AudioPlayer", url);
        } else if (part.inlineData.mimeType === "application/pdf") {
          addMedia("a2ui-custom-pdf-viewer", url);
        } else {
          addTopLevel(generateId("error"), {
            Text: {
              text: { literalString: "Unable to render file" },
              usageHint: "body",
            },
          });
        }
      }
    }
  }

  return result;
}
