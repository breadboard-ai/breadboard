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

export const edgesToSchema = (
  edgeType: EdgeType,
  edges?: InspectableEdge[]
): Schema => {
  if (!edges) return {};
  return {
    type: "object",
    properties: edges.reduce((acc, edge) => {
      acc[edgeType === EdgeType.In ? edge.in : edge.out] = { type: "string" };
      return acc;
    }, {} as Record<string, Schema>),
  };
};

const schemaFromProperties = (
  properties: Record<string, Schema>,
  additionalProperties: boolean
): Schema => {
  const keys = Object.keys(properties);
  const required = keys.filter((key) => key !== "*" && key !== "");
  let schema = { type: "object", additionalProperties } as Schema;
  if (keys.length > 0) {
    schema = { ...schema, properties };
  }
  if (required.length > 0) {
    schema = { ...schema, required };
  }
  return schema;
};

/**
 * Constructs a Schema for an input node.
 * @param options
 * @returns
 */
export const createInputSchema = (
  options: NodeTypeDescriberOptions
): NodeDescriberResult => {
  const schema = options.inputs?.schema as Schema | undefined;
  if (schema) {
    return { inputSchema: {}, outputSchema: schema };
  }
  let additionalProperties = false;
  const properties: Record<string, Schema> = {};
  options.outgoing?.forEach((edge) => {
    if (edge.out === "*") {
      additionalProperties = true;
    }
    properties[edge.out] = { type: "string" };
  });
  return {
    inputSchema: {},
    outputSchema: schemaFromProperties(properties, additionalProperties),
  };
};

/**
 * Constructs a Schema for an output node.
 * @param options
 * @returns
 */
export const createOutputSchema = (
  options: NodeTypeDescriberOptions
): NodeDescriberResult => {
  const schema = options.inputs?.schema as Schema | undefined;
  if (schema) {
    return { inputSchema: schema, outputSchema: {} };
  }
  let additionalProperties = false;
  const properties: Record<string, Schema> = {};
  options.incoming?.forEach((edge) => {
    if (edge.out === "*") {
      additionalProperties = true;
      properties[edge.in] = { type: "string", title: "*" };
      return;
    }
    properties[edge.in] = { type: "string" };
  });
  return {
    inputSchema: schemaFromProperties(properties, additionalProperties),
    outputSchema: {},
  };
};
