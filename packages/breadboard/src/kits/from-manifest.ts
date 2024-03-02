/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { inspect } from "../inspector/index.js";
import { BoardLoader } from "../loader.js";
import { BoardRunner } from "../runner.js";
import { GraphDescriptor, Kit, KitManifest, NodeHandler } from "../types.js";

type ManifestEntry = string | GraphDescriptor;

const getGraphDescriptor = async (base: URL, entry: ManifestEntry) => {
  if (typeof entry === "string") {
    const loader = new BoardLoader({ base });
    const result = await loader.load(entry);
    return result.graph;
  } else if (entry.edges && entry.nodes) {
    return entry;
  } else {
    throw new Error("Invalid graph descriptor");
  }
};

const createHandlersFromManifest = (base: URL, nodes: KitManifest["nodes"]) => {
  return Object.fromEntries(
    Object.entries(nodes).map(([key, value]) => {
      return [
        key,
        {
          describe: async () => {
            const graph = await getGraphDescriptor(base, value);
            return await inspect(graph).describe();
          },
          invoke: async (inputs, context) => {
            const graph = await getGraphDescriptor(base, value);
            const board = await BoardRunner.fromGraphDescriptor(graph);
            return await board.runOnce(inputs, context);
          },
        } as NodeHandler,
      ];
    })
  );
};

/**
 * Creates a runtime kit from manifest.
 * @param manifest -- a `KitManifest` instance
 */
export const fromManifest = (manifest: KitManifest): Kit => {
  const { title, description, version, url } = manifest;
  return {
    title,
    description,
    version,
    url,
    handlers: createHandlersFromManifest(new URL(url), manifest.nodes),
  };
};
