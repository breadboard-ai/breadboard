/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GraphDescriptor } from "@breadboard-ai/types";

const graphFieldOrder = [
  "title",
  "description",
  "$schema",
  "version",
  "edges",
  "nodes",
];

const edgeFieldOrder = ["from", "to", "out", "in"];

const nodeFieldOrder = ["id", "type", "configuration"];

export function formatGraphDescriptor(bgl: GraphDescriptor): GraphDescriptor {
  bgl = structuredClone(bgl);

  bgl.edges = (bgl.edges ?? [])
    .map((edge) => sortKeys(edge, edgeFieldOrder))
    .sort((a, b) => {
      if (a.from !== b.from) {
        return a.from.localeCompare(b.from);
      }
      if (a.to !== b.to) {
        return a.to.localeCompare(b.to);
      }
      if (a.out !== b.out) {
        return (a.out ?? "").localeCompare(b.out ?? "");
      }
      if (a.in !== b.in) {
        return (a.in ?? "").localeCompare(b.in ?? "");
      }
      return 0;
    });

  bgl.nodes = (bgl.nodes ?? [])
    .map((node) => {
      node.configuration = sortKeys(node.configuration ?? {}, []);
      if (node.type === "input" || node.type === "output") {
        const configWithSchema = node.configuration as {
          schema?: {
            properties?: Record<string, Record<string, unknown>>;
            required?: [];
          };
        };
        if (configWithSchema.schema?.properties) {
          configWithSchema.schema.properties = sortKeys(
            configWithSchema.schema.properties,
            []
          );
          for (const [name, prop] of Object.entries(
            configWithSchema.schema.properties
          )) {
            configWithSchema.schema.properties[name] = sortKeys(prop, [
              "type",
              "behavior",
              "title",
              "description",
              "default",
              "examples",
              "anyOf",
              "properties",
              "items",
              "required",
              "additionalProperties",
            ]);
          }
        }
        configWithSchema.schema?.required?.sort();
      }
      return sortKeys(node, nodeFieldOrder);
    })
    .sort((a, b) => {
      // Put inputs first, then outputs, then sort alphabetically by ID.
      if (a.type === "input" && b.type !== "input") {
        return -1;
      }
      if (b.type === "input" && a.type !== "input") {
        return 1;
      }
      if (a.type === "output" && b.type !== "output") {
        return -1;
      }
      if (b.type === "output" && a.type !== "output") {
        return 1;
      }
      return a.id.localeCompare(b.id);
    });

  if (Object.keys(bgl.graphs ?? {}).length === 0) {
    delete bgl.graphs;
  }

  if (bgl.kits?.length === 0) {
    delete bgl.kits;
  }

  return sortKeys(bgl, graphFieldOrder);
}

function sortKeys<T extends Record<string, unknown>>(
  obj: T,
  fieldOrder: string[]
): T {
  return Object.fromEntries(
    Object.entries(obj).sort(([nameA], [nameB]) => {
      const indexA = fieldOrder.indexOf(nameA);
      const indexB = fieldOrder.indexOf(nameB);
      if (indexA !== indexB) {
        return (
          (indexA === -1 ? Number.MAX_VALUE : indexA) -
          (indexB === -1 ? Number.MAX_VALUE : indexB)
        );
      }
      return nameA.localeCompare(nameB);
    })
  ) as T;
}
