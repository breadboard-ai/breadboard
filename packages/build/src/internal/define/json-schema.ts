/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { JSONSchema4 } from "json-schema";
import type { PortConfigMap } from "../common/port.js";
import { toJSONSchema } from "../type-system/type.js";

export function portConfigMapToJSONSchema(
  config: PortConfigMap
): JSONSchema4 & {
  properties: { [k: string]: JSONSchema4 };
} {
  return {
    type: "object",
    properties: Object.fromEntries(
      Object.entries(config)
        .sort(([nameA], [nameB]) => nameA.localeCompare(nameB))
        .map(([name, { description, type, multiline }]) => {
          const schema: JSONSchema4 = {
            title: name,
          };
          if (description) {
            schema.description = description;
          }
          Object.assign(schema, toJSONSchema(type));
          if (multiline === true) {
            // TODO(aomarks) This is not a valid use of the JSON Schema format
            // keyword according to
            // https://opis.io/json-schema/2.x/formats.html. We should probably put
            // Breadboard specific stuff somewhere else (e.g. in a breadboard
            // property).
            schema.format = "multiline";
          }
          return [name, schema];
        })
    ),
    required: Object.keys(config).sort(),
  };
}
