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
  let context = inputs.context as LLMContent | LLMContent[];
  if (!Array.isArray(context)) {
    context = [context];
  }
  const last = context.at(-1);
  const result = {
    body: {
      title: "Untitled Slide Deck",
    },
  };
  if (!last || !last.parts || last.parts.length > 0) {
    return result;
  }
  result.body.title = last.parts
    .map((part) => ("text" in part ? part.text : ""))
    .join(" ");
  return result;
}
