/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EdgeType } from "./schemas.js";
import { InspectableEdge, PortStatus } from "./types.js";
import { NodeConfiguration, Schema } from "../types.js";

export const computePortStatus = (
  wired: boolean,
  expected: boolean,
  required: boolean,
  wiredContainsStar: boolean
): PortStatus => {
  if (wired) {
    if (expected) return PortStatus.Connected;
    return wiredContainsStar ? PortStatus.Inteterminate : PortStatus.Dangling;
  }
  if (required) {
    return wiredContainsStar ? PortStatus.Inteterminate : PortStatus.Missing;
  }
  return PortStatus.Ready;
};

export const collectPorts = (
  type: EdgeType,
  edges: InspectableEdge[],
  schema: Schema,
  configuration?: NodeConfiguration
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
  const schemaPortNames = Object.keys(schema.properties || {});
  const schemaContainsStar = schemaPortNames.includes("*");
  const requiredPortNames = schema.required || [];
  const configuredPortNames = Object.keys(configuration || {});
  const portNames = [
    ...new Set([
      ...wiredPortNames,
      ...schemaPortNames,
      ...configuredPortNames,
      "*", // Always include the star port.
    ]),
  ];
  portNames.sort();
  return portNames.map((port) => {
    const star = port === "*";
    const configured = configuredPortNames.includes(port);
    const wired = wiredPortNames.includes(port);
    const expected = schemaPortNames.includes(port) || star;
    const required = requiredPortNames.includes(port);
    return {
      name: port,
      configured,
      star,
      status: computePortStatus(
        wired || configured,
        expected || schemaContainsStar,
        required,
        wiredContainsStar
      ),
      schema: schema.properties?.[port],
    };
  });
};

export const collectPortsForType = (schema: Schema) => {
  const portNames = Object.keys(schema.properties || {});
  const requiredPortNames = schema.required || [];
  portNames.sort();
  return portNames.map((port) => {
    return {
      name: port,
      configured: false,
      star: false,
      status: computePortStatus(
        false,
        true,
        requiredPortNames.includes(port),
        false
      ),
      schema: schema.properties?.[port],
    };
  });
};
