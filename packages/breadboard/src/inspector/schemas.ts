/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SchemaBuilder } from "../schema.js";
import { NodeDescriberResult, Schema } from "../types.js";
import { InspectableEdge, NodeTypeDescriberOptions } from "./types.js";

export enum EdgeType {
  In,
  Out,
}

// TODO: Specify actual "schema" schema.
const SCHEMA_SCHEMA = { type: "object" };

const DEFAULT_SCHEMA = { type: "string" };

const edgesToProperties = (
  edgeType: EdgeType,
  edges?: InspectableEdge[]
): Record<string, Schema> => {
  if (!edges) return {};
  return edges.reduce((acc, edge) => {
    // Remove star edges from the schema. These must be handled separately.
    if (edge.out === "*") return acc;
    const key = edgeType === EdgeType.In ? edge.in : edge.out;
    if (acc[key]) return acc;
    acc[key] = DEFAULT_SCHEMA;
    return acc;
  }, {} as Record<string, Schema>);
};

export const edgesToSchema = (
  edgeType: EdgeType,
  edges?: InspectableEdge[]
): Schema => {
  if (!edges) return {};
  return new SchemaBuilder()
    .addProperties(edgesToProperties(edgeType, edges))
    .build();
};

/**
 * Constructs a Schema for an input node.
 * @param options
 * @returns
 */
export const describeInput = (
  options: NodeTypeDescriberOptions
): NodeDescriberResult => {
  const schema = options.inputs?.schema as Schema | undefined;
  if (schema) return { inputSchema: {}, outputSchema: schema };
  return {
    inputSchema: new SchemaBuilder()
      .addProperty("schema", SCHEMA_SCHEMA)
      .build(),
    outputSchema: edgesToSchema(EdgeType.Out, options.outgoing),
  };
};

/**
 * Constructs a Schema for an output node.
 * @param options
 * @returns
 */
export const describeOutput = (
  options: NodeTypeDescriberOptions
): NodeDescriberResult => {
  const schema = options.inputs?.schema as Schema | undefined;
  if (schema) return { inputSchema: schema, outputSchema: {} };
  return {
    inputSchema: new SchemaBuilder()
      .addProperties(edgesToProperties(EdgeType.In, options.incoming))
      .addProperty("schema", SCHEMA_SCHEMA)
      .build(),
    outputSchema: {},
  };
};
