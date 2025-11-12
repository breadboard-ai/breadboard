/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { err, ok } from "@breadboard-ai/utils";
import type { GeminiAPIOutputs } from "./a2/gemini";
import { Outcome, TextCapabilityPart } from "@breadboard-ai/types";

export { parseJson };

function parseJson<T>(output: Outcome<GeminiAPIOutputs>): Outcome<T> {
  if (!ok(output)) return output;

  const text = (
    output?.candidates
      ?.at(0)
      ?.content?.parts?.filter((part) => !part.thought && "text" in part)
      .at(0) as TextCapabilityPart
  )?.text;
  if (!text) {
    return err(`JSON string not found in output`);
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    return err((e as Error).message);
  }
}
