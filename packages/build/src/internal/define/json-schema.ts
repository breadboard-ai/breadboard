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
  forceOptional: string[] | /* all */ true
): JSONSchema4 & {
  properties?: { [k: string]: JSONSchema4 };
} {
  const schema: JSONSchema4 & { properties?: { [k: string]: JSONSchema4 } } = {
    type: "object",
  };
  const sortedProperties = Object.entries(config).sort(([nameA], [nameB]) =>
    nameA.localeCompare(nameB)
  );
  if (sortedProperties.length > 0) {
    const optional = new Set(
      forceOptional === true ? Object.keys(config) : forceOptional
    );
    schema.properties = Object.fromEntries(
      sortedProperties.map(([name, config]) => {
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
        if ("optional" in config && config.optional === true) {
          optional.add(name);
        }
        return [name, schema];
      })
    );
    const required = sortedProperties
      .filter(([name, config]) => {
        const hasDefault = "default" in config && config.default !== undefined;
        return !hasDefault && !optional.has(name);
      })
      .map(([name]) => name);
    if (required.length > 0) {
      schema.required = required;
    }
  }
  return schema;
}
