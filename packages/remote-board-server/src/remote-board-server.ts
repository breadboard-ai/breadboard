/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  blank,
  DataPartTransformer,
  NodeIdentifier,
  type BoardServer,
  type BoardServerCapabilities,
  type BoardServerConfiguration,
  type BoardServerExtension,
  type BoardServerProject,
  type ChangeNotificationCallback,
  type GraphDescriptor,
  type GraphProviderCapabilities,
  type GraphProviderExtendedCapabilities,
  type GraphProviderItem,
  type GraphProviderStore,
  type Kit,
  type Permission,
  type User,
} from "@google-labs/breadboard";
import { ConnectionArgs, RemoteConnector } from "./types";
import { createRequest, getSigninToken } from "./utils";
import { TokenVendor } from "@breadboard-ai/connection-client";
import { RemotePartTransformer } from "./remote-part-transformer";

const USER_REGEX = /\/@[^/]+\//;

export class RemoteBoardServer implements BoardServer, RemoteConnector {
  public readonly url: URL;
  public readonly users: User[];
  public readonly secrets = new Map<string, string>();
  public readonly extensions: BoardServerExtension[] = [];
  public readonly capabilities: BoardServerCapabilities;

  projects: Promise<BoardServerProject[]>;
  kits: Kit[];

  static readonly PROTOCOL = "https://";
  static readonly LOCALHOST = "http://localhost";

  static async connect(url: string, args: ConnectionArgs) {
    if (url.endsWith("/")) {
      url = url.replace(/\/$/, "");
    }

    const userRequest = createRequest(`${url}/me`, args, "GET");
    const infoRequest = createRequest(`${url}/info`, null, "GET");

    try {
      const [infoRes, userRes] = await Promise.all([
        fetch(infoRequest),
        fetch(userRequest),
      ]);

      const [info, user] = await Promise.all([infoRes.json(), userRes.json()]);
      return { title: info.title, username: user.username };
    } catch (err) {
      console.warn(err);
      return false;
    }
  }

  static async from(
    url: string,
    title: string,
    user: User,
    tokenVendor?: TokenVendor,
    autoLoadProjects = true
  ) {
    // Add a slash at the end of the URL string, because all URL future
    // construction will depend on it.
    const endsWithSlash = url.endsWith("/");
    if (!endsWithSlash) url = `${url}/`;
    try {
      const configuration = {
        url: new URL(url),
        projects: Promise.resolve([]),
        kits: [],
        users: [],
        secrets: new Map(),
        extensions: [],
        capabilities: {
          connect: true,
          disconnect: true,
          refresh: true,
          watch: false,
          preview: true,
        },
      };

      return new RemoteBoardServer(
        title,
        configuration,
        user,
        tokenVendor,
        autoLoadProjects
      );
    } catch (err) {
      console.warn(err);
      return null;
    }
  }

  constructor(
    public readonly name: string,
    public readonly configuration: BoardServerConfiguration,
    public readonly user: User,
    public readonly tokenVendor?: TokenVendor,
    autoLoadProjects = true
  ) {
    this.url = configuration.url;
    this.projects = autoLoadProjects
      ? this.#refreshProjects()
      : Promise.resolve([]);
    this.kits = configuration.kits;
    this.users = configuration.users;
    this.secrets = configuration.secrets;
    this.extensions = configuration.extensions;
    this.capabilities = configuration.capabilities;
  }

  // This is a workaround for items() being sync. Since we expect ready() to be
  // awaited we know #projects will be populated by the time items() is called.
  #projects: BoardServerProject[] = [];
  async ready(): Promise<void> {
    this.#projects = await this.projects;
  }

  async getAccess(url: URL, user: User): Promise<Permission> {
    const project = this.#findProject(url.pathname);

    const defaultPermission = {
      create: false,
      retrieve: false,
      update: false,
      delete: false,
    };

    if (!project) {
      return defaultPermission;
    }

    return project.metadata.access.get(user.username) ?? defaultPermission;
  }

  isSupported(): boolean {
    return true;
  }

