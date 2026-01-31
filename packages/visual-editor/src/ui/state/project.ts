/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AssetPath,
  GraphIdentifier,
  HarnessRunner,
  InspectableNodePorts,
  LLMContent,
  NodeIdentifier,
} from "@breadboard-ai/types";
import {
  EditableGraph,
  EditSpec,
  EditTransform,
  FileSystem,
  MainGraphIdentifier,
  MutableGraph,
  NodeHandlerMetadata,
  Outcome,
  PortIdentifier,
} from "@breadboard-ai/types";
import { signal } from "signal-utils";
import { SignalMap } from "signal-utils/map";

import { GraphAssetImpl } from "./graph-asset.js";
import { ReactiveOrganizer } from "./organizer.js";
import { ReactiveProjectRun } from "./project-run.js";
import { RendererStateImpl } from "./renderer.js";
import {
  Component,
  GraphAsset,
  Integrations,
  Organizer,
  Project,
  ProjectInternal,
  ProjectRun,
  ProjectThemeState,
  ProjectValues,
  RendererState,
  StepEditor,
  Tool,
} from "./types.js";
import { IntegrationsImpl } from "./integrations.js";
import { updateMap } from "./utils/update-map.js";
import { McpClientManager } from "../../mcp/index.js";
import { A2_TOOLS } from "../../a2/a2-registry.js";
import { StepEditorImpl } from "./step-editor.js";
import { ThemeState } from "./theme-state.js";
import { err, ok } from "@breadboard-ai/utils";
import { transformDataParts } from "../../data/common.js";
import { GoogleDriveBoardServer } from "../../board-server/server.js";
import { ActionTracker } from "../types/types.js";
import { Signal } from "signal-polyfill";

export { createProjectState, ReactiveProject };

const THUMBNAIL_KEY = "@@thumbnail";

function createProjectState(
  mainGraphId: MainGraphIdentifier,
  mutable: MutableGraph,
  fetchWithCreds: typeof globalThis.fetch,
  boardServer: GoogleDriveBoardServer,
  actionTracker: ActionTracker,
  mcpClientManager: McpClientManager,
  editable?: EditableGraph
): Project {
  return new ReactiveProject(
    mainGraphId,
    mutable,
    fetchWithCreds,
    boardServer,
    mcpClientManager,
    actionTracker,
    editable
  );
}

type ReactiveComponents = SignalMap<NodeIdentifier, Component>;

class ReactiveProject implements ProjectInternal, ProjectValues {
  readonly #mainGraphId: MainGraphIdentifier;
  readonly #mutable: MutableGraph;
  readonly #fetchWithCreds: typeof globalThis.fetch;
  readonly #boardServer: GoogleDriveBoardServer;

  #graphChanged = new Signal.State({});
  readonly #editable: EditableGraph | undefined;

  @signal
  get editable(): EditableGraph | undefined {
    this.#graphChanged.get();
    return this.#editable;
  }

  @signal
  accessor run: ProjectRun;

  readonly graphUrl: URL | null;
  readonly graphAssets: SignalMap<AssetPath, GraphAsset>;

  readonly tools: SignalMap<string, Tool>;
  readonly myTools: SignalMap<string, Tool>;
  readonly controlFlowTools: SignalMap<string, Tool>;
  readonly organizer: Organizer;
  readonly components: SignalMap<GraphIdentifier, ReactiveComponents>;

  readonly renderer: RendererState;
  readonly integrations: Integrations;
  readonly stepEditor: StepEditor;
  readonly themes: ProjectThemeState;

