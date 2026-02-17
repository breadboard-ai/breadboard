/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GraphDescriptor,
  GraphIdentifier,
  GraphTag,
} from "./graph-descriptor.js";
import {
  TypedEventTarget,
  TypedEventTargetType,
} from "./typed-event-target.js";

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
  metadata?: { liteModeFeaturedIndex?: number };
};

export type GraphProviderStore = {
  permission: "unknown" | "prompt" | "granted";
  title: string;
  items: Map<string, GraphProviderItem>;
  url?: string;
};

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
   * Given a URL, returns `false` if the provider cannot provide a graph for
   * that URL, or a `GraphProviderCapabilities` object if it can.
   * @param url -- the URL to check.
   */
  canProvide(url: URL): false | GraphProviderCapabilities;
  /**
   * IMPORTANT: This method **assumes that the given graph has been successfully
   * loaded at some point in the lifetime of this instance**, and will always
   * return `undefined` otherwise.
   *
   * @returns Whether the currently signed-in user owns the given graph, or
   * `undefined` if we don't know because the graph hasn't been loaded yet.
   */
  isMine: (url: URL) => boolean;

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
   * @param userInitiated -- whether or not the user initiated the save,
   *      as opposed to auto-save.
   * @returns -- the result of saving, with an error if saving failed.
   */
  save: (
    url: URL,
    descriptor: GraphDescriptor,
    userInitiated: boolean
  ) => Promise<{ result: boolean; error?: string }>;
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
   * Returns whether the given URL was created by this specific instance of the
   * board server.
   */
  createdDuringThisSession?(url: URL): boolean;
  /**
   * Given a URL, deletes a `GraphDescriptor` instance at that URL.
   * @param url -- the URL to delete
   * @returns -- the result of deleting, with an error if saving failed.
   */
  deepCopy(url: URL, graph: GraphDescriptor): Promise<GraphDescriptor>;
  delete: (url: URL) => Promise<{ result: boolean; error?: string }>;
  /**
   * Creates a provider-specific URL for a board.
   * @param location -- the location of the board.
   * @param fileName -- the board file path.
   * @returns -- the provider-specific URL as a string or null when the URL can't be created.
   */
  createURL: (location: string, fileName: string) => Promise<string | null>;
  /**
   * A signal-backed collection of graphs owned by the signed-in user.
   */
  userGraphs?: MutableGraphCollection;
  /**
   * A signal-backed collection of featured gallery graphs.
   */
  galleryGraphs?: ImmutableGraphCollection;
};

/**
 * Note that all properties and methods on this interface are expected to be
 * signal-backed.
 */
export interface ImmutableGraphCollection {
  readonly loading: boolean;
  readonly loaded: Promise<void>;
  readonly error: Error | undefined;
  readonly size: number;
  entries(): IterableIterator<[string, GraphProviderItem]>;
  has(url: string): boolean;
}

export interface MutableGraphCollection extends ImmutableGraphCollection {
  put(graph: GraphProviderItem): void;
  delete(url: string): boolean;
}

/**
 * Returns the result of loading the graph. When we're loading the subgraph,
 * it returns the main graph and the id of the subgraph
 */
export type GraphLoaderResult =
  | {
      success: true;
      graph: GraphDescriptor;
      subGraphId?: GraphIdentifier;
    }
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
  load: (path: string) => Promise<GraphLoaderResult>;
};

/**
 * Board Server Types
 */

export interface BoardServerCapabilities {
  events?: boolean;
  /**
   * Whether or not the board server manages saving itself. If true,
   * the client is encouraged to not debounce saves and just invoke
   * `save` whenever the graph is updated.
   */
  autosave?: boolean;
}

export type BoardServerSaveEventStatus =
  | "idle"
  | "debouncing"
  | "queued"
  | "saving";

export type BoardServerSaveStatusChangeEvent = Event & {
  status: BoardServerSaveEventStatus;
  url: string;
};

/** List of boards has changed. */
export type BoardServerListRefreshed = Event;

export type BoardServerEventMap = {
  savestatuschange: BoardServerSaveStatusChangeEvent;
};

export type BoardServerEventTarget = TypedEventTarget<BoardServerEventMap>;

export interface BoardServer
  extends GraphProvider, TypedEventTargetType<BoardServerEventMap> {
  getLatestSharedVersion?(url: URL): number;
  capabilities: BoardServerCapabilities;
}
