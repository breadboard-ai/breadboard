/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { JSONSchema4 } from "json-schema";
import type { PortConfigMap } from "../common/port.js";
import { toJSONSchema } from "../type-system/type.js";

export function portConfigMapToJSONSchema(config: PortConfigMap): JSONSchema4 {
  return {
    type: "object",
    properties: Object.fromEntries(
      [...Object.entries(config)].map(([name, { description, type }]) => {
        const schema = toJSONSchema(type);
        schema.title = name;
        if (description !== undefined) {
          schema.description = description;
        }
        return [name, schema];
      })
    ),
    required: [...Object.keys(config)],
  };
}
