/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { InlineDataCapabilityPart } from "@breadboard-ai/types";

const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d");
const PREAMBLE = "data:image/jpeg;base64,";
const MIN_IMAGE_SIZE = 256;
const MAX_IMAGE_SIZE = 2048;

/**
 * Converts an uploaded image blob to a InlineData part. In so doing it checks
 * that the image being handled is at least 256px square, and if it is larger
 * than 2048px square it downscales it.
 *
 * N.B. It does not ensure that the image is proportioned appropriately for the
 * case of a splash screen.
 *
 * @param file
 * @returns
 */
export async function convertImageToInlineData(
  file: Blob
): Promise<InlineDataCapabilityPart> {
  if (!ctx) {
    throw new Error("Unable to handle image");
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("loadend", () => {
      try {
        const img = new Image();
        img.src = reader.result as string;
        img.onload = () => {
          if (
            img.naturalWidth < MIN_IMAGE_SIZE ||
            img.naturalHeight < MIN_IMAGE_SIZE
          ) {
            reject("The uploaded image is too small");
            return;
          }

          const ratio = img.naturalWidth / img.naturalHeight;
          let width;
          let height;

          if (img.naturalWidth > img.naturalHeight) {
            // Landscape or Square: Set width to MAX_IMAGE_SIZE and calculate height
            width = Math.min(img.naturalWidth, MAX_IMAGE_SIZE);
            height = width / ratio; // height = width / (width/height)
          } else {
            // Portrait: Set height to MAX_IMAGE_SIZE and calculate width
            height = Math.min(img.naturalHeight, MAX_IMAGE_SIZE);
            width = height * ratio; // width = height * (width/height)
          }

          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(
            img,
            0,
            0,
            img.naturalWidth,
            img.naturalHeight,
            0,
            0,
            width,
            height
          );

          const data = canvas
            .toDataURL("image/jpeg", 85)
            .substring(PREAMBLE.length);

          resolve({
            inlineData: {
              mimeType: "image/jpeg",
              data,
            },
          });
        };
        img.onerror = () => {
          reject("Unable to handle image");
        };
      } catch (err) {
        console.warn(err);
        reject("Unable to handle image");
      }
    });
    reader.readAsDataURL(file);
  });
}
