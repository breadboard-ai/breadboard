/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export default async (inputs) => {
  const { input1 } = inputs;

  if (!input1 || !Array.isArray(input1.parts)) {
    return {
      parts: [{ text: "0" }],
    };
  }

  let imageCount = 0;
  for (const part of input1.parts) {
    const mimeType = part.fileData?.mimeType ?? part.inlineData?.mimeType;
    if (mimeType && mimeType.toLowerCase().startsWith("image/")) {
      imageCount++;
    }
  }

  return {
    parts: [{ text: String(imageCount) }],
  };
};