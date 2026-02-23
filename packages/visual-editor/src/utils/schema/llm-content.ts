/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Schema } from "@breadboard-ai/types";
import { AllowedLLMContentTypes } from "../../ui/types/types.js";

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
    property.items &&
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
