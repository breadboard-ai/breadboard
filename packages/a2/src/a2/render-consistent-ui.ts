/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Capabilities, LLMContent, Outcome } from "@breadboard-ai/types";

export { renderConsistentUI };

async function renderConsistentUI(
  _caps: Capabilities,
  data: LLMContent,
  _systemInstruction?: LLMContent
): Promise<Outcome<LLMContent[]>> {
  return [data];
}
