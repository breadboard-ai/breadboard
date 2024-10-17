/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { JsonSerializable } from "@breadboard-ai/build";
import { type LLMContent } from "@breadboard-ai/types";

export type Inputs = {
  context: JsonSerializable;
};

export type Outputs = {
  body: {
    title: string;
  };
};

export function run(inputs: Inputs): Outputs {
  let context = inputs.context as string | LLMContent | LLMContent[];
  const result = {
    body: {
      title: "Untitled Slide Deck",
    },
  };
  if (typeof context === "string") {
    result.body.title = context;
    return result;
  }
  if (!Array.isArray(context)) {
    context = [context];
  }
  const last = context.at(-1);
  if (!last || !last.parts || !last.parts.length) {
    return result;
  }
  result.body.title = last.parts
    .map((part) => ("text" in part ? part.text : ""))
    .join(" ");
  return result;
}
