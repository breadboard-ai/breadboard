/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { JSONSchema4 } from "json-schema";
import type { PortConfigMap } from "../common/port.js";
import { toJSONSchema } from "../type-system/type.js";

export function portConfigMapToJSONSchema(
  config: PortConfigMap,
  omitRequired = false
): JSONSchema4 & {
  properties: { [k: string]: JSONSchema4 };
} {
  const sortedEntries = Object.entries(config).sort(([nameA], [nameB]) =>
    nameA.localeCompare(nameB)
  );
  const schema: JSONSchema4 & {
    properties: { [k: string]: JSONSchema4 };
  } = {
    type: "object",
    properties: Object.fromEntries(
      sortedEntries.map(([name, config]) => {
        const { description, type, multiline } = config;
        const schema: JSONSchema4 = {
          title: config.title ?? name,
        };
        if (description) {
          schema.description = description;
        }
        if (config.default !== undefined) {
          schema.default = config.default;
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
  };
  if (!omitRequired) {
    const required = sortedEntries
      .filter(([, config]) => config.default === undefined)
      .map(([name]) => name);
    if (required.length > 0) {
      schema.required = required;
    }
  }
  return schema;
}
