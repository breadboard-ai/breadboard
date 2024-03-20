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
 * Describes the context in which a graph is being loaded.
 * It's a subset of the `NodeHandlerContext` type.
 * @see [NodeHandlerContext]
 *
 */
export type GraphLoaderContext = {
  /**
   * The base URL for the graph being loaded. This may be a URL of the graph
   * that is loading the graph, or it may be the URL of a graph higher in
   * the graph hierarchy, since some graphs may be ephemeral: created without
   * a URL.
   */
  base?: URL;
  /**
   * The board that is loading this graph.
   */
  board?: GraphDescriptor;
  /**
   * The graph that contains the graph being loaded. Usually the same as
   * `board`, but may be different in some cases.
   * TODO: Figure out what those cases are.
   */
  outerGraph?: GraphDescriptor;
};

/**
 * Represents a loader for `GraphDescriptor` instances. This is the main
 * interface for loading graphs in Breadboard.
 */
export type GraphLoader = {
  /**
   * Loads a `GraphDescriptor` instance from a given path. May return `null`.
   * @param path -- the path to load
   * @param context -- the context in which to load the graph
   * @returns -- the loaded graph, or `null` if it could not be loaded.
   */
  load: (
    path: string,
    context: GraphLoaderContext
  ) => Promise<GraphDescriptor | null>;
};
