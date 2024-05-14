/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { DEFAULT_SCHEMA, EdgeType } from "./schemas.js";
import {
  InspectableEdge,
  InspectablePort,
  InspectablePortType,
  PortStatus,
} from "./types.js";
import { BehaviorSchema, NodeConfiguration, Schema } from "../types.js";

const title = (schema: Schema, key: string) => {
  return schema.properties?.[key]?.title || key;
};

export const computePortStatus = (
  wired: boolean,
  expected: boolean,
  required: boolean,
  wiredContainsStar: boolean
): PortStatus => {
  if (wired) {
    if (expected) return PortStatus.Connected;
    return wiredContainsStar ? PortStatus.Indeterminate : PortStatus.Dangling;
  }
  if (required) {
    return wiredContainsStar ? PortStatus.Indeterminate : PortStatus.Missing;
  }
  return PortStatus.Ready;
};

export const collectPorts = (
  type: EdgeType,
  edges: InspectableEdge[],
  schema: Schema,
  addErrorPort: boolean,
  values?: NodeConfiguration
) => {
  let wiredContainsStar = false;
  // Get the list of all ports wired to this node.
  const wiredPortNames = edges.map((edge) => {
    if (edge.out === "*") {
      wiredContainsStar = true;
      return "*";
    }
    return type === EdgeType.In ? edge.in : edge.out;
  });
  const fixed = schema.additionalProperties === false;
  const schemaPortNames = Object.keys(schema.properties || {});
  if (addErrorPort) {
    // Even if not specified in the schema, all non-built-in nodes always have
    // an optional `$error` port.
    schemaPortNames.push("$error");
  }
  const schemaContainsStar = schemaPortNames.includes("*");
  const requiredPortNames = schema.required || [];
  const valuePortNames = Object.keys(values || {});
  const portNames = [
    ...new Set([
      ...wiredPortNames,
      ...schemaPortNames,
      ...valuePortNames,
      "*", // Always include the star port.
      "", // Always include the control port.
    ]),
  ];
  portNames.sort();
  return portNames
    .map((port) => {
      const star = port === "*" || port === "";
      const configured = valuePortNames.includes(port);
      const wired = wiredPortNames.includes(port);
      const expected = schemaPortNames.includes(port) || star;
      const required = requiredPortNames.includes(port);
      const portSchema = schema.properties?.[port] || DEFAULT_SCHEMA;
      if (portSchema.behavior?.includes("deprecated") && !wired) return null;
      return {
        name: port,
        title: title(schema, port),
        configured,
        value: values?.[port],
        star,
        get edges() {
          if (!wired) return [];
          return edges.filter((edge) => {
            if (edge.out === "*" && star) return true;
            return type === EdgeType.In ? edge.in === port : edge.out === port;
          });
        },
        status: computePortStatus(
          wired || configured,
          !fixed || expected || schemaContainsStar,
          required,
          wiredContainsStar
        ),
        schema: portSchema,
      };
    })
    .filter(Boolean) as InspectablePort[];
};

export class PortType implements InspectablePortType {
  constructor(public schema: Schema) {}
  #onlyTypeRelated(behavior: Set<BehaviorSchema>): Set<BehaviorSchema> {
    behavior.delete("deprecated");
    behavior.delete("transient");
    behavior.delete("config");
    return behavior;
  }

  #subset<T>(a: Set<T>, b: Set<T>) {
    return [...a].every((item) => b.has(item));
  }

  #difference<T>(a: Set<T>, b: Set<T>) {
    return new Set([...a].filter((item) => !b.has(item)));
  }

  canConnect(to: InspectablePortType): boolean {
    const type = this.schema.type || "unknown";
    const toType = to.schema.type || "unknown";
    // Allow connecting to the incoming port of unknown type.
    if (toType === "unknown") return true;
    // Otherwise, match types exactly.
    if (type !== toType) return false;
    // Match behaviors.
    // TODO: Handle arrays.
    const behavior = this.#onlyTypeRelated(new Set(this.schema.behavior));
    const toBehavior = this.#onlyTypeRelated(new Set(this.schema.behavior));
    if (behavior.size !== toBehavior.size) return false;
    if (!this.#subset(behavior, toBehavior)) return false;
    // Match formats.
    const formats = new Set(this.schema.format?.split(",") || []);
    const toFormats = new Set(to.schema.format?.split(",") || []);
    // When "to" can accept any format, no need to check for specifics.
    if (toFormats.size === 0) return true;
    // When "from" provides any format, we already know we can't handle that.
    if (formats.size === 0) return false;
    const formatDiff = this.#difference(formats, toFormats);
    if (formatDiff.size) return false;
    return true;
  }
}

export const collectPortsForType = (schema: Schema): InspectablePort[] => {
  const portNames = Object.keys(schema.properties || {});
  const requiredPortNames = schema.required || [];
  portNames.sort();
  return portNames.map((port) => {
    const portSchema: Schema = schema.properties?.[port] || DEFAULT_SCHEMA;
    return {
      name: port,
      title: title(schema, port),
      configured: false,
      star: false,
      edges: [],
      value: null,
      status: computePortStatus(
        false,
        true,
        requiredPortNames.includes(port),
        false
      ),
      schema: portSchema,
      type: new PortType(portSchema),
    };
  });
};
