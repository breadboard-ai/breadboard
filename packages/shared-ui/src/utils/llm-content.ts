/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as StringsHelper from "../strings/helper.js";
const GlobalStrings = StringsHelper.forSection("Global");

import {
  isInlineData,
  isStoredData,
  isTextCapabilityPart,
  Schema,
} from "@google-labs/breadboard";
import { AllowedLLMContentTypes } from "../types/types.js";
import { LLMContent } from "@breadboard-ai/types";
import { renderMarkdownToHtmlString } from "../directives/markdown.js";

function updateAllowList(
  allow: AllowedLLMContentTypes,
  format: string | string[]
) {
  if (typeof format === "string") {
    switch (format) {
      case "audio-file": {
        allow.audioFile = true;
        break;
      }

      case "audio-microphone": {
        allow.audioMicrophone = true;
        break;
      }

      case "video-file": {
        allow.videoFile = true;
        break;
      }

      case "video-webcam": {
        allow.videoWebcam = true;
        break;
      }

      case "image-file": {
        allow.imageFile = true;
        break;
      }

      case "image-webcam": {
        allow.imageWebcam = true;
        break;
      }

      case "image-drawable": {
        allow.imageDrawable = true;
        break;
      }

      case "text-file": {
        allow.textFile = true;
        break;
      }
    }
  } else {
    for (const item of format) {
      updateAllowList(allow, item);
    }
  }
}

export function getMinItemsFromProperty(property: Schema | undefined): number {
  if (!property) {
    return 0;
  }

  if (property.minItems) {
    return property.minItems;
  }

  if (
    property.items &&
    !Array.isArray(property.items) &&
    property.items.minItems !== undefined
  ) {
    return property.items.minItems;
  }

  return 0;
}

export function createAllowListFromProperty(
  property: Schema | undefined
): AllowedLLMContentTypes {
  const allow: AllowedLLMContentTypes = {
    audioFile: false,
    audioMicrophone: false,
    videoFile: false,
    videoWebcam: false,
    imageFile: false,
    imageWebcam: false,
    imageDrawable: false,
    textFile: false,
    textInline: true,
  };

  if (!property) {
    return allow;
  }

  let format = property.format;
  if (
    property.type === "array" &&
    property.type &&
    property.items &&
    property.type === "array" &&
    !Array.isArray(property.items) &&
    property.items.type === "object" &&
    property.items.format
  ) {
    format = property.items.format;
  }

  if (format) {
    if (format.includes(",")) {
      updateAllowList(allow, format.split(","));
    } else {
      updateAllowList(allow, format);
    }
  } else {
    allow.audioFile = true;
    allow.audioMicrophone = true;
    allow.videoFile = true;
    allow.videoWebcam = true;
    allow.imageFile = true;
    allow.imageWebcam = true;
    allow.imageDrawable = true;
    allow.textFile = true;
    allow.textInline = true;
  }

  return allow;
}

export function isImageURL(
  nodeValue: unknown
): nodeValue is { image_url: string } {
  if (typeof nodeValue !== "object" || !nodeValue) {
    return false;
  }

  return "image_url" in nodeValue;
}

const HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Export</title>
  <style>
    html,
    body {
      color: #3a3a3a;
      font-family: Georgia, "Times New Roman", Times, serif;
      margin-bottom: 100px;

      & main {
        margin: 0 auto 1rem auto;
        max-width: 680px;

        & h1,
        & h2,
        & h3,
        & h4,
        & h5 {
          margin: 2rem 0 1rem 0;
          font-weight: 600;
          font-family: Arial, sans-serif;
          text-transform: uppercase;
        }

        & p {
          line-height: 1.75;
          margin-bottom: 1rem;
        }

        & img {
          max-width: 100%;
          border-radius: 8px;
          margin-bottom: 20px;
          box-shadow: 0 20px 32px rgba(0, 0, 0, 0.25);
        }
      }

      & footer {
        margin-top: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-top: 1px solid gray;
        height: 32px;
        font-size: 80%;
        color: gray;
      }
    }
  </style>
</head>
<body>
  <main>`;

export async function toZip(content: LLMContent): Promise<Blob> {
  const zip = (await import("jszip")).default();

  let index = HTML_TEMPLATE;
  let partIdx = 1;

  const getData = async (url: string) => {
    const response = await fetch(url);
    return response.blob();
  };

  const toEmbed = (mimeType: string, fileName: string) => {
    if (mimeType.startsWith("image")) {
      return `<img src="./${fileName}" alt="LLM Image" />`;
    }

    if (mimeType.startsWith("video")) {
      return `<video src="./${fileName}" controls></video>`;
    }

    if (mimeType.startsWith("audio")) {
      return `<audio src="./${fileName}" controls></audio>`;
    }
  };

  for (const part of content.parts) {
    if (isTextCapabilityPart(part)) {
      zip.file(`part-${partIdx}.md`, part.text);

      index += renderMarkdownToHtmlString(part.text);
      partIdx++;
    } else if (isInlineData(part)) {
      const suffix = part.inlineData.mimeType.split("/").at(-1);
      const fileName = `part-${partIdx}.${suffix}`;
      const inlineData = await getData(
        `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`
      );

      zip.file(fileName, inlineData, {
        binary: true,
      });

      index += `<p>${toEmbed(part.inlineData.mimeType, fileName)}</p>`;
      partIdx++;
    } else if (isStoredData(part)) {
      const url = part.storedData.handle;
      if (!url) {
        continue;
      }

      const { mimeType } = part.storedData;
      const inlineData = await getData(url);
      const suffix = mimeType.split("/").at(-1);
      const fileName = `part-${partIdx}.${suffix}`;
      zip.file(fileName, inlineData, { binary: true });

      index += `<p>${toEmbed(mimeType, fileName)}</p>`;
      partIdx++;
    }
  }

  index += `<footer>Made with ${GlobalStrings.from("APP_NAME")}</footer>
  </main></body></html>`;

  zip.file(`index.html`, index);
  return zip.generateAsync({ type: "blob" });
}
