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
  properties?: { [k: string]: JSONSchema4 };
} {
  const schema: JSONSchema4 & { properties?: { [k: string]: JSONSchema4 } } = {
    type: "object",
  };
  const sortedEntries = Object.entries(config).sort(([nameA], [nameB]) =>
    nameA.localeCompare(nameB)
  );
  if (sortedEntries.length > 0) {
    schema.properties = Object.fromEntries(
      sortedEntries.map(([name, config]) => {
        const { description, type, behavior } = config;
        const schema: JSONSchema4 = {
          title: config.title ?? name,
        };
        if (description) {
          schema.description = description;
        }
        if ("default" in config && config.default !== undefined) {
          schema.default = config.default;
        }
        Object.assign(schema, toJSONSchema(type));
        if ("format" in config && config.format !== undefined) {
          schema.format = config.format;
        }
        if (behavior !== undefined && behavior.length > 0) {
          schema.behavior = behavior;
        }
        return [name, schema];
      })
    );
    if (!omitRequired) {
      const required = sortedEntries
        .filter(
          ([, config]) => !("default" in config) || config.default === undefined
        )
        .map(([name]) => name);
      if (required.length > 0) {
        schema.required = required;
      }
    }
  }
  return schema;
}
