/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  BoardServer,
  BoardServerExtension,
  BoardServerExtensionNamespace,
  createLoader,
  EditHistoryCreator,
  EditHistoryEntry,
  GraphDescriptor,
  GraphLoader,
  GraphProvider,
  InspectableGraph,
  InspectableRunObserver,
  isLLMContentArray,
  isStoredData,
  Kit,
  MutableGraphStore,
} from "@google-labs/breadboard";
import { RuntimeConfigBoardServers, Tab, TabId, TabType } from "./types";
import {
  RuntimeHostAPIEvent,
  RuntimeBoardLoadErrorEvent,
  RuntimeErrorEvent,
  RuntimeTabChangeEvent,
  RuntimeTabCloseEvent,
  RuntimeBoardServerChangeEvent,
  RuntimeWorkspaceItemChangeEvent,
} from "./events";
import * as BreadboardUI from "@breadboard-ai/shared-ui";
import {
  connectToBoardServer,
  disconnectFromBoardServer,
  getBoardServers,
} from "@breadboard-ai/board-server-management";
import { TokenVendor } from "@breadboard-ai/connection-client";
import {
  GraphIdentifier,
  GraphTheme,
  ModuleIdentifier,
  NodeDescriptor,
} from "@breadboard-ai/types";
import * as idb from "idb";

const documentStyles = getComputedStyle(document.documentElement);

type ValidColorStrings = `#${string}` | `--${string}`;

const USER_REGEX = /\/@[^/]+\//;

const LOCAL_REVISION_HISTORY_KEY = "revision-history";
const LOCAL_REVISION_HISTORY_VERSION = 1;
interface LocalRevisionHistoryDBSchema extends idb.DBSchema {
  revisions: {
    key: string;
    value: EditHistoryEntry[];
  };
}

