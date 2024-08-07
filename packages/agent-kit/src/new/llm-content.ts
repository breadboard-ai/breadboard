/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  annotate,
  array,
  enumeration,
  object,
  optional,
} from "@breadboard-ai/build";

export const llmContentRole = enumeration("user", "model", "tool");

export const textPart = object({ text: "string" });

export const llmContent = annotate(
  object({
    role: optional(llmContentRole),
    parts: array(textPart),
  }),
  { behavior: ["llm-content"] }
);

export const llmContentArray = annotate(llmContent, {
  behavior: ["llm-content"],
});
