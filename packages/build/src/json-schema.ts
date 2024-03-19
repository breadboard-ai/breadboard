/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { PortConfigMap } from "./port.js";
import { toJSONSchema } from "./type.js";

export function shapeToJSONSchema(shape: PortConfigMap) {
  return {
    type: "object",
    properties: Object.fromEntries(
      [...Object.entries(shape)].map(([title, { description, type }]) => {
        return [
          title,
          Object.assign({ title, description }, toJSONSchema(type)),
        ];
      })
    ),
    required: [...Object.keys(shape)],
  };
}
