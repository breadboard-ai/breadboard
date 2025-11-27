/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  BoardServer,
  BoardServerCapabilities,
  BoardServerEventTarget,
  DataPartTransformer,
  GraphDescriptor,
  GraphProviderCapabilities,
  GraphProviderItem,
  GraphProviderStore,
  MutableGraphCollection,
  Outcome,
} from "@breadboard-ai/types";
import { err, ok } from "@breadboard-ai/utils";

export { EmbeddedBoardServer, isFromEmbeddedServer };

const EMBEDDED_SERVER_PREFIX = "embed://";

function isFromEmbeddedServer(
  url: URL | string | undefined,
  urlPrefix: string
): boolean {
  if (!url) return false;
  const urlString = typeof url === "string" ? url : url.href;
  const prefix = `${EMBEDDED_SERVER_PREFIX}${urlPrefix}/`;
  return urlString.startsWith(prefix);
}

class EmbeddedBoardServer
  extends (EventTarget as BoardServerEventTarget)
  implements BoardServer
{
  name = "Embedded Board Server";
  url: URL = new URL(import.meta.url);
  capabilities: BoardServerCapabilities = {};

  #items: Map<string, GraphProviderStore>;

  constructor(
    public readonly title: string,
    public readonly urlPrefix: string,
    public readonly bgls: Map<string, GraphDescriptor>
  ) {
    super();
    this.#items = new Map([
      [
        "default",
        {
          permission: "granted",
          title,
          items: new Map(
            [...bgls.entries()].map(([id, descriptor]) => {
              return [
                id,
                {
                  url: this.#makeBoardUrl(id),
                  title: descriptor.title,
                  tags: descriptor.metadata?.tags || [],
                  version: descriptor.version,
                  description: descriptor.description,
                  mine: false,
                  readonly: true,
                  handle: null,
                },
              ];
            })
          ),
        },
      ],
    ]);
  }
  deepCopy(_url: URL, graph: GraphDescriptor): Promise<GraphDescriptor> {
    return Promise.resolve(graph);
  }
  dataPartTransformer?: ((graphUrl: URL) => DataPartTransformer) | undefined;

  #makeBoardUrl(id: string) {
    return `${EMBEDDED_SERVER_PREFIX}${this.urlPrefix}/${id}.bgl.json`;
  }

  #bglKeyFromUrl(url: URL): Outcome<string> {
    const urlString = url.href;
    const prefix = `${EMBEDDED_SERVER_PREFIX}${this.urlPrefix}/`;
    if (urlString.startsWith(prefix)) {
      return urlString.slice(prefix.length, -".bgl.json".length);
    }
    return err(`Nope`);
  }

  canProvide(url: URL): false | GraphProviderCapabilities {
    const key = this.#bglKeyFromUrl(url);
    if (!ok(key)) return false;
    return { load: true, save: false, delete: false };
  }

  async load(url: URL): Promise<GraphDescriptor | null> {
    const key = this.#bglKeyFromUrl(url);
    if (!ok(key)) return null;
    return this.bgls.get(key) || null;
  }

  async save(
    _url: URL,
    _descriptor: GraphDescriptor
  ): Promise<{ result: boolean; error?: string }> {
    return { result: false, error: "Can't save to embedded board server" };
  }

  async create(
    _url: URL,
    _graph: GraphDescriptor
  ): Promise<{ result: boolean; error?: string; url?: string }> {
    return {
      result: false,
      error: "Can't create boards to embedded board server",
    };
  }

  async delete(_url: URL): Promise<{ result: boolean; error?: string }> {
    return {
      result: false,
      error: "Can't delete boards to embedded board server",
    };
  }

  async createURL(
    _location: string,
    _fileName: string
  ): Promise<string | null> {
    return null;
  }

  get userGraphs(): MutableGraphCollection | undefined {
    return new UserGraphs(this.#items.get("default")!.items, this.urlPrefix);
  }

  items(): Map<string, GraphProviderStore> {
    return this.#items;
  }
}

class UserGraphs implements MutableGraphCollection {
  constructor(
    private readonly items: Map<string, GraphProviderItem>,
    private readonly urlPrefix: string
  ) {}

  #bglKeyFromUrl(urlString: string): Outcome<string> {
    const prefix = `${EMBEDDED_SERVER_PREFIX}${this.urlPrefix}/`;
    if (urlString.startsWith(prefix)) {
      return urlString.slice(prefix.length, -".bgl.json".length);
    }
    return err(`Nope`);
  }

  put(): void {
    throw new Error(`Embedded board server entries aren't mutable`);
  }
  delete(): boolean {
    throw new Error(`Embedded board server entries aren't mutable`);
  }
  loading = false;

  loaded: Promise<void> = Promise.resolve();

  error: Error | undefined;

  get size() {
    return this.items.size;
  }

  entries(): IterableIterator<[string, GraphProviderItem]> {
    return this.items.entries();
  }

  has(url: string): boolean {
    const key = this.#bglKeyFromUrl(url);
    if (!ok(key)) return false;
    return this.items.has(key);
  }
}