  constructor(
    mainGraphId: MainGraphIdentifier,
    mutable: MutableGraph,
    fetchWithCreds: typeof globalThis.fetch,
    boardServer: GoogleDriveBoardServer,
    clientManager: McpClientManager,
    private readonly actionTracker: ActionTracker,
    editable?: EditableGraph
  ) {
    this.#mainGraphId = mainGraphId;
    this.#mutable = mutable;
    this.#fetchWithCreds = fetchWithCreds;
    this.#boardServer = boardServer;
    this.#editable = editable;
    mutable.store.addEventListener("update", (event) => {
      if (event.mainGraphId === mainGraphId) {
        this.#updateComponents();
        this.#updateGraphAssets();

        this.#updateMyTools();
        this.#updateControlFlowTools();
        this.#graphChanged.set({});
      }
    });
    const graph = this.#mutable.graph;
    const graphUrlString = graph?.url;
    this.graphUrl = graphUrlString ? new URL(graphUrlString) : null;
    this.graphAssets = new SignalMap();
    this.tools = new SignalMap(A2_TOOLS);
    this.controlFlowTools = new SignalMap();
    this.components = new SignalMap();
    this.myTools = new SignalMap();

    this.organizer = new ReactiveOrganizer(this);
    this.integrations = new IntegrationsImpl(clientManager, editable);
    this.stepEditor = new StepEditorImpl(this);
    this.#updateGraphAssets();
    this.renderer = new RendererStateImpl(this.graphAssets);
    this.#updateComponents();
    this.#updateMyTools();
    this.#updateControlFlowTools();

    this.run = ReactiveProjectRun.createInert(
      this.#mainGraphId,
      this.#mutable.store
    );
    this.themes = new ThemeState(this.#fetchWithCreds, editable, this);
  }

  resetRun(): void {
    this.run = ReactiveProjectRun.createInert(
      this.#mainGraphId,
      this.#mutable.store
    );
  }

  connectHarnessRunner(
    runner: HarnessRunner,
    fileSystem: FileSystem,
    signal?: AbortSignal
  ): Outcome<void> {
    // Intentionally reset this property with a new instance.
    this.run = ReactiveProjectRun.create(
      this.stepEditor,
      this.#mainGraphId,
      this.actionTracker,
      this.#mutable.store,
      fileSystem,
      runner,
      this.#editable,
      signal
    );
  }

  async apply(transform: EditTransform): Promise<Outcome<void>> {
    const editable = this.#editable;
    if (!editable) {
      return err(
        `Unable to get an editable graph with id "${this.#mainGraphId}"`
      );
    }

    const editing = await editable.apply(transform);
    if (!editing.success) {
      return err(editing.error);
    }
  }

  async edit(spec: EditSpec[], label: string): Promise<Outcome<void>> {
    const editable = this.#editable;
    if (!editable) {
      return err(
        `Unable to get an editable graph with id "${this.#mainGraphId}"`
      );
    }

    const editing = await editable.edit(spec, label);
    if (!editing.success) {
      return err(editing.error);
    }
  }

  async persistDataParts(contents: LLMContent[]): Promise<LLMContent[]> {
    const urlString = this.#mutable.graph.url;
    if (!urlString) {
      console.warn("Can't persist blob without graph URL");
      return contents;
    }

    const url = new URL(urlString);

    const transformed = await transformDataParts(
      url,
      contents,
      "persistent",
      this.#boardServer.dataPartTransformer()
    );
    if (!ok(transformed)) {
      console.warn(`Failed to persist a blob: "${transformed.$error}"`);
      return contents;
    }

    return transformed;
  }

  getMetadataForNode(
    nodeId: NodeIdentifier,
    graphId: GraphIdentifier
  ): Outcome<NodeHandlerMetadata> {
    const node = this.#mutable.nodes.get(nodeId, graphId);
    if (!node) {
      return err(`Unable to find node with id "${nodeId}`);
    }
    const metadata = node.currentDescribe().metadata;
    if (!metadata) {
      return err(`Unable to find metadata for node with id "${nodeId}"`);
    }
    return metadata;
  }

  getPortsForNode(
    nodeId: NodeIdentifier,
    graphId: GraphIdentifier
  ): Outcome<InspectableNodePorts> {
    const node = this.#mutable.nodes.get(nodeId, graphId);
    if (!node) {
      return err(`Unable to find node with id "${nodeId}`);
    }
    return node.currentPorts();
  }

  getTitleForNode(
    nodeId: NodeIdentifier,
    graphId: GraphIdentifier
  ): Outcome<string> {
    const node = this.#mutable.nodes.get(nodeId, graphId);
    if (!node) {
      return err(`Unable to find node with id "${nodeId}`);
    }
    return node.title();
  }

  findOutputPortId(
    graphId: GraphIdentifier,
    nodeId: NodeIdentifier
  ): Outcome<{ id: PortIdentifier; title: string }> {
    const node = this.#mutable.nodes.get(nodeId, graphId);
    if (!node) {
      return err(`Unable to find node with id "${nodeId}`);
    }
    const { ports } = node.currentPorts().outputs;
    const mainPort = ports.find((port) =>
      port.schema.behavior?.includes("main-port")
    );
    const result = { id: "", title: node.descriptor.id };
    if (mainPort) {
      result.id = mainPort.name;
      return result;
    }
    const firstPort = ports.at(0);
    if (!firstPort) {
      return err(`Unable to find a port on node with id "${nodeId}`);
    }
    result.id = firstPort.name;
    return result;
  }

  #updateMyTools() {
    const tools = Object.entries(this.#mutable.graph.graphs || {}).map<
      [string, Tool]
    >(([graphId, descriptor]) => {
      const url = `#${graphId}`;
      return [
        url,
        {
          url,
          title: descriptor.title || "Untitled Tool",
          description: descriptor.description,
          order: Number.MAX_SAFE_INTEGER,
          icon: "tool",
        },
      ];
    });
    updateMap(this.myTools, tools);
  }

  #updateControlFlowTools() {
    const tools: [string, Tool][] = [];
    // TODO: Make this condition a bit more robust:
    // - only show if there are other nodes besides the current node that aren't
    //   already used by an existing "Go to" chiclet.
    // - only show this for the "Agent" mode.
    if (this.#mutable.graph.nodes.length > 1) {
      tools.push([
        `control-flow/routing`,
        {
          url: "routing",
          title: "Go to:",
          icon: "spark",
        },
      ]);
    }
    tools.push([
      `function-group/use-memory`,
      {
        url: "use-memory",
        title: "Use Memory",
        icon: "database",
      },
    ]);
    updateMap(this.controlFlowTools, tools);
  }

