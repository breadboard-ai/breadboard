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
   */
  save: boolean;
  /**
   * Whether the provider can delete graphs at the given URL.
   */
  delete: boolean;
};

export type GraphProviderExtendedCapabilities = {
  /**
   * Whether the provider can create empty graphs at the given URL.
   */
  create: boolean;
  /**
   * Whether the provider can be connected.
   */
  connect: boolean;
  /**
   * Whether the provider can be disconnected.
   */
  disconnect: boolean;
  /**
   * Whether the provider supports refreshing.
   */
  refresh: boolean;
};

/**
 * Represents a provider of `GraphDescriptor` instances. This is an
 * extensibility point for Breadboard: you can add new providers to load
 * graphs from different sources.
 */
export type GraphProvider = {
  /**
   * Whether the provider is supported or not in the current environment.
   */
  isSupported(): boolean;
  /**
   * Given a URL, returns `false` if the provider cannot provide a graph for
   * that URL, or a `GraphProviderCapabilities` object if it can.
   * @param url -- the URL to check.
   */
  canProvide(url: URL): false | GraphProviderCapabilities;
  /**
   * Expresses the `GraphProviderExtendedCapabilities` of the provider.
   */
  extendedCapabilities(): GraphProviderExtendedCapabilities;
  /**
   * Given a URL, loads a `GraphDescriptor` instance from that URL. May
   * return `null` if the graph could not be loaded.
   * @param url -- the URL to load.
   * @returns -- the loaded graph, or `null` if it could not be loaded.
   */
  load: (url: URL) => Promise<GraphDescriptor | null>;
  /**
   * Given a URL, saves a `GraphDescriptor` instance to that URL.
   * @param url -- the URL to save.
   * @param descriptor -- the Graph Descriptor to save.
   * @returns -- the result of saving, with an error if saving failed.
   */
  save: (
    url: URL,
    descriptor: GraphDescriptor
  ) => Promise<{ result: boolean; error?: string }>;
  /**
   * Creates a blank board at the given URL
   * @param url -- the URL at which to create the blank board
   * @returns -- the result of creating the board, with an error if failed.
   */
  createBlank(url: URL): Promise<{ result: boolean; error?: string }>;
  /**
   * Given a URL, deletes a `GraphDescriptor` instance at that URL.
   * @param url -- the URL to delete
   * @returns -- the result of deleting, with an error if saving failed.
   */
  delete: (url: URL) => Promise<{ result: boolean; error?: string }>;
  /**
   * Connects to a given location if the Provider supports it.
   * @param location -- if supported, the location to connect to.
   * @returns -- nothing, but throws if connection fails.
   */
  connect: (location?: string) => Promise<boolean>;
  /**
   * Disconnects to a given location if the Provider supports it.
   * @param url -- the location to save.
   * @returns -- nothing, but throws if disconnection fails.
   */
  disconnect: (location: string) => Promise<boolean>;
  /**
   * Refreshes a given location if the Provider supports it.
   * @param url -- the location to refresh.
   * @returns -- nothing, but throws if refreshing fails.
   */
  refresh: (location: string) => Promise<boolean>;
  /**
   * Creates a provider-specific URL for a board.
   * @param location -- the location of the board.
   * @param fileName -- the board file path.
   * @returns -- the provider-specific URL as a string.
   */
  createURL: (location: string, fileName: string) => string;
  /**
   * Parses a provider-specific URL for a board.
   * @param url -- the location of the board.
   * @returns -- the location and file name of the board.
   */
  parseURL: (url: URL) => { location: string; fileName: string };
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
