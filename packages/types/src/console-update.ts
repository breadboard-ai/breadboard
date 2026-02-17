/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LLMContent } from "./llm-content.js";

/**
 * A link for grounding metadata display.
 */
export type ConsoleLink = {
  uri: string;
  title: string;
  iconUri?: string;
};

/**
 * Text update for console progress display.
 */
export type TextUpdate = {
  type: "text";
  title: string;
  icon: string;
  body: LLMContent;
};

/**
 * Links update for grounding metadata display.
 */
export type LinksUpdate = {
  type: "links";
  title: string;
  icon: string;
  links: ConsoleLink[];
};

/**
 * A simplified update for console progress display.
 * Used by ProgressWorkItem to track agent execution updates.
 */
export type ConsoleUpdate = TextUpdate | LinksUpdate;