  #findProject(url: string): BoardServerProject | null {
    return (
      this.#projects.find((project) => {
        return (
          url.startsWith(project.url.pathname) ||
          url.startsWith(project.url.pathname.replace(USER_REGEX, "/"))
        );
      }) ?? null
    );
  }

  canProvide(url: URL): false | GraphProviderCapabilities {
    if (
      !url.href.startsWith(this.url.href) &&
      !url.href.startsWith(this.url.href.replace(USER_REGEX, "/"))
    ) {
      return false;
    }

    const project = this.#findProject(url.pathname);

    // We recognize it as something that can be loaded from this Board Server,
    // but we can't assess the access for it, so assume loading alone is
    // acceptable.
    if (!project) {
      return {
        load: true,
        save: false,
        delete: false,
      };
    }

    const access = project.metadata.access.get(this.user.username) ?? {
      create: false,
      retrieve: true,
      update: false,
      delete: false,
    };

    return {
      load: true,
      save: access.update,
      delete: access.delete,
    };
  }

  extendedCapabilities(): GraphProviderExtendedCapabilities {
    return {
      modify: true,
      connect: true,
      disconnect: true,
      refresh: true,
      watch: false,
      preview: true,
    };
  }

  async load(url: URL): Promise<GraphDescriptor | null> {
    const project = this.#findProject(url.pathname);
    if (!project) {
      return null;
    }

    if (
      project.url.href === url.href ||
      project.url.href.replace(USER_REGEX, "/") === url.href
    ) {
      const request = createRequest(url, await this.connectionArgs(), "GET");
      const response = await fetch(request);
      const graph = await response.json();
      return graph;
    }

    return null;
  }

  async save(
    url: URL,
    descriptor: GraphDescriptor
  ): Promise<{ result: boolean; error?: string }> {
    if (!this.canProvide(url)) {
      return { result: false };
    }

    const data = await this.#sendToRemote(new URL(url), descriptor);
    if (data.error) {
      return { result: false, error: data.error };
    }

    this.projects = this.#refreshProjects();
    return { result: true };
  }

  createBlank(url: URL): Promise<{ result: boolean; error?: string }> {
    return this.save(url, blank());
  }

  async create(
    url: URL,
    descriptor: GraphDescriptor
  ): Promise<{ result: boolean; error?: string }> {
    return this.save(url, descriptor);
  }

  async delete(url: URL): Promise<{ result: boolean; error?: string }> {
    if (!this.canProvide(url)) {
      return { result: false };
    }

    try {
      const request = createRequest(url, await this.connectionArgs(), "POST", {
        delete: true,
      });
      const response = await fetch(request);
      const data = await response.json();
      this.projects = this.#refreshProjects();

      if (data.error) {
        return { result: false };
      }
      return { result: true };
    } catch (err) {
      return { result: true };
    }
  }

  connect(_location?: string, _auth?: unknown): Promise<boolean> {
    throw new Error("Method not implemented.");
  }

  disconnect(_location: string): Promise<boolean> {
    throw new Error("Method not implemented.");
  }

  async refresh(_location: string): Promise<boolean> {
    await this.projects;
    return true;
  }

  async createURL(location: string, fileName: string): Promise<string | null> {
    // Ensure we don't have a trailing slash on the location so that the URLs
    // we create below work out.
    location = location.replace(/\/$/, "");

    const request = createRequest(
      `${location}/boards`,
      await this.connectionArgs(),
      "POST",
      {
        name: fileName,
      }
    );
    const response = await fetch(request);
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    return `${location}/boards/${data.path}`;
  }

  parseURL(_url: URL): { location: string; fileName: string } {
    throw new Error("Method not implemented.");
  }

  async restore(): Promise<void> {
    await this.projects;
  }

  items(): Map<string, GraphProviderStore> {
    const items = new Map<string, GraphProviderStore>();
    const projects: [string, GraphProviderItem][] = [];
    const toFullURL = (thumbnail: string | null, base: string) => {
      if (!thumbnail) {
        return null;
      }

      if (thumbnail.startsWith(".")) {
        return new URL(thumbnail, base).href;
      }

      return thumbnail;
    };

    const projectNames = new Set<string>();
    for (const project of this.#projects) {
      const title = project.metadata.title ?? "Untitled Flow";
      projectNames.add(title);
      projects.push([
        project.url.href,
        {
          url: project.url.href,
          mine: project.metadata.owner === this.user.username,
          version: project.board?.descriptor.version,
          description: project.metadata.description,
          readonly: false,
          handle: null,
          tags: project.metadata?.tags,
          username: project.metadata.owner,
          thumbnail: toFullURL(
            project.metadata.thumbnail ?? null,
            project.url.href
          ),
          title,
        },
      ]);
    }

    items.set(this.url.href, {
      items: new Map(projects),
      permission: "granted",
      title: this.name,
      url: this.url.href,
    });

    return items;
  }

  startingURL(): URL | null {
    return null;
  }

  watch(_callback: ChangeNotificationCallback): void {
    throw new Error("Method not implemented.");
  }

  async preview(url: URL): Promise<URL> {
    return new URL(
      url.href.replace(
        `${this.url.origin}/board/boards`,
        `${this.url.origin}/app`
      )
    );
  }

  async #sendToRemote(url: URL, descriptor: GraphDescriptor) {
    if (!this.user.apiKey && !this.tokenVendor) {
      return { error: "Can't connect to the server without credentials" };
    }
    const request = createRequest(
      url,
      await this.connectionArgs(),
      "POST",
      descriptor
    );
    try {
      const response = await fetch(request);
      return await response.json();
    } catch (e) {
      return { error: `Error updating board: ${(e as Error).message}` };
    }
  }

  async #refreshProjects(): Promise<BoardServerProject[]> {
    type BoardServerListingItem = GraphProviderItem & {
      path: string;
    };

    const projects: BoardServerProject[] = [];
    try {
      const request = await this.createRequest("boards", "GET");

      const response = await fetch(request);
      if (!response.ok) {
        return projects;
      }
      const files: BoardServerListingItem[] = await response.json();

      for (const item of files) {
        // Workaround for the fact that we don't yet store the username as part
        // of the Board Server configuration. Here we use the `mine` property to
        // set the username.
        if (item.mine && item.username) {
          this.user.username = item.username;
        }

        const canAccess = item.username === this.user.username;
        const access = new Map([
          [
            this.user.username,
            {
              create: canAccess,
              retrieve: canAccess,
              update: canAccess,
              delete: canAccess,
            },
          ],
        ]);

        const project: BoardServerProject = {
          url: new URL(`boards/${item.path}`, this.url),
          metadata: {
            owner: item.username ?? "Unknown",
            tags: item.tags,
            title: item.title,
            description: item.description,
            thumbnail: item.thumbnail ?? undefined,
            access,
          },
        };

        projects.push(project);
      }
    } catch (err) {
      console.warn(
        `[Remote Board Server]: Unable to connect to "${this.url}"`,
        err
      );
    }

    this.#refreshBoardServerKits(projects);
    return projects;
  }

  async #refreshBoardServerKits(projects: BoardServerProject[]) {
    if (!projects.length) {
      return;
    }

    const kits = new Map<string, NodeIdentifier[]>();

    for (let idx = 0; idx < projects.length; idx++) {
      const project = projects[idx];
      if (!project.url) {
        continue;
      }

      // const id = `node-${globalThis.crypto.randomUUID()}`;
      const type = project.url.href;
      const owner = project.metadata.owner;
      if (
        !project.metadata?.tags ||
        !(
          project.metadata?.tags.includes("component") ||
          project.metadata?.tags.includes("connector")
        )
      ) {
        continue;
      }

      let nodes: NodeIdentifier[] | undefined = kits.get(owner);
      if (!nodes) {
        nodes = [];
        kits.set(owner, nodes);
      }
      nodes.push(type);
    }

    for (const [owner, nodes] of kits.entries()) {
      const title = `@${owner}'s Components`;
      const url = new URL(`kits/@${owner}/all`, this.url).href;
      this.kits = this.kits.filter((kit) => kit.title !== title);
      this.kits.push({
        title,
        url,
        handlers: Object.fromEntries(
          nodes.map((node) => [
            node,
            () => {
              throw new Error(
                `Integrity error: "${title}" kit's node handlers should never be called`
              );
            },
          ])
        ),
      });
    }
  }

  async canProxy(url: URL): Promise<string | false> {
    if (!this.canProvide(url)) {
      return false;
    }

    return this.#withKey("proxy").href;
  }

  async connectionArgs(): Promise<ConnectionArgs> {
    const key = this.user.apiKey;
    if (key) {
      return { key };
    }
    const token = await getSigninToken(this.tokenVendor);
    return { token };
  }

  #withKey(path: string): URL {
    const result = new URL(path, this.url);
    const key = this.user.apiKey;
    if (key) {
      result.searchParams.set("API_KEY", key);
    }
    return result;
  }

  async createRequest(
    path: string,
    method: string,
    body?: unknown
  ): Promise<Request> {
    return createRequest(
      new URL(path, this.url),
      await this.connectionArgs(),
      method,
      body
    );
  }

  dataPartTransformer(graphUrl: URL): DataPartTransformer {
    return new RemotePartTransformer(this, graphUrl);
  }
}
