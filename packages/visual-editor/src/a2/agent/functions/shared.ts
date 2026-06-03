/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { RuntimeFlags } from "@breadboard-ai/types";

export { GENERATE_TEXT_FUNCTION, resolveInstruction };

/**
 * The canonical function name for the text generation tool.
 * Shared across system and generate function groups.
 */
const GENERATE_TEXT_FUNCTION = "generate_text";

/**
 * Parses and resolves conditional blocks in markdown instructions based on runtime flags.
 * Format: <!-- if flagName -->content<!-- endif -->
 */
function resolveInstruction(
  instruction: string | undefined,
  flags?: Readonly<RuntimeFlags>
): string | undefined {
  if (!instruction) return undefined;
  return instruction.replace(
    /<!-- if (\w+) -->([\s\S]*?)<!-- endif -->/g,
    (_, flag, content) => {
      return flags?.[flag as keyof RuntimeFlags] ? content : "";
    }
  );
}
