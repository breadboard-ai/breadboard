/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { JSONSchema4 } from "json-schema";
import type { PortConfigMap } from "../common/port.js";
import { toJSONSchema } from "../type-system/type.js";
import type { StaticInputPortConfig } from "./config.js";

export function portConfigMapToJSONSchema(
  config: PortConfigMap,
  forceOptional: string[] | /* all */ true
): JSONSchema4 & {
  properties?: { [k: string]: JSONSchema4 };
} {
  const sortedPropertyEntries = Object.entries(config).sort(
    ([nameA], [nameB]) => nameA.localeCompare(nameB)
  );
  const forceOptionalSet = new Set(
    forceOptional === true ? Object.keys(config) : forceOptional
  );
  return {
    type: "object",
    properties: Object.fromEntries(
      sortedPropertyEntries.map(
        ([name, { title, description, type, behavior, ...config }]) => {
          const schema: JSONSchema4 = { title: title ?? name };
          if (description) {
            schema.description = description;
          }
          Object.assign(schema, toJSONSchema(type));
          const defaultValue = (config as StaticInputPortConfig).default;
          if (defaultValue !== undefined) {
            schema.default = defaultValue;
          }
          if (config.format !== undefined) {
            schema.format = config.format;
          }
          if (behavior !== undefined && behavior.length > 0) {
            schema.behavior = behavior;
          }
          return [name, schema];
        }
      )
    ),
    required: sortedPropertyEntries
      .filter(([name, config]) => {
        const isOptional = (config as StaticInputPortConfig).optional === true;
        const hasDefault =
          (config as StaticInputPortConfig).default !== undefined;
        return !isOptional && !hasDefault && !forceOptionalSet.has(name);
      })
      .map(([name]) => name),
  };
}
