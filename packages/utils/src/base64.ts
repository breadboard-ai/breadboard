/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { InlineDataCapabilityPart } from "@breadboard-ai/types";

export { parseBase64DataUrl };

const BASE64_DATA_URL_REGEX = /^data:(.+?);base64,(.+)$/;

function parseBase64DataUrl(url: string): InlineDataCapabilityPart | null {
  const matchResult = url.match(BASE64_DATA_URL_REGEX);
  if (!matchResult || matchResult.length !== 3) {
    return null;
  }
  const [, mimeType, data] = matchResult;
  return { inlineData: { mimeType, data } };
}
