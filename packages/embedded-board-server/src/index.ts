/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  BoardServer,
  BoardServerCapabilities,
  BoardServerExtension,
  BoardServerProject,
  ChangeNotificationCallback,
  err,
  GraphDescriptor,
  GraphProviderCapabilities,
  GraphProviderExtendedCapabilities,
  GraphProviderPreloadHandler,
  GraphProviderStore,
  Kit,
  ok,
  Outcome,
  Permission,
  Secrets,
  User,
} from "@google-labs/breadboard";

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

class EmbeddedBoardServer implements BoardServer {
  user: User = {
    username: "",
    apiKey: "",
    secrets: new Map(),
  };
  name = "Embedded Board Server";
  url: URL = new URL(import.meta.url);
  kits: Kit[] = [];
  users: User[] = [];
  secrets: Secrets = new Map();
  extensions: BoardServerExtension[] = [];
  capabilities: BoardServerCapabilities = {
    connect: false,
    disconnect: false,
    refresh: false,
    watch: false,
    preview: false,
  };

  #items: Map<string, GraphProviderStore>;

  constructor(
    public readonly title: string,
    public readonly urlPrefix: string,
    public readonly bgls: Map<string, GraphDescriptor>
  ) {
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

  get projects(): Promise<BoardServerProject[]> {
    return Promise.resolve<BoardServerProject[]>(
      [...this.bgls.entries()].map(([urlString, descriptor]) => {
        const url = new URL(urlString);
        const metadata = { owner: "", access: new Map() };
        return {
          url,
          metadata,
          board: { url, metadata, descriptor },
        } satisfies BoardServerProject;
      })
    );
  }

  async preload(preloader: GraphProviderPreloadHandler): Promise<void> {
    const def = this.#items.get("default")!;
    for (const entry of def.items.values()) {
      preloader(entry);
    }
  }

  getAccess(_url: URL, _user: User): Promise<Permission> {
    throw new Error("Method not implemented.");
  }

  async ready(): Promise<void> {}

  isSupported(): boolean {
    return true;
  }

  canProvide(url: URL): false | GraphProviderCapabilities {
    const key = this.#bglKeyFromUrl(url);
    if (!ok(key)) return false;
    return { load: true, save: false, delete: false };
  }

  extendedCapabilities(): GraphProviderExtendedCapabilities {
    return {
      modify: false,
      connect: false,
      disconnect: false,
      refresh: false,
      watch: false,
      preview: false,
    };
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

  async createBlank(_url: URL): Promise<{ result: boolean; error?: string }> {
    return {
      result: false,
      error: "Can't create boards on embedded board server",
    };
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

  async connect(_location?: string, _auth?: unknown): Promise<boolean> {
    return false;
  }

  async disconnect(_location: string): Promise<boolean> {
    return false;
  }

  async refresh(_location: string): Promise<boolean> {
    return true;
  }

  async createURL(
    _location: string,
    _fileName: string
  ): Promise<string | null> {
    return null;
  }

  parseURL(_url: URL): { location: string; fileName: string } {
    throw new Error("Method not implemented.");
  }

  async restore(): Promise<void> {}

  items(): Map<string, GraphProviderStore> {
    return this.#items;
  }

  startingURL(): URL | null {
    return null;
  }

  watch(_callback: ChangeNotificationCallback): void {}

  preview(_url: URL): Promise<URL> {
    throw new Error("Method not implemented.");
  }
}
