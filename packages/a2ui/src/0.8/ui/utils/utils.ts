/*
 Copyright 2025 Google LLC

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

      https://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

import { A2UIModelProcessor } from "../../data/model-processor.js";
import { type StringValue } from "../../types/primitives.js";
import { type AnyComponentNode } from "../../types/types.js";

export function extractValue(
  val: StringValue | null,
  component: AnyComponentNode | null,
  processor: A2UIModelProcessor | null,
  surfaceId: string | null
): string {
  if (val !== null && typeof val === "object") {
    if ("literalString" in val) {
      return val.literalString ?? "";
    } else if ("literal" in val && val.literal !== undefined) {
      return val.literal ?? "";
    } else if (val && "path" in val && val.path) {
      if (!processor || !component) {
        return "(no model)";
      }

      const textValue = processor.getData(
        component,
        val.path,
        surfaceId ?? A2UIModelProcessor.DEFAULT_SURFACE_ID
      );

      if (textValue === null || typeof textValue !== "string") {
        return "";
      }

      return textValue;
    }
  }

  return "";
}
