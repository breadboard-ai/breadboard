/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphDescriptor, GraphToRun, LLMContent } from "@breadboard-ai/types";
import { Template, graphUrlLike } from "@breadboard-ai/utils";
import { isLLMContent, isLLMContentArray } from "@breadboard-ai/data";

export { resolveGraphUrls };

/**
 * Walks over the GraphDescriptor specified in GraphToRun and resolves all
 * relative URLs in the GraphDescriptor to be absolute. Returns a new
 * instance of a GraphToRun and a new instance of the GraphDescriptor.
 *
 * @param graphToRun an instance of GraphToRun
 * @returns a new instance of GraphToRun
 */
function resolveGraphUrls(graphToRun: GraphToRun): GraphToRun {
  const { graph: mainGraph, subGraphId, moduleId } = graphToRun;
  if (moduleId) {
    return graphToRun;
  }
  const graph = subGraphId ? mainGraph.graphs?.[subGraphId] : mainGraph;
  if (!graph) {
    console.warn(
      `Subgraph "${subGraphId}" of "${mainGraph.title}" was not found,
      this graph will not be runnable`
    );
    return graphToRun;
  }
  const base = urlFromString(mainGraph.url);
  if (!base) {
    console.warn(
      `Graph "${graph.title}" does not have a URL. Very likely, this graph will not be runnable.`
    );
    return graphToRun;
  }

  const resolved: GraphDescriptor = { ...graph };

  // First, walk through all node types and for the URL-like ones, make
  // them absolute.

  // Second, walk through all node configurations and for the ones that
  // contains templates, make them absolute.

  resolved.nodes = graph.nodes.map((node) => {
    let { type, configuration } = node;
    if (graphUrlLike(node.type)) {
      type = new URL(node.type, base).href;
    }
    if (configuration) {
      configuration = Object.fromEntries(
        Object.entries(configuration).map(([port, value]) => {
          if (isLLMContent(value)) {
            return [port, resolveParts(value, base)];
          } else if (isLLMContentArray(value)) {
            return [port, value.map((content) => resolveParts(content, base))];
          }
          return [port, value];
        })
      );
    }
    return { ...node, type, configuration };
  });

  const result = subGraphId
    ? {
        ...mainGraph,
        graphs: {
          ...mainGraph.graphs,
          [subGraphId]: resolved,
        },
      }
    : resolved;

  return { ...graphToRun, graph: result };
}

function resolveParts(content: LLMContent, base: URL): LLMContent {
  return {
    ...content,
    parts: content.parts.map((part) => {
      if ("text" in part) {
        const text = new Template(part.text).transform((part) => {
          if (part.type === "tool") {
            if (graphUrlLike(part.path)) {
              return { ...part, path: new URL(part.path, base).href };
            }
          }
          return part;
        });
        return { text };
      }
      return part;
    }),
  };
}

function urlFromString(url: string | undefined): URL | undefined {
  if (!url) return;
  try {
    return new URL(url);
  } catch {
    return;
  }
}
