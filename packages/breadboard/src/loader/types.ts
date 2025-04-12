/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GraphDescriptor,
  GraphTag,
  NodeConfiguration,
  NodeIdentifier,
} from "@breadboard-ai/types";
import { GraphToRun, Kit } from "../types.js";
import { DataPartTransformer } from "../data/types.js";

export type GraphProviderItem = {
  url: string;
  username?: string;
  title?: string;
  tags?: GraphTag[];
  version?: string;
  description?: string;
  thumbnail?: string | null;
  mine: boolean;
  readonly: boolean;
  handle: unknown;
};

export type GraphProviderStore = {
  permission: "unknown" | "prompt" | "granted";
  title: string;
  items: Map<string, GraphProviderItem>;
  url?: string;
};

export type GraphProviderChange = {
  type: "change" | "rename";
  previous: string | null;
  filename: string;
};

export type ChangeNotificationCallback = (
  notification: GraphProviderChange
) => void;

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
   * Whether the provider can create, edit, and delete graphs.
   */
  modify: boolean;
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
  /**
   * Whether the provider supports watching for change notifications.
   */
  watch: boolean;
  /**
   * Whether the provider supports a preview URL.
   */
  preview: boolean;
};

export type GraphProviderPreloadHandler = (item: GraphProviderItem) => void;

/**
 * Represents a provider of `GraphDescriptor` instances. This is an
 * extensibility point for Breadboard: you can add new providers to load
 * graphs from different sources.
 */
export type GraphProvider = {
  /**
   * The name of the provider.
   */
  name: string;
  /**
   * An indicator that the Provider is ready to serve graphs.
   */
  ready(): Promise<void>;
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
   * Creates a board at the given URL
   * @param url -- the URL at which to create the blank board
   * @param graph -- the descriptor to use
   * @returns -- the result of creating the board, with an error if failed.
   */
  create(
    url: URL,
    graph: GraphDescriptor
  ): Promise<{ result: boolean; error?: string; url?: string }>;
  /**
   * Given a URL, deletes a `GraphDescriptor` instance at that URL.
   * @param url -- the URL to delete
   * @returns -- the result of deleting, with an error if saving failed.
   */
  delete: (url: URL) => Promise<{ result: boolean; error?: string }>;
  /**
   * Connects to a given location if the Provider supports it.
   * @param location -- if supported, the location to connect to.
   * @param auth -- if supported, the authentication material to use.
   * @returns -- nothing, but throws if connection fails.
   */
  connect: (location?: string, auth?: unknown) => Promise<boolean>;
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
   * @returns -- the provider-specific URL as a string or null when the URL can't be created.
   */
  createURL: (location: string, fileName: string) => Promise<string | null>;
  /**
   * Parses a provider-specific URL for a board.
   * @param url -- the location of the board.
   * @returns -- the location and file name of the board.
   */
  parseURL: (url: URL) => { location: string; fileName: string };
  /**
   * Signals to the provider to restore its state. For example,
   * this is called when initializing UI to tell the store to load some
   * previously-serialized state.
   * @returns
   */
  restore: () => Promise<void>;
  /**
   * Provides a map of locations and their respective stores (lists of files)
   * that can be used to enumerate all items that the provider can provide.
   */
  items: () => Map<string, GraphProviderStore>;
  /**
   * Provides a starting URL for this store.
   * Useful when we want to pick something to start a session with.
   * Can be null if the store doesn't supply a starting URL.
   */
  startingURL: () => URL | null;
  /**
   * Given the URL of a board, returns the URL of the node proxy server, if
   * this provider supports it. If it doesn't, returns `false`.
   */
  canProxy?: (url: URL) => Promise<string | false>;
  /**
   * Provides a way to watch for changes in the store.
   */
  watch: (callback: ChangeNotificationCallback) => void;
  /**
   * Provides a way to watch for changes in the store.
   */
  preview: (url: URL) => Promise<URL>;
  /**
   * Provides a way to watch for changes in the store.
   */
  renewAccess?: () => Promise<void>;

  /**
   * Allows the provider to delegate preloading some graphs.
   * This is useful when some of the graphs are public/published, and
   * only the provider knows which ones.
   */
  preload?: (preloader: GraphProviderPreloadHandler) => Promise<void>;

  /**
   * Provides a way to transfom DataParts (InlineDataPart and StoredDataPart).
   */
  dataPartTransformer?: (graphUrl: URL) => DataPartTransformer;
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
 * Returns the result of loading the graph. When we're loading the subgraph,
 * it returns the main graph and the id of the subgraph
 */
export type GraphLoaderResult =
  | ({
      success: true;
    } & GraphToRun)
  | {
      success: false;
      error: string;
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
  ) => Promise<GraphLoaderResult>;
};

/**
 * Board Server Types
 */
export type Username = string;
export type UserApiKey = string;

export interface BoardServerCapabilities {
  connect: boolean;
  disconnect: boolean;
  refresh: boolean;
  watch: boolean;
  preview: boolean;
}

export interface BoardServerConfiguration {
  url: URL;
  projects: Promise<BoardServerProject[]>;
  kits: Kit[];
  users: User[];
  secrets: Secrets;
  extensions: BoardServerExtension[];
  capabilities: BoardServerCapabilities;
}

export interface BoardServer extends GraphProvider, BoardServerConfiguration {
  user: User;
  getAccess(url: URL, user: User): Promise<Permission>;
}

export interface EntityMetadata {
  owner: Username;
  access: Map<Username, Permission>;
  title?: string;
  description?: string;
  icon?: string;
  thumbnail?: string;
  tags?: GraphTag[];
}

export interface Entity {
  url: URL;
  metadata: EntityMetadata;
}

export interface HostAPI {
  send(method: string, args: unknown[]): Promise<void>;
}

interface BoardServerGraphActions {
  onStart(api: HostAPI): Promise<void>;
  onStop(api: HostAPI): Promise<void>;
}

interface BoardServerNodeActions {
  onSelect(
    api: HostAPI,
    id: NodeIdentifier,
    type: string,
    configuration: NodeConfiguration
  ): Promise<void>;
  onAction(
    api: HostAPI,
    action: string,
    kits: Kit[],
    id: NodeIdentifier,
    type: string,
    configuration: NodeConfiguration
  ): Promise<void>;
  onDeselect(api: HostAPI, id: NodeIdentifier): Promise<void>;
}

export interface BoardServerExtension extends Entity {
  node: BoardServerNodeActions;
  graph: BoardServerGraphActions;
}

export type BoardServerExtensionNamespace = keyof Pick<
  BoardServerExtension,
  "node" | "graph"
>;

export interface BoardServerProject extends Entity {
  board?: Board;
  handle?: unknown;
}

export interface User {
  username: Username;
  apiKey: UserApiKey;
  secrets: Secrets /* Used in preference to Board Server equivalents */;
}

export type Secrets = Map<string, string>;

export type Permission = {
  create: boolean;
  retrieve: boolean;
  update: boolean;
  delete: boolean;
};

export interface Board extends Entity {
  theme?: string;
  descriptor: GraphDescriptor;
  runs?: Run[];
  evaluations?: Evaluation[];
}

export interface Run {
  metadata: {
    dateTime: Date;
    title?: string;
  };
  descriptor: GraphDescriptor;
  status: string;
}

export interface Evaluation {
  runs: Run[];
}
