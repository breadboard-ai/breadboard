/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  DataPart,
  FileSystemBlobTransform,
  FileSystemPath,
  LLMContent,
  Outcome,
} from "@breadboard-ai/types";
import { ok } from "@breadboard-ai/utils";

export { transformBlobs };

type TransformOutcome = Outcome<DataPart>;

async function transformBlobs(
  path: FileSystemPath,
  data: LLMContent[],
  pipeline: FileSystemBlobTransform[]
): Promise<Outcome<LLMContent[]>> {
  const result: LLMContent[] = [];
  for (const entry of data) {
    const parts: DataPart[] = [];
    for (const part of entry.parts) {
      let newPart: TransformOutcome = part;
      if ("inlineData" in newPart || "storedData" in newPart) {
        for (const transformer of pipeline) {
          newPart = await transformer.transform(path, newPart);
          if (!ok(newPart)) {
            return newPart;
          }
        }
      }
      parts.push(newPart);
    }
    result.push({ ...entry, parts });
  }
  return result;
}
