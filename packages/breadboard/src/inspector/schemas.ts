/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { NodeDescriberResult, Schema } from "../types.js";
import { InspectableEdge, NodeTypeDescriberOptions } from "./types.js";

export const emptyDescriberResult = async (): Promise<NodeDescriberResult> => {
  return {
    inputSchema: {},
    outputSchema: {},
  };
};

export const edgesToSchema = (edges?: InspectableEdge[]): Schema => {
  if (!edges) return {};
  return {
    type: "object",
    properties: edges.reduce((acc, edge) => {
      acc[edge.out] = { type: "string" };
      return acc;
    }, {} as Record<string, Schema>),
  };
};

const schemaFromProperties = (
  properties: Record<string, Schema>,
  additionalProperties: boolean
): Schema => {
  const required = Object.keys(properties);
  let schema = { type: "object", additionalProperties } as Schema;
  if (required.length > 0) {
    schema = { ...schema, required, properties };
  }
  return schema;
};

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
      return;
    }
    properties[edge.out] = { type: "string" };
  });
  return {
    inputSchema: {},
    outputSchema: schemaFromProperties(properties, additionalProperties),
  };
};

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
      return;
    }
    properties[edge.in] = { type: "string" };
  });
  return {
    inputSchema: schemaFromProperties(properties, additionalProperties),
    outputSchema: {},
  };
};
