/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview
 *
 * Shared utility for persisting data parts to storage.
 *
 * This was extracted from `asset-actions.ts` so that both the Asset and Step
 * action domains can use it without creating a cross-domain import.
 */

import type { DataPartTransformer, LLMContent } from "@breadboard-ai/types";
import { ok } from "@breadboard-ai/utils";
import { transformDataParts } from "../../data/common.js";
import { getLogger, Formatter } from "../utils/logging/logger.js";

export { persistDataParts };

const LABEL = "persistDataParts";

/**
 * Persists data parts to storage.
 */
async function persistDataParts(
  urlString: string | null,
  contents: LLMContent[],
  transformer: DataPartTransformer
): Promise<LLMContent[]> {
  if (!urlString) {
    getLogger().log(
      Formatter.warning("Can't persist blob without graph URL"),
      LABEL
    );
    return contents;
  }

  const url = new URL(urlString);

  const transformed = await transformDataParts(
    url,
    contents,
    "persistent",
    transformer
  );
  if (!ok(transformed)) {
    getLogger().log(
      Formatter.warning(`Failed to persist a blob: "${transformed.$error}"`),
      LABEL
    );
    return contents;
  }

  return transformed;
}
