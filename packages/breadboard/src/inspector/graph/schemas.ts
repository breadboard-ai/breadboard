/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  InspectableEdge,
  NodeDescriberResult,
  NodeTypeDescriberOptions,
  Schema,
} from "@breadboard-ai/types";
import { InspectableEdgeType } from "@breadboard-ai/types";
import { SchemaBuilder, combineSchemas } from "../../schema.js";

export enum EdgeType {
  In,
  Out,
}

const SCHEMA_SCHEMA: Schema = {
  type: "object",
  title: "Schema",
  behavior: ["json-schema", "ports-spec", "config"],
};

export const DEFAULT_SCHEMA: Schema = { type: "string" };

const blankSchema = () => ({ type: "object" });

const isStarOrControl = (edge: InspectableEdge) => {
  const type = edge.type;
  return (
    type === InspectableEdgeType.Star || type === InspectableEdgeType.Control
  );
};

const edgesToProperties = (
  edgeType: EdgeType,
  edges?: InspectableEdge[],
  keepStar = false
): Record<string, Schema> => {
  if (!edges) return {};
  return edges.reduce(
    (acc, edge) => {
      if (!keepStar && isStarOrControl(edge)) return acc;
      const key = edgeType === EdgeType.In ? edge.in : edge.out;
      if (acc[key]) return acc;
      acc[key] = DEFAULT_SCHEMA;
      return acc;
    },
    {} as Record<string, Schema>
  );
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
  const schema = (options.inputs?.schema as Schema) || blankSchema();
  const inputSchema = new SchemaBuilder()
    .addProperty("schema", SCHEMA_SCHEMA)
    .build();
  let hasStarEdge = false;
  const outgoing = options.outgoing?.filter((edge) => {
    const isStarEdge = isStarOrControl(edge);
    if (isStarEdge) {
      hasStarEdge = true;
    }
    return !isStarEdge;
  });
  const outputSchema = combineSchemas([
    edgesToSchema(EdgeType.Out, outgoing, true),
    schema,
  ]);
  if (options.asType) {
    if (!hasStarEdge) {
      outputSchema.additionalProperties = false;
    }
  }
  return { inputSchema, outputSchema };
};

/**
 * Constructs a Schema for an output node.
 * @param options
 * @returns
 */
export const describeOutput = (
  options: NodeTypeDescriberOptions
): NodeDescriberResult => {
  const schema = (options.inputs?.schema as Schema) || blankSchema();
  const outputSchema = new SchemaBuilder()
    .setAdditionalProperties(false)
    .build();
  const inputSchemaBuilder = new SchemaBuilder().addProperty(
    "schema",
    SCHEMA_SCHEMA
  );
  const inputSchema = combineSchemas([
    inputSchemaBuilder
      .addProperties(edgesToProperties(EdgeType.In, options.incoming, true))
      .setAdditionalProperties(true)
      .build(),
    schema,
  ]);
  if (options.asType) {
    // If the output has star edge incoming, make sure to communicate that
    // this output can have many actual ports: set additionalProperties to true.
    const hasStarEdge = !!options.incoming?.find((edge) => edge.out === "*");
    if (!hasStarEdge) inputSchema.additionalProperties = false;
  }
  return { inputSchema, outputSchema };
};
