/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LLMContent } from "@breadboard-ai/types/llm-content.js";
import type { FileData } from "../../../src/a2/agent/loop.js";

export type OutcomeData = {
  success?: boolean;
  href?: string;
  outcomes: LLMContent;
  intermediate?: FileData[];
};
