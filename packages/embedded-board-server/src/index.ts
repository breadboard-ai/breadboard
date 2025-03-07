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
  GraphDescriptor,
  GraphProviderCapabilities,
  GraphProviderExtendedCapabilities,
  GraphProviderStore,
  Kit,
  Permission,
  Secrets,
  User,
} from "@google-labs/breadboard";

export { EmbeddedBoardServer };

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

  constructor(
    public readonly urlPrefix: string,
    public readonly bgls: Map<string, GraphDescriptor>
  ) {}

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

  getAccess(_url: URL, _user: User): Promise<Permission> {
    throw new Error("Method not implemented.");
  }

  ready(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  isSupported(): boolean {
    return true;
  }

  canProvide(url: URL): false | GraphProviderCapabilities {
    const urlString = url.href;
    return this.bgls.has(urlString)
      ? {
          load: true,
          save: false,
          delete: false,
        }
      : false;
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
    const urlString = url.href;
    return this.bgls.get(urlString) || null;
  }

  save(
    _url: URL,
    _descriptor: GraphDescriptor
  ): Promise<{ result: boolean; error?: string }> {
    throw new Error("Not Implemented");
  }

  createBlank(_url: URL): Promise<{ result: boolean; error?: string }> {
    throw new Error("Method not implemented.");
  }

  create(
    _url: URL,
    _graph: GraphDescriptor
  ): Promise<{ result: boolean; error?: string; url?: string }> {
    throw new Error("Method not implemented.");
  }

  delete(_url: URL): Promise<{ result: boolean; error?: string }> {
    throw new Error("Method not implemented.");
  }

  connect(_location?: string, _auth?: unknown): Promise<boolean> {
    throw new Error("Method not implemented.");
  }

  disconnect(_location: string): Promise<boolean> {
    throw new Error("Method not implemented.");
  }

  refresh(_location: string): Promise<boolean> {
    throw new Error("Method not implemented.");
  }

  createURL(_location: string, _fileName: string): Promise<string | null> {
    throw new Error("Method not implemented.");
  }

  parseURL(_url: URL): { location: string; fileName: string } {
    throw new Error("Method not implemented.");
  }

  restore(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  items(): Map<string, GraphProviderStore> {
    throw new Error("Method not implemented.");
  }

  startingURL(): URL | null {
    throw new Error("Method not implemented.");
  }

  watch(_callback: ChangeNotificationCallback): void {
    throw new Error("Method not implemented.");
  }

  preview(_url: URL): Promise<URL> {
    throw new Error("Method not implemented.");
  }
}
