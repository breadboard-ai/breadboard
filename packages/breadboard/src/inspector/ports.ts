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
  required: boolean
): PortStatus => {
  if (wired) {
    return expected ? PortStatus.Connected : PortStatus.Dangling;
  }
  return required ? PortStatus.Missing : PortStatus.Ready;
};

export const collectPorts = (
  type: EdgeType,
  edges: InspectableEdge[],
  schema: Schema,
  configuration?: NodeConfiguration
) => {
  // Get the list of all ports wired to this node.
  const wiredPortNames = edges.map((edge) => {
    if (edge.out === "*") return "*";
    return type === EdgeType.In ? edge.in : edge.out;
  });
  const schemaPortNames = Object.keys(schema.properties || {});
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
  // TODO: Do something about the "schema" in the "output": it's a configured
  // value, but isn't an expected input. oops. Shows up as "Dangling".
  // TODO: When star is connected, all other ports are in a weird state: they
  // are "missing". They probably should be "wired" or "ready" instead?
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
      status: computePortStatus(wired || configured, expected, required),
      schema: schema.properties?.[port],
    };
  });
};
