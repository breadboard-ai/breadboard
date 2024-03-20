/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { inspect } from "../inspector/index.js";
import { loadWithFetch } from "../loader/default.js";
import { createLoader } from "../loader/index.js";
import { BoardRunner } from "../runner.js";
import { GraphDescriptor, Kit, KitManifest, NodeHandler } from "../types.js";
import { asRuntimeKit } from "./ctors.js";

type ManifestEntry = string | GraphDescriptor;

const getGraphDescriptor = async (
  base: URL,
  key: string,
  entry: ManifestEntry
) => {
  if (typeof entry === "string") {
    const loader = createLoader();
    const result = await loader.load(entry, { base });
    if (result === null) {
      throw new Error(`Unable to load graph descriptor from "${entry}"`);
    }
    return result;
  } else if (entry.edges && entry.nodes) {
    const url = new URL(base);
    url.searchParams.set("graph", key);
    return { ...entry, url: url.href };
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
            const graph = await getGraphDescriptor(base, key, value);
            return await inspect(graph).describe();
          },
          invoke: async (inputs, context) => {
            const graph = await getGraphDescriptor(base, key, value);
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

const isKitManifest = (obj: unknown): obj is KitManifest => {
  if (typeof obj !== "object" || obj === null) return false;
  const manifest = obj as KitManifest;
  return (
    typeof manifest.title === "string" &&
    typeof manifest.description === "string" &&
    typeof manifest.version === "string" &&
    typeof manifest.url === "string" &&
    typeof manifest.nodes === "object"
  );
};

/**
 * Loads a kit from a URL.
 *
 * @param url -- a URL to a kit manifest or an npm URL.
 */
export const load = async (url: URL): Promise<Kit> => {
  if (url.protocol === "https:" || url.protocol === "http:") {
    if (url.pathname.endsWith(".kit.json")) {
      const maybeManifest = await loadWithFetch(url);
      if (isKitManifest(maybeManifest)) {
        return fromManifest(maybeManifest);
      }
    } else {
      // Assume that this is a URL to a JS file.
      const module = await import(/* @vite-ignore */ url.href);
      if (module.default == undefined) {
        throw new Error(`Module ${url} does not have a default export.`);
      }

      const moduleKeys = Object.getOwnPropertyNames(module.default.prototype);

      if (
        moduleKeys.includes("constructor") == false ||
        moduleKeys.includes("handlers") == false
      ) {
        throw new Error(
          `Module default export '${url}' does not look like a Kit (either no constructor or no handler).`
        );
      }
      return asRuntimeKit(module.default);
    }
  } else if (url.protocol === "file:") {
    throw new Error("File protocol is not yet supported");
  }
  throw new Error(`Unable to load kit from "${url}"`);
};
