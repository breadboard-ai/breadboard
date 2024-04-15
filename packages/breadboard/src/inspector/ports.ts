/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { DEFAULT_SCHEMA, EdgeType } from "./schemas.js";
import { InspectableEdge, InspectablePort, PortStatus } from "./types.js";
import { NodeConfiguration, Schema } from "../types.js";

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

export const collectPortsForType = (schema: Schema) => {
  const portNames = Object.keys(schema.properties || {});
  const requiredPortNames = schema.required || [];
  portNames.sort();
  return portNames.map((port) => {
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
      schema: schema.properties?.[port] || DEFAULT_SCHEMA,
    };
  });
};
