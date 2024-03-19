/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphDescriptor } from "@google-labs/breadboard-schema/graph.js";

/**
 * Describes the capabilities of a `GraphProvider` instance.
 */
export type GraphProviderCapabilities = {
  /**
   * Whether the provider can load graphs from the given URL.
   */
  load: boolean;
  /**
   * Whether the provider can save graphs to the given URL.
   * (Not yet implemented.)
   */
  save: boolean;
};

/**
 * Represents a provider of `GraphDescriptor` instances. This is an
 * extensibility point for Breadboard: you can add new providers to load
 * graphs from different sources.
 */
export type GraphProvider = {
  /**
   * Given a URL, returns `false` if the provider cannot provide a graph for
   * that URL, or a `GraphProviderCapabilities` object if it can.
   * @param url -- the URL to check
   */
  canProvide(url: URL): false | GraphProviderCapabilities;
  /**
   * Given a URL, loads a `GraphDescriptor` instance from that URL. May
   * return `null` if the graph could not be loaded.
   * @param url -- the URL to load
   * @returns -- the loaded graph, or `null` if it could not be loaded.
   */
  load: (url: URL) => Promise<GraphDescriptor | null>;
};

/**
 * Represents a loader for `GraphDescriptor` instances. This is the main
 * interface for loading graphs in Breadboard.
 */
export type GraphLoader = {
  /**
   *
   * @param url -- the URL to load
   * @param supergraph -- the graph within which the `url` of the graph being
   *   loaded. When supplied, the `load` is being invoked from a node in a
   *   subgraph of a `supergraph`. This serves as a context for loading URLs
   *   that are just hashes, referring to other graphs within the same supergraph.
   * @returns -- the loaded graph, or `null` if it could not be loaded.
   */
  load: (
    url: URL | string,
    supergraph?: GraphDescriptor
  ) => Promise<GraphDescriptor | null>;
};
