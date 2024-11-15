/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { analyzeIsJsonSubSchema } from "@google-labs/breadboard-schema/subschema.js";
import { JSONSchema4 } from "json-schema";
import { BehaviorSchema, NodeConfiguration, Schema } from "../types.js";
import { DEFAULT_SCHEMA, EdgeType } from "./schemas.js";
import {
  CanConnectAnalysis,
  InspectableEdge,
  InspectablePort,
  InspectablePortType,
  PortStatus,
} from "./types.js";

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

/**
 * A mapping from each Breadboard behavior to whether or not that behavior
 * matters for type-checking.
 */
const BEHAVIOR_AFFECTS_TYPE_CHECKING: { [K in BehaviorSchema]: boolean } = {
  deprecated: false,
  transient: false,
  config: false,
  "google-drive-query": false,
  "google-drive-file-id": false,

  // TODO(aomarks) Not sure about many of these. Some affect the data type, some
  // only affect formatting?
  bubble: true,
  board: true,
  stream: true,
  error: true,
  "llm-content": true,
  "json-schema": true,
  "ports-spec": true,
  image: true,
  code: true,
  module: true,
  side: false,
};

export const collectPorts = (
  type: EdgeType,
  edges: InspectableEdge[],
  schema: Schema,
  addErrorPort: boolean,
  allowRequired: boolean,
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
          allowRequired && required,
          wiredContainsStar
        ),
        schema: portSchema,
        type: new PortType(portSchema),
        kind: type === EdgeType.In ? "input" : "output",
      } satisfies InspectablePort;
    })
    .filter(Boolean) as InspectablePort[];
};

export class PortType implements InspectablePortType {
  constructor(public schema: Schema) {}

  hasBehavior(behavior: BehaviorSchema): boolean {
    return !!this.schema.behavior?.includes(behavior);
  }

  canConnect(to: InspectablePortType): boolean {
    return this.analyzeCanConnect(to).canConnect;
  }

  analyzeCanConnect(to: InspectablePortType): CanConnectAnalysis {
    // Check standard JSON Schema subset rules.
    const subSchemaAnalysis = analyzeIsJsonSubSchema(
      this.schema as JSONSchema4,
      to.schema as JSONSchema4
    );
    if (!subSchemaAnalysis.isSubSchema) {
      return {
        canConnect: false,
        details: subSchemaAnalysis.details.map((detail) => ({
          message: "Incompatible schema",
          detail: {
            outputPath: detail.pathA,
            inputPath: detail.pathB,
          },
        })),
      };
    }
    // Check Breadboard-specific behaviors.
    const fromBehaviors = new Set(this.schema.behavior);
    for (const toBehavior of to.schema.behavior ?? []) {
      if (
        BEHAVIOR_AFFECTS_TYPE_CHECKING[toBehavior] &&
        !fromBehaviors.has(toBehavior)
      ) {
        return {
          canConnect: false,
          details: [
            {
              message: "Incompatible behaviors",
              detail: { outputPath: ["behavior"], inputPath: ["behavior"] },
            },
          ],
        };
      }
    }
    return { canConnect: true };
  }
}

export const collectPortsForType = (
  schema: Schema,
  kind: "input" | "output"
): InspectablePort[] => {
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
      kind,
    } satisfies InspectablePort;
  });
};