  #updateComponents() {
    const map = this.components;
    const toDelete = new Set(map.keys());
    const updated = Object.entries(this.#mutable.graphs.graphs());
    updated.push(["", this.#mutable.graphs.get("")!]);
    updated.forEach(([key, value]) => {
      let currentValue = map.get(key);
      if (!currentValue) {
        currentValue = new SignalMap<NodeIdentifier, Component>();
        map.set(key, currentValue);
      } else {
        toDelete.delete(key);
      }

      const nodeValues: Promise<[string, Component]>[] = [];
      for (const node of value.nodes()) {
        const ports = node.currentPorts();
        const metadata = node.currentDescribe()?.metadata ?? {};
        const { tags } = metadata;

        // If we already know the tags and ports, just use them.
        if (tags && !ports.updating) {
          nodeValues.push(
            Promise.resolve([
              node.descriptor.id,
              {
                id: node.descriptor.id,
                title: node.title(),
                description: node.description(),
                ports,
                metadata,
              },
            ])
          );
          continue;
        }

        // ... but if there aren't tags or the ports are updating, try using
        // the full `describe()` instead.
        nodeValues.push(
          Promise.all([node.ports(), node.describe()]).then(
            ([ports, description]) => {
              return [
                node.descriptor.id,
                {
                  id: node.descriptor.id,
                  title: node.title(),
                  description: node.description(),
                  ports,
                  metadata: description.metadata ?? {},
                },
              ];
            }
          )
        );
      }

      Promise.all(nodeValues).then((nodes) => {
        updateMap(currentValue, nodes);
      });
    });

    [...toDelete.values()].forEach((key) => {
      map.delete(key);
    });
  }

  #updateGraphAssets() {
    const { assets = {} } = this.#mutable.graph;
    // Special-case the thumbnail and splash so they doesn't show up.
    delete assets[THUMBNAIL_KEY];

    const graphAssets = Object.entries(assets).map<[string, GraphAsset]>(
      ([path, asset]) => [path, new GraphAssetImpl(this, path, asset)]
    );

    updateMap(this.graphAssets, graphAssets);
  }
}
