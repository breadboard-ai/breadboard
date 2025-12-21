/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LLMContent } from "@breadboard-ai/types/llm-content.js";

export type OutcomeData = {
  success?: boolean;
  href?: string;
  outcomes: LLMContent;
  intermediate?: LLMContent;
};
