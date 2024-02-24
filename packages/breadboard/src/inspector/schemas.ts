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
  edges?: InspectableEdge[],
  keepStar = false
): Record<string, Schema> => {
  if (!edges) return {};
  return edges.reduce((acc, edge) => {
    if (!keepStar && edge.out === "*") return acc;
    const key = edgeType === EdgeType.In ? edge.in : edge.out;
    if (acc[key]) return acc;
    acc[key] = DEFAULT_SCHEMA;
    return acc;
  }, {} as Record<string, Schema>);
};

export const edgesToSchema = (
  edgeType: EdgeType,
  edges?: InspectableEdge[],
  keepStar = false
): Schema => {
  if (!edges) return {};
  return new SchemaBuilder()
    .addProperties(edgesToProperties(edgeType, edges, keepStar))
    .setAdditionalProperties(true)
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
  const inputSchema = new SchemaBuilder()
    .addProperty("schema", SCHEMA_SCHEMA)
    .build();
  if (schema) return { inputSchema, outputSchema: schema };
  return {
    inputSchema,
    outputSchema: edgesToSchema(EdgeType.Out, options.outgoing, true),
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
  const outputSchema = new SchemaBuilder()
    .setAdditionalProperties(false)
    .build();
  const inputSchemaBuilder = new SchemaBuilder()
    .addProperty("schema", SCHEMA_SCHEMA)
    .setAdditionalProperties(true);
  if (schema)
    return {
      inputSchema: inputSchemaBuilder.addSchema(schema).build(),
      outputSchema,
    };
  return {
    inputSchema: inputSchemaBuilder
      .addProperties(edgesToProperties(EdgeType.In, options.incoming, true))
      .build(),
    outputSchema,
  };
};