export function getGlobalColor(
  name: ValidColorStrings,
  defaultValue: ValidColorStrings = "#333333"
) {
  const value = documentStyles.getPropertyValue(name)?.replace(/^#/, "");
  const valueAsNumber = parseInt(value || defaultValue, 16);
  if (Number.isNaN(valueAsNumber)) {
    return 0xff00ff;
  }
  return valueAsNumber;
}

export class Board extends EventTarget {
  #tabs = new Map<TabId, Tab>();
  #currentTabId: TabId | null = null;

  constructor(
    /** @deprecated */
    private readonly providers: GraphProvider[],
    private readonly loader: GraphLoader,
    /**
     * Extra Kits, supplied by the board server.
     * */
    private readonly boardServerKits: Kit[],
    private readonly boardServers: RuntimeConfigBoardServers,
    private readonly tokenVendor?: TokenVendor
  ) {
    super();
  }

  #canParse(url: string, base?: string) {
    // TypeScript assumes that if `canParse` does not exist, then URL is
    // `never`. However, in older browsers that's not true. We therefore take a
    // temporary copy of the URL constructor here.
    const UrlCtor = URL;
    if ("canParse" in URL) {
      return URL.canParse(url, base);
    }

    try {
      new UrlCtor(url, base);
      return true;
    } catch (err) {
      return false;
    }
  }

  #makeRelativeToCurrentBoard(
    boardUrl: string | null,
    currentUrl: string | null
  ) {
    // An inability to parse the URL below likely means it's an example board,
    // which doesn't carry a protocol, etc. In such cases we just return the
    // URL as-is.
    if (boardUrl && this.#canParse(boardUrl)) {
      if (currentUrl) {
        try {
          const base = new URL(currentUrl);
          const newUrl = new URL(boardUrl, base);
          return newUrl.href;
        } catch (e) {
          console.warn("Unable to parse URL from current board: ", currentUrl);
        }
      }
    }
    return boardUrl;
  }

  async connect(
    location?: string,
    apiKey?: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.tokenVendor) {
      return { success: false, error: "Can't connect without a token vendor" };
    }

    const boardServerInfo = await connectToBoardServer(
      location,
      apiKey,
      this.tokenVendor
    );
    if (!boardServerInfo) {
      this.dispatchEvent(
        new RuntimeErrorEvent("Unable to connect to Board Server")
      );

      // We return true here because we don't need the toast from the Visual
      // Editor. Instead we use the above RuntimeErrorEvent to ensure that
      // the user is notified.
      return { success: false };
    } else {
      this.boardServers.servers = [
        ...(await getBoardServers(this.tokenVendor)),
        ...this.boardServers.builtInBoardServers,
      ];
      this.boardServers.loader = createLoader(this.boardServers.servers);
      this.dispatchEvent(
        new RuntimeBoardServerChangeEvent(
          boardServerInfo.title,
          boardServerInfo.url
        )
      );
      return { success: true };
    }

    return { success: false };
  }

  async disconnect(location: string) {
    const success = await disconnectFromBoardServer(location);
    if (!success) {
      this.dispatchEvent(
        new RuntimeErrorEvent("Unable to disconnect from Board Server")
      );

      // We return true here because we don't need the toast from the Visual
      // Editor. Instead we use the above RuntimeErrorEvent to ensure that
      // the user is notified.
      return { success: false };
    }
    this.boardServers.servers = [
      ...(await getBoardServers(this.tokenVendor)),
      ...this.boardServers.builtInBoardServers,
    ];
    this.boardServers.loader = createLoader(this.boardServers.servers);
    this.dispatchEvent(new RuntimeBoardServerChangeEvent());
  }

  getBoardServerByName(name: string) {
    return (
      this.boardServers.servers.find((server) => server.name === name) || null
    );
  }

  /**
   * @deprecated Use getBoardServerByName instead.
   */
  getProviderByName(name: string) {
    return this.providers.find((provider) => provider.name === name) || null;
  }

  /**
   * @deprecated Use getBoardServerForURL instead.
   */
  getProviderForURL(url: URL) {
    return this.providers.find((provider) => provider.canProvide(url)) || null;
  }

  getBoardServerForURL(url: URL) {
    return (
      this.boardServers.servers.find((server) => server.canProvide(url)) || null
    );
  }

  getBoardServers(): BoardServer[] {
    return this.boardServers.servers;
  }

  /**
   *
   * @deprecated Use getBoardServers() instead.
   */
  getProviders(): GraphProvider[] {
    console.warn("getProviders is deprecated - use getBoardServers instead.");
    return this.providers;
  }

  getLoader(): GraphLoader {
    return this.boardServers.loader;
  }

  getGraphStore(): MutableGraphStore {
    return this.boardServers.graphStore;
  }

  get tabs() {
    return this.#tabs;
  }

  get currentTab(): Tab | null {
    if (!this.#currentTabId) {
      return null;
    }

    return this.#tabs.get(this.#currentTabId) ?? null;
  }

  getTabById(tab: TabId): Tab | null {
    return this.#tabs.get(tab) ?? null;
  }

  createURLFromTabs() {
    const params = new URLSearchParams();
    let t = 0;
    let activeTab = 0;
    for (const tab of this.#tabs.values()) {
      if (tab.type !== TabType.URL || !tab.graph.url) {
        continue;
      }

      if (tab.id === this.#currentTabId) {
        activeTab = t;
      }

      if (tab.moduleId) {
        params.set(`subitem-i-id${t}`, tab.moduleId);
      }

      if (tab.subGraphId) {
        params.set(`subitem-d-id${t}`, tab.subGraphId);
      }

      params.set(`tab${t++}`, tab.graph.url);
    }

    params.set(`activeTab`, activeTab.toString());

    const url = new URL(window.location.href);
    url.search = params.toString();
    return url;
  }

  getTabURLs(): string[] {
    return [...this.#tabs.values()]
      .filter((tab) => tab.graph.url !== undefined)
      .map((tab) => tab.graph.url as string);
  }

  async createTabsFromURL(url: URL) {
    const params = new URLSearchParams(url.search);

    let t = 0;
    const board = params.get("board");
    if (board) {
      params.set(`tab${t++}`, board);
      params.delete("board");
    }

    const tabs = [...params]
      .filter((param) => param[0].startsWith("tab"))
      .sort(([idA], [idB]) => {
        if (idA > idB) return 1;
        if (idA < idB) return -1;
        return 0;
      });

    let activeTab: number | null = null;
    const activeTabParam = params.get("activeTab");
    if (activeTabParam) {
      activeTab = Number.parseInt(activeTabParam);
      if (Number.isNaN(activeTab)) {
        activeTab = null;
      }
    }

    let activeTabId: TabId | null = null;
    if (tabs.length > 0) {
      for (let t = 0; t < tabs.length; t++) {
        const [, tab] = tabs[t];
        if (tab.startsWith("run://") || tab.startsWith("descriptor://")) {
          continue;
        }

        let moduleId: ModuleIdentifier | null = null;
        const moduleIdParam = params.get(`subitem-i-id${t}`);
        if (moduleIdParam) {
          moduleId = moduleIdParam;
        }

        let subGraphId: GraphIdentifier | null = null;
        const subGraphIdParam = params.get(`subitem-d-id${t}`);
        if (subGraphIdParam) {
          subGraphId = subGraphIdParam;
        }

        await this.createTabFromURL(
          tab,
          url.href,
          true,
          false,
          false,
          moduleId,
          subGraphId
        );

        // Capture the current tab ID so we can restore it after creating all
        // the tabs again.
        if (t === activeTab) {
          activeTabId = this.#currentTabId;
        }
      }

      if (activeTabId && this.#currentTabId !== activeTabId) {
        this.#currentTabId = activeTabId;
      }
    }

    this.dispatchEvent(new RuntimeTabChangeEvent());
  }

  async #toDigest(descriptor: GraphDescriptor) {
    const graph = structuredClone(descriptor);
    delete graph.url;

    const str = JSON.stringify(graph, null, 2);
    const encoder = new TextEncoder();
    const bytes = encoder.encode(str);

    const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(digest)]
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("");
  }

  async #toSVGPreview(descriptor: GraphDescriptor): Promise<string | null> {
    const PADDING = 10;
    const PREVIEW_WIDTH = 250 - 2 * PADDING;
    const PREVIEW_HEIGHT = 200 - 2 * PADDING;
    const NODE_WIDTH = 260;
    const NODE_ASSUMED_HEIGHT = 100;

    const graphStore = this.getGraphStore();

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    const updateDimensions = (node: NodeDescriptor) => {
      if (!node.metadata?.visual) {
        return;
      }

      const visual = node.metadata?.visual as {
        x: number;
        y: number;
        outputHeight: number;
      };
      minX = Math.min(minX, visual.x);
      minY = Math.min(minY, visual.y);
      maxX = Math.max(maxX, visual.x + NODE_WIDTH);
      maxY = Math.max(
        maxY,
        visual.y + NODE_ASSUMED_HEIGHT + (visual.outputHeight ?? 0)
      );
    };

    // Main Graph.
    for (const node of descriptor.nodes) {
      updateDimensions(node);
    }

    // Sub Graphs.
    for (const graph of Object.values(descriptor.graphs ?? {})) {
      for (const node of graph.nodes) {
        updateDimensions(node);
      }
    }

    if (
      !Number.isFinite(minX) ||
      !Number.isFinite(minY) ||
      !Number.isFinite(maxX) ||
      !Number.isFinite(maxY)
    ) {
      return null;
    }

    const width = maxX - minX;
    const height = maxY - minY;

    const ratio = Math.min(PREVIEW_WIDTH / width, PREVIEW_HEIGHT / height);

    const paddingX = (PREVIEW_WIDTH - width * ratio) * 0.5;
    const paddingY = (PREVIEW_HEIGHT - height * ratio) * 0.5;

    const renderNode = (
      node: NodeDescriptor,
      inspectableGraph: InspectableGraph | null = null
    ) => {
      if (!node.metadata?.visual) {
        return "";
      }

      const visual = node.metadata?.visual as {
        x: number;
        y: number;
        outputHeight: number;
      };

      const x = PADDING + paddingX + (visual.x - minX) * ratio;
      const y = PADDING + paddingY + (visual.y - minY) * ratio;
      const w = NODE_WIDTH * ratio;
      const h = (NODE_ASSUMED_HEIGHT + (visual.outputHeight ?? 0)) * ratio;

      let c = 0;
      if (inspectableGraph) {
        const inspectableNode = inspectableGraph.nodeById(node.id);
        const icon =
          inspectableNode?.type().currentMetadata().icon ??
          inspectableNode?.type().type() ??
          null;

        switch (icon) {
          case "text":
          case "combine-outputs":
          case "input":
          case "output": {
            c = getGlobalColor("--bb-input-600");
            break;
          }

          case "generative":
          case "generative-image":
          case "generative-text":
          case "generative-audio":
          case "generative-code": {
            c = getGlobalColor("--bb-generative-600");
            break;
          }

          default: {
            c = getGlobalColor("--bb-ui-600");
            break;
          }
        }
      }

      return `<rect x="${x.toFixed(2)}"
                    y="${y.toFixed(2)}"
                    width="${w.toFixed(2)}"
                    height="${h.toFixed(2)}"
                    rx="3.5"
                    fill="white"
                    stroke="#${c.toString(16).padStart(6, "0")}" />`;
    };

    let inspectableGraph: InspectableGraph | null = null;
    const mainGraphIdResult = graphStore.getByDescriptor(descriptor);
    const boardSvg = `<svg width="250" height="200" viewBox="0 0 250 200" fill="none" xmlns="http://www.w3.org/2000/svg">
    ${descriptor.nodes
      .map((node) => {
        if (mainGraphIdResult.success) {
          inspectableGraph =
            graphStore.inspect(mainGraphIdResult.result, "") ?? null;
        }

        return renderNode(node, inspectableGraph);
      })
      .join("\n")}
      ${Object.entries(descriptor.graphs ?? {})
        .map(([id, graph]) => {
          inspectableGraph = null;
          if (mainGraphIdResult.success) {
            inspectableGraph =
              graphStore.inspect(mainGraphIdResult.result, id) ?? null;
          }

          return graph.nodes
            .map((node) => {
              return renderNode(node, inspectableGraph);
            })
            .join("\n");
        })
        .join("\n")}
    </svg>`;

    return `data:image/svg+xml;base64,${btoa(boardSvg)}`;
  }

  async createTabFromRun(
    descriptor: GraphDescriptor,
    topGraphObserver?: BreadboardUI.Utils.TopGraphObserver,
    runObserver?: InspectableRunObserver,
    readOnly = true
  ) {
    const descriptorUrl = await this.#toDigest(descriptor);
    descriptor.url = `run://${descriptorUrl}`;

    for (const [id, tab] of this.#tabs) {
      if (tab.graph.url !== descriptor.url) {
        continue;
      }

      this.#currentTabId = id;
      this.dispatchEvent(new RuntimeTabChangeEvent());
      return;
    }

    const moduleId = descriptor.main || null;

    const id = globalThis.crypto.randomUUID();
    const mainGraphId = this.getGraphStore().addByDescriptor(descriptor);
    if (!mainGraphId.success) {
      throw new Error(`Unable to add graph: ${mainGraphId.error}`);
    }
    this.#tabs.set(id, {
      id,
      boardServerKits: this.boardServerKits,
      name: descriptor.title ?? "Untitled board",
      mainGraphId: mainGraphId.result,
      graph: descriptor,
      subGraphId: null,
      moduleId,
      version: 1,
      type: TabType.DESCRIPTOR,
      readOnly,
    });

    // No chat controller when loading from run.
    // TODO: Implement loading chat history here.
    const chatController = undefined;

    this.#currentTabId = id;
    this.dispatchEvent(
      new RuntimeTabChangeEvent(topGraphObserver, runObserver, chatController)
    );
  }

  async createTabFromDescriptor(
    descriptor: GraphDescriptor,
    createNewTab = false,
    dispatchTabChangeEvent = true
  ) {
    const descriptorUrl = await this.#toDigest(descriptor);
    descriptor.url = `descriptor://${descriptorUrl}`;

    // Re-use an existing tab if possible.
    if (!createNewTab) {
      for (const [id, tab] of this.#tabs) {
        if (tab.graph.url !== descriptor.url) {
          continue;
        }

        this.#currentTabId = id;
        this.dispatchEvent(new RuntimeTabChangeEvent());
        return;
      }
    }

    const moduleId = descriptor.main || null;

    const id = globalThis.crypto.randomUUID();
    const mainGraphId = this.getGraphStore().addByDescriptor(descriptor);
    if (!mainGraphId.success) {
      throw new Error(`Unable to add graph: ${mainGraphId.error}`);
    }
    this.#tabs.set(id, {
      id,
      boardServerKits: this.boardServerKits,
      name: descriptor.title ?? "Untitled board",
      graph: descriptor,
      mainGraphId: mainGraphId.result,
      subGraphId: null,
      moduleId,
      version: 1,
      type: TabType.DESCRIPTOR,
      readOnly: false,
    });

    this.#currentTabId = id;
    if (!dispatchTabChangeEvent) {
      return;
    }

    this.dispatchEvent(new RuntimeTabChangeEvent());
  }

  /**
   * Here for now, but needs to be removed when all legacy theme information has
   * been handled.
   *
   * @deprecated
   */
  #migrateThemeInformationIfPresent(graph: GraphDescriptor) {
    // Already migrated.
    if (
      graph.metadata?.visual?.presentation?.themes &&
      graph.metadata?.visual?.presentation?.theme
    ) {
      return;
    }

    // No legacy theme info available - fit out the default theme.
    if (!graph.metadata?.visual?.presentation?.themeColors) {
      graph.metadata ??= {};
      graph.metadata.visual ??= {};
      graph.metadata.visual.presentation ??= {};
      graph.metadata.visual.presentation.themes ??= {};

      const graphTheme: GraphTheme = {
        themeColors: {
          primaryColor: "#246db5",
          secondaryColor: "#5cadff",
          backgroundColor: "#ffffff",
          textColor: "#1a1a1a",
          primaryTextColor: "#ffffff",
        },
        template: "basic",
        splashScreen: {
          storedData: {
            handle: "/images/app/generic-flow.jpg",
            mimeType: "image/jpeg",
          },
        },
      };

      const themeId = globalThis.crypto.randomUUID();
      graph.metadata.visual.presentation.themes[themeId] = graphTheme;
      graph.metadata.visual.presentation.theme = themeId;
      return;
    }

    const { themeColors, template, templateAdditionalOptions } =
      graph.metadata.visual.presentation;
    const graphTheme: GraphTheme = {
      themeColors,
      templateAdditionalOptions,
      template,
    };

    const splashScreen = graph.assets?.["@@splash"];
    if (
      isLLMContentArray(splashScreen?.data) &&
      isStoredData(splashScreen.data[0]?.parts[0])
    ) {
      graphTheme.splashScreen = splashScreen.data[0].parts[0];
    }

    graph.metadata.visual.presentation.themes ??= {};

    // Set the theme.
    const themeId = globalThis.crypto.randomUUID();
    graph.metadata.visual.presentation.themes[themeId] = graphTheme;
    graph.metadata.visual.presentation.theme = themeId;

    // Remove the legacy values.
    delete graph.metadata.visual.presentation.template;
    delete graph.metadata.visual.presentation.templateAdditionalOptions;
    delete graph.metadata.visual.presentation.themeColors;
  }

  async createTabFromURL(
    boardUrl: string,
    currentUrl: string | null = null,
    createNewTab = false,
    readOnly = false,
    dispatchTabChangeEvent = true,
    moduleId: ModuleIdentifier | null = null,
    subGraphId: GraphIdentifier | null = null,
    creator: EditHistoryCreator | null = null
  ) {
    let url = this.#makeRelativeToCurrentBoard(boardUrl, currentUrl);

    // Redirect older /graphs examples to /example-boards
    if (url?.startsWith("/graphs")) {
      url = url.replace(/^\/graphs/, "/example-boards");
    }

    // Match any older URLs like /example-boards/blank.json and redirect to the
    // newer /example-boards/playground/blank.json
    const pgRegex = /example-boards\/([^\\/]+.json)$/;
    const matches = pgRegex.exec(boardUrl ?? "");
    if (url && matches && matches.length === 2) {
      url = `/example-boards/playground/${matches[1]}`;
    }

    if (!url) {
      return;
    }

    try {
      const base = new URL(window.location.href);

      let kits = this.boardServerKits;
      let graph: GraphDescriptor | null = null;
      if (this.#canParse(url, base.href)) {
        const boardServer = this.getBoardServerForURL(new URL(url, base));
        if (boardServer) {
          // Ensure the the provider has actually loaded fully before
          // requesting the graph file from it.
          await boardServer.ready();
        }
        if (boardServer && this.boardServers) {
          kits = (boardServer as BoardServer).kits ?? this.boardServerKits;
          const loadResult = await this.boardServers.loader.load(url, { base });
          graph = loadResult.success ? loadResult.graph : null;
        } else {
          const loadResult = await this.loader.load(url, { base });
          graph = loadResult.success ? loadResult.graph : null;
        }
      }

      // Re-use an existing tab if possible.
      if (!createNewTab) {
        for (const [id, tab] of this.#tabs) {
          if (tab.graph.url !== boardUrl) {
            continue;
          }

          this.#currentTabId = id;
          this.dispatchEvent(new RuntimeTabChangeEvent());
          return;
        }
      }

      if (!graph) {
        this.dispatchEvent(new RuntimeErrorEvent("Unable to load board"));
        return;
      }

      // Check to see if this is an imperative grpah
      if (graph.main && !moduleId) {
        moduleId = graph.main;
      }

      // Confirm the module exists before setting it.
      if (moduleId && (!graph.modules || !graph.modules[moduleId])) {
        moduleId = null;
      }

      if (subGraphId && (!graph.graphs || !graph.graphs[subGraphId])) {
        subGraphId = null;
      }

      if (graph.graphs?.["Main board"]) {
        graph.graphs[globalThis.crypto.randomUUID()] =
          graph.graphs?.["Main board"];
        delete graph.graphs?.["Main board"];
      }

      this.#migrateThemeInformationIfPresent(graph);

      // This is not elegant, since we actually load the graph by URL,
      // and we should know this mainGraphId by now.
      // TODO: Make this more elegant.
      const mainGraphId = this.getGraphStore().addByDescriptor(graph);
      if (!mainGraphId.success) {
        throw new Error(`Unable to add graph: ${mainGraphId.error}`);
      }
      const id = globalThis.crypto.randomUUID();
      this.#tabs.set(id, {
        id,
        boardServerKits: kits,
        name: graph.title ?? "Untitled board",
        graph,
        mainGraphId: mainGraphId.result,
        subGraphId,
        moduleId,
        type: TabType.URL,
        version: 1,
        readOnly,
        creator: creator ?? undefined,
        history: await this.#loadLocalHistory(url),
        onHistoryChanged: (history) => this.#saveLocalHistory(url, history),
      });

      this.#currentTabId = id;

      // When we create multiple tabs at once we dispatch the event elsewhere,
      // which means we don't want to do it here.
      if (!dispatchTabChangeEvent) {
        return;
      }

      this.dispatchEvent(new RuntimeTabChangeEvent());
    } catch (err) {
      console.warn(err);
      this.dispatchEvent(new RuntimeBoardLoadErrorEvent());
    }
  }

  changeTab(id: TabId) {
    if (!this.#tabs.has(id)) {
      return;
    }

    this.#currentTabId = id;
    this.dispatchEvent(new RuntimeTabChangeEvent());
  }

  changeWorkspaceItem(
    id: TabId,
    subGraphId: GraphIdentifier | null,
    moduleId: ModuleIdentifier | null
  ) {
    const tab = this.#tabs.get(id);
    if (!tab) {
      return;
    }

    if (subGraphId && moduleId) {
      console.error("Unable to select both a subgraph and module");
      return;
    }

    tab.subGraphId = subGraphId;
    tab.moduleId = moduleId;

    this.dispatchEvent(new RuntimeWorkspaceItemChangeEvent());
  }

  closeTab(id: TabId) {
    let nextTab = null;

    const tabList = [...this.#tabs.keys()];
    for (let t = 0; t < tabList.length; t++) {
      if (tabList[t] !== id) {
        continue;
      }

      if (t === 0 && tabList.length > 1) {
        nextTab = tabList[t + 1];
        break;
      }

      if (t > 0) {
        nextTab = tabList[t - 1];
        break;
      }
    }

    this.#tabs.delete(id);
    this.dispatchEvent(new RuntimeTabCloseEvent(id));

    if (id !== this.#currentTabId) {
      return;
    }

    this.#currentTabId = nextTab;
    this.dispatchEvent(new RuntimeTabChangeEvent());
  }

  canSave(id: TabId | null): boolean {
    if (!id) {
      return false;
    }

    const tab = this.#tabs.get(id);
    if (!tab) {
      return false;
    }

    if (!tab.graph || !tab.graph.url) {
      return false;
    }

    const boardUrl = new URL(tab.graph.url);
    const boardServer = this.getBoardServerForURL(boardUrl);
    if (!boardServer) {
      return false;
    }

    const capabilities = boardServer.canProvide(boardUrl);
    if (!capabilities || !capabilities.save) {
      return false;
    }

    for (const store of boardServer.items().values()) {
      for (const item of store.items.values()) {
        if (item.url !== tab.graph.url && item.url.replace(USER_REGEX, "/") !== tab.graph.url) {
          continue;
        }

        return item.mine && !item.readonly;
      }
    }

    return false;
  }

  canPreview(id: TabId | null): boolean {
    if (!id) {
      return false;
    }

    const tab = this.#tabs.get(id);
    if (!tab) {
      return false;
    }

    if (!tab.graph || !tab.graph.url) {
      return false;
    }

    const boardUrl = new URL(tab.graph.url);
    const boardServer = this.getBoardServerForURL(boardUrl);
    if (!boardServer) {
      return false;
    }

    return boardServer.capabilities.preview;
  }

  async save(id: TabId | null) {
    if (!id) {
      return { result: false, error: "Unable to save" };
    }

    const tab = this.#tabs.get(id);
    if (!tab) {
      return { result: false, error: "Unable to save" };
    }

    if (!tab.graph || !tab.graph.url) {
      return { result: false, error: "Unable to save" };
    }

    const boardUrl = new URL(tab.graph.url);
    const boardServer = this.getBoardServerForURL(boardUrl);
    if (!boardServer) {
      return { result: false, error: "Unable to save" };
    }

    const capabilities = boardServer.canProvide(boardUrl);
    if (!capabilities || !capabilities.save) {
      return { result: false, error: "Unable to save" };
    }

    const preview = await this.#toSVGPreview(tab.graph);
    if (preview) {
      tab.graph.assets ??= {};
      tab.graph.assets["@@thumbnail"] = {
        metadata: {
          title: "Thumbnail",
          type: "file",
        },
        data: preview,
      };
    }

    return boardServer.save(boardUrl, tab.graph);
  }

  async saveAs(
    boardServerName: string,
    location: string,
    fileName: string,
    graph: GraphDescriptor
  ) {
    const fail = { result: false, error: "Unable to save", url: undefined };
    const boardServer = this.getBoardServerByName(boardServerName);
    if (!boardServer) {
      return fail;
    }

    const urlString = await boardServer.createURL(location, fileName);
    if (!urlString) {
      return fail;
    }

    let url = new URL(urlString);
    const response = await boardServer.create(url, graph);
    if (response.url) {
      url = new URL(response.url);
    }

    return { ...response, url };
  }

  async delete(providerName: string, url: string) {
    const fail = { result: false, error: "Unable to delete" };
    const boardServer = this.getBoardServerByName(providerName);
    if (!boardServer) {
      return fail;
    }

    return await boardServer.delete(new URL(url));
  }

  async extensionAction<T extends BoardServerExtensionNamespace>(
    id: TabId | null,
    namespace: T,
    action: keyof BoardServerExtension[T],
    ...args: unknown[]
  ) {
    if (!id) {
      return;
    }

    const tab = this.#tabs.get(id);
    if (!tab) {
      return;
    }

    switch (namespace) {
      case "node": {
        switch (action) {
          case "onSelect": {
            // id: NodeIdentifier,
            // type: string,
            // configuration: NodeConfiguration
            const node = tab.graph.nodes.find((node) => node.id === args[0]);
            const comment = tab.graph.metadata?.comments?.find(
              (comment) => comment.id === args[0]
            );
            args = [
              ...args,
              node ? node.type : comment ? "comment" : "unknown",
              node ? node.configuration : comment ? comment.text : {},
            ];
            break;
          }

          case "onDeselect": {
            // Noop.
            break;
          }

          case "onAction": {
            // action: string,
            // kits: Kit[],
            // id: NodeIdentifier,
            // type: string,
            // configuration: NodeConfiguration
            const node = tab.graph.nodes.find((node) => node.id === args[0]);
            const comment = tab.graph.metadata?.comments?.find(
              (comment) => comment.id === args[0]
            );
            args = [
              "replaceContent",
              tab.boardServerKits,
              ...args,
              node ? node.type : comment ? "comment" : "unknown",
              node ? node.configuration : comment ? comment.text : {},
            ];
            break;
          }
        }
      }
    }

    // API.
    const dispatchEvent = this.dispatchEvent.bind(this);
    args.unshift({
      async send(method: string, args: unknown[]) {
        dispatchEvent(new RuntimeHostAPIEvent(tab, method, args));
      },
    });

    return this.#handleExtensionAction(tab, namespace, action, ...args);
  }

  async #handleExtensionAction<T extends BoardServerExtensionNamespace>(
    tab: Tab,
    namespace: T,
    action: keyof BoardServerExtension[T],
    ...args: unknown[]
  ) {
    if (!tab.graph || !tab.graph.url) {
      return;
    }

    const boardUrl = new URL(tab.graph.url);
    const boardServer = this.getBoardServerForURL(boardUrl);
    if (!boardServer) {
      return;
    }

    for (const extension of boardServer.extensions) {
      const ns = extension[namespace];
      if (ns && ns[action]) {
        if (typeof ns[action] !== "function") {
          continue;
        }

        await ns[action].call(null, ...args);
      }
    }
  }

  async #loadLocalHistory(url: string): Promise<EditHistoryEntry[]> {
    const db = await this.#openLocalHistoryDB();
    const revisions = (await db.get("revisions", url)) ?? [];
    db.close();
    return revisions;
  }

  async #saveLocalHistory(
    url: string,
    history: readonly EditHistoryEntry[]
  ): Promise<void> {
    const db = await this.#openLocalHistoryDB();
    await db.put("revisions", history as EditHistoryEntry[], url);
    db.close();
  }

  async #openLocalHistoryDB() {
    return await idb.openDB<LocalRevisionHistoryDBSchema>(
      LOCAL_REVISION_HISTORY_KEY,
      LOCAL_REVISION_HISTORY_VERSION,
      {
        upgrade(db) {
          if (!db.objectStoreNames.contains("revisions")) {
            db.createObjectStore("revisions");
          }
        },
      }
    );
  }
}
