/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { JSONSchema4 } from "json-schema";
import type { PortConfigMap } from "../common/port.js";
import { toJSONSchema } from "../type-system/type.js";
import type {
  Format,
  PortConfig,
  StaticInputPortConfig,
  StaticOutputPortConfig,
} from "./config.js";
import { unsafeType } from "../type-system/unsafe.js";
import type { BehaviorSchema } from "@google-labs/breadboard";

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
          const schema: JSONSchema4 = {
            ...toJSONSchema(type),
            title: title ?? name,
          };
          if (description) {
            schema.description = description;
          }
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

export function jsonSchemaToPortConfigMap(
  ioSchema: JSONSchema4
): PortConfigMap {
  return Object.fromEntries(
    Object.entries(ioSchema.properties ?? {}).map(([portName, portSchema]) => {
      const config: StaticInputPortConfig | StaticOutputPortConfig = {
        // Note we preserve the entire JSON schema inside the type wrapper. The
        // rest of the fields have special meaning in port configs so we also
        // put them at the top-level.
        type: unsafeType(portSchema),
      };
      if (portSchema.title !== undefined) {
        config.title = portSchema.title;
      }
      if (portSchema.description !== undefined) {
        config.description = portSchema.description;
      }
      if (portSchema.default !== undefined) {
        (config as StaticInputPortConfig).default = portSchema.default;
      }
      if (portSchema.format !== undefined) {
        config.format = portSchema.format as Format | undefined;
      }
      if (portSchema.behavior !== undefined) {
        config.behavior = portSchema.behavior;
      }
      return [portName, config];
    })
  );
}
