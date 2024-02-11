/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { NodeDescriberResult, Schema } from "../types.js";
import { InspectableEdge, NodeTypeDescriberOptions } from "./types.js";

export enum EdgeType {
  In,
  Out,
}

const schemaFromProperties = (properties: Record<string, Schema>): Schema => {
  const keys = Object.keys(properties);
  const required = keys.filter((key) => key !== "*" && key !== "");
  let schema = { type: "object" } as Schema;
  if (keys.length > 0) {
    schema = { ...schema, properties };
  }
  if (required.length > 0) {
    schema = { ...schema, required };
  }
  return schema;
};

export const edgesToSchema = (
  edgeType: EdgeType,
  edges?: InspectableEdge[]
): Schema => {
  if (!edges) return {};
  return schemaFromProperties(
    edges.reduce((acc, edge) => {
      // Remove star edges from the schema. These must be handled separately.
      if (edge.out === "*") return acc;
      const key = edgeType === EdgeType.In ? edge.in : edge.out;
      if (acc[key]) return acc;
      acc[key] = { type: "string" };
      return acc;
    }, {} as Record<string, Schema>)
  );
};

/**
 * Constructs a Schema for an input node.
 * @param options
 * @returns
 */
export const createSchemaForInput = (
  options: NodeTypeDescriberOptions
): NodeDescriberResult => {
  const schema = options.inputs?.schema as Schema | undefined;
  if (schema) return { inputSchema: {}, outputSchema: schema };
  return {
    inputSchema: {},
    outputSchema: edgesToSchema(EdgeType.Out, options.outgoing),
  };
};

/**
 * Constructs a Schema for an output node.
 * @param options
 * @returns
 */
export const createSchemaForOutput = (
  options: NodeTypeDescriberOptions
): NodeDescriberResult => {
  const schema = options.inputs?.schema as Schema | undefined;
  if (schema) return { inputSchema: schema, outputSchema: {} };
  return {
    inputSchema: edgesToSchema(EdgeType.In, options.incoming),
    outputSchema: {},
  };
};
