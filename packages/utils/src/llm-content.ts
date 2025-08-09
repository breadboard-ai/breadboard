/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { JSONPart, JsonSerializable, LLMContent } from "@breadboard-ai/types";

export { fromJson, toJson };

function toJson<T>(data: LLMContent[] | undefined): T | undefined {
  return (data?.at(0)?.parts?.at(0) as JSONPart)?.json as T;
}

function fromJson<T>(json: T): LLMContent[] {
  return [{ parts: [{ json: json as JsonSerializable }] }];
}
