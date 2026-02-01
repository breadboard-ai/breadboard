/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LLMContent } from "./llm-content.js";

/**
 * A simplified update for console progress display.
 * Used by ProgressWorkItem to track agent execution updates.
 */
export type ConsoleUpdate = {
  type: "text";
  title: string;
  icon: string;
  body: LLMContent;
};
