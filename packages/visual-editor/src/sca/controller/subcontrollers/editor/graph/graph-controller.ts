/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AssetPath,
  EditableGraph,
  EditHistoryCreator,
  GraphChangeEvent,
  GraphChangeRejectEvent,
  GraphDescriptor,
  GraphIdentifier,
  GraphTheme,
  InspectableGraph,
  InspectableNodePorts,
  MutableGraph,
  MutableGraphStore,
  NodeConfiguration,
  NodeHandlerMetadata,
  NodeIdentifier,
  Outcome,
  OutputValues,
  PortIdentifier,
} from "@breadboard-ai/types";
import {
  err,
  NOTEBOOKLM_TOOL_PATH,
  willCreateCycle,
} from "@breadboard-ai/utils";
import { notebookLmIcon } from "../../../../../ui/styles/svg-icons.js";
import { field } from "../../../decorators/field.js";
import { RootController } from "../../root-controller.js";

import { Tool, Component } from "../../../../../ui/types/state-types.js";
import type { Components, GraphAsset } from "../../../../types.js";
import { A2_TOOLS } from "../../../../../a2/a2-registry.js";
import type { FastAccessItem } from "../../../../types.js";

/**
 * Context for tracking node configuration changes.
 * Used by the autoname trigger to react to config updates.
 */
export interface ConfigChangeContext {
  nodeId: NodeIdentifier;
  graphId: GraphIdentifier;
  configuration: NodeConfiguration;
  titleUserModified: boolean;
}

/**
 * Pending graph replacement request.
 * Set by actions (e.g., flowgen), consumed by the Graph.replaceWithTheme trigger.
 */
export interface PendingGraphReplacement {
  /** The replacement graph (will be mutated to apply theme) */
  replacement: GraphDescriptor;
  /** Optional theme to apply to the graph */
  theme?: GraphTheme;
  /** Edit history creator info */
  creator: EditHistoryCreator;
}

/**
 * Tool definition for the "Go to" routing action.
 * Only available when the graph has more than one node.
 */
const ROUTING_TOOL: Tool = {
  url: "routing",
  title: "Go to:",
  icon: "spark",
};

/**
 * Tool definition for the "Use Memory" action.
 * Always available in agent mode.
 */
const MEMORY_TOOL: Tool = {
  url: "use-memory",
  title: "Use Memory",
  icon: "database",
};

/**
 * Tool definition for the "NotebookLM" action.
 * Always available in agent mode.
 */
const NOTEBOOKLM_TOOL: Tool = {
  url: "notebooklm",
  title: "Use NotebookLM",
  icon: notebookLmIcon,
};

export class GraphController
  extends RootController
  implements MutableGraphStore
{
  #mutableGraph: MutableGraph | undefined;

  /**
   * MutableGraphStore.set — stores the given MutableGraph.
   */
  set(graph: MutableGraph): void {
    this.#mutableGraph = graph;
  }

  /**
   * MutableGraphStore.get — returns the current MutableGraph.
   */
  get(): MutableGraph | undefined {
    return this.#mutableGraph;
  }
  /**
   * Static registry of A2 tools. These are environment-independent
   * and don't change based on graph content.
   */
  readonly tools: ReadonlyMap<string, Tool> = new Map(A2_TOOLS);

  /**
   * Dynamic tools derived from the graph's sub-graphs.
   * Updated reactively when the graph topology changes.
   */
  @field({ deep: false })
  private accessor _myTools: Map<string, Tool> = new Map();

  get myTools(): ReadonlyMap<string, Tool> {
    return this._myTools;
  }

  /**
   * Agent mode tools (routing, memory) derived from graph state.
   * Updated reactively when the graph topology changes.
   */
  @field({ deep: false })
  private accessor _agentModeTools: Map<string, Tool> = new Map();

  get agentModeTools(): ReadonlyMap<string, Tool> {
    return this._agentModeTools;
  }

  /**
   * Components (nodes) available in each graph, keyed by graph ID.
   * Updated reactively when the graph topology changes.
   * Uses async port/metadata fetching with signal propagation on resolve.
   */
  @field({ deep: false })
  private accessor _components: Map<GraphIdentifier, Components> = new Map();

  get components(): ReadonlyMap<GraphIdentifier, Components> {
    return this._components;
  }

  @field({ deep: false })
  private accessor _editor: EditableGraph | null = null;

  /**
   * We set this to shallow because we update it via the Editor API, and that
   * wholesale changes the graph. Also parts of the graph might be
   * structureClone'd and so we don't want those to break.
   */
  @field({ deep: false })
  private accessor _graph: GraphDescriptor | null = null;

  @field()
  accessor id: ReturnType<typeof globalThis.crypto.randomUUID> | null = null;

  @field()
  accessor version = 0;

  /**
   * Monotonically increases on non-visual graph topology changes.
   * Used by UI components to detect when the graph structure has changed
   * (as opposed to visual-only changes like node movement).
   */
  @field()
  accessor topologyVersion = 0;

  @field()
  accessor lastLoadedVersion = 0;

  @field()
  accessor url: string | null = null;

  @field()
  accessor readOnly = false;

  /**
   * The graph URL parsed as a URL object, or null if no URL.
   */
  get graphUrl(): URL | null {
    return this.url ? new URL(this.url) : null;
  }

  @field()
  accessor lastEditError: string | null = null;

  /**
   * Tracks the current save status of the board.
   * Updated by the saveStatusChange trigger when the board server reports changes.
   */
  @field()
  accessor saveStatus: "saved" | "saving" | "unsaved" | "error" = "saved";

  /**
   * Graph assets (files/documents attached to the graph).
   * Updated reactively when the graph changes.
   */
  @field({ deep: false })
  private accessor _graphAssets: Map<AssetPath, GraphAsset> = new Map();

  get graphAssets(): Map<AssetPath, GraphAsset> {
    return this._graphAssets;
  }

  /**
   * Sets the graph assets. Called by the Asset.syncFromGraph action.
   */
  setGraphAssets(assets: Map<AssetPath, GraphAsset>) {
    this._graphAssets = assets;
  }

  /**
   * Tracks the most recent node configuration change.
   * Set by the changeNodeConfiguration action, consumed by the autoname trigger.
   */
  @field({ deep: true })
  accessor lastNodeConfigChange: ConfigChangeContext | null = null;

  /**
   * Pending graph replacement request.
   * Set by actions (e.g., flowgen), consumed by the replaceWithTheme trigger.
   * Contains all options needed to perform the replacement.
   */
  @field({ deep: false })
  accessor pendingGraphReplacement: PendingGraphReplacement | null = null;

  /**
   * Clears the pending graph replacement after processing.
   */
  clearPendingGraphReplacement() {
    this.pendingGraphReplacement = null;
  }

  /**
   * Here for migrations.
   * @deprecated
   */
  @field()
  accessor mainGraphId: ReturnType<typeof globalThis.crypto.randomUUID> | null =
    null;

  /**
   * Pre-loaded final output values for displaying results.
   * Not reactive since this is set once at load time.
   */
  finalOutputValues: OutputValues | undefined = undefined;

  /**
   * The title of the graph. Updated reactively when the graph changes.
   */
  @field()
  private accessor _title: string | null = null;

  get title(): string | null {
    return this._title;
  }

  /**
   * The current graph descriptor.
   */
  get graph() {
    return this._graph;
  }

  /**
   * Whether the graph is empty (has no nodes, assets, or sub-graphs).
   */
  get empty() {
    const g = this._graph;
    if (!g) return true;
    return (
      (g.nodes?.length ?? 0) === 0 &&
      Object.keys(g.assets ?? {}).length === 0 &&
      Object.keys(g.graphs ?? {}).length === 0
    );
  }

  get editor() {
    return this._editor;
  }

  setEditor(editor: EditableGraph | null) {
    if (this._editor) {
      this._editor.removeEventListener("graphchange", this.#onGraphChangeBound);
      this._editor.removeEventListener(
        "graphchangereject",
        this.#onGraphChangeRejectBound
      );
    }

    this._editor = editor;
    this._graph = this._editor?.raw() ?? null;
    this._title = this._graph?.title ?? null;
    this.lastEditError = null;

    // Note: version is set by initializeEditor, not here

    // Initialize derived data from the new graph
    this.#updateMyTools();
    this.#updateAgentModeTools();
    this.#updateComponents();
    // Note: graphAssets sync is handled by Asset.syncFromGraph action

    if (!this._editor) return;
    this._editor.addEventListener("graphchange", this.#onGraphChangeBound);
    this._editor.addEventListener(
      "graphchangereject",
      this.#onGraphChangeRejectBound
    );
  }

  #onGraphChangeBound = this.#onGraphChange.bind(this);
  #onGraphChange(evt: GraphChangeEvent) {
    this._graph = evt.graph;
    this._title = evt.graph?.title ?? null;
    this.lastEditError = null;
    this.version++;

    // Skip derived tools update on visual-only changes (e.g., node movement)
    if (evt.visualOnly) return;

    this.topologyVersion++;
    this.#updateMyTools();
    this.#updateAgentModeTools();
    this.#updateComponents();
    // Note: graphAssets sync is handled by Asset.syncFromGraph action
  }

  #onGraphChangeRejectBound = this.#onGraphChangeReject.bind(this);
  #onGraphChangeReject(evt: GraphChangeRejectEvent) {
    this._graph = evt.graph;
    if (evt.reason.type === "error") {
      this.lastEditError = evt.reason.error;
    }
  }

  // =========================================================================
  // Node Queries
  // =========================================================================

  /**
   * Returns metadata for a given node. This function is sync, and it
   * will return the current result, not the latest -- which is fine in most
   * cases.
   */
  getMetadataForNode(
    nodeId: NodeIdentifier,
    graphId: GraphIdentifier
  ): Outcome<NodeHandlerMetadata> {
    if (!this._editor) {
      return err("No editor available");
    }
    const node = this._editor.inspect(graphId).nodeById(nodeId);
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
    if (!this._editor) {
      return err("No editor available");
    }
    const node = this._editor.inspect(graphId).nodeById(nodeId);
    if (!node) {
      return err(`Unable to find node with id "${nodeId}`);
    }
    return node.currentPorts();
  }

  getTitleForNode(
    nodeId: NodeIdentifier,
    graphId: GraphIdentifier
  ): Outcome<string> {
    if (!this._editor) {
      return err("No editor available");
    }
    const node = this._editor.inspect(graphId).nodeById(nodeId);
    if (!node) {
      return err(`Unable to find node with id "${nodeId}`);
    }
    return node.title();
  }

  findOutputPortId(
    graphId: GraphIdentifier,
    nodeId: NodeIdentifier
  ): Outcome<{ id: PortIdentifier; title: string }> {
    if (!this._editor) {
      return err("No editor available");
    }
    const node = this._editor.inspect(graphId).nodeById(nodeId);
    if (!node) {
      return err(`Unable to find node with id "${nodeId}`);
    }
    const { ports } = node.currentPorts().outputs;
    const mainPort = ports.find((port) =>
      port.schema.behavior?.includes("main-port")
    );
    const result = { id: "" as PortIdentifier, title: node.descriptor.id };
    if (mainPort) {
      result.id = mainPort.name as PortIdentifier;
      return result;
    }
    const firstPort = ports.at(0);
    if (!firstPort) {
      return err(`Unable to find a port on node with id "${nodeId}`);
    }
    result.id = firstPort.name as PortIdentifier;
    return result;
  }

  /**
   * Resets the graph state when a board is closed.
   */
  resetAll() {
    this.id = null;
    this._editor = null;
    this._graph = null;
    this._title = null;
    this.url = null;
    this.version = 0;
    this.topologyVersion = 0;
    this.readOnly = false;
    this.mainGraphId = null;
    this.lastLoadedVersion = 0;
    this.lastNodeConfigChange = null;
    this.finalOutputValues = undefined;
    this._myTools = new Map();
    this._agentModeTools = new Map();
    this._components = new Map();
    this.#componentsUpdateGeneration++;
  }

  // =========================================================================
  // Fast Access Derivations
  // =========================================================================

  /**
   * Derives the set of route targets available from the currently selected node.
   * Returns all nodes in the main graph except the selected one.
   * Returns an empty map when no node is selected.
   *
   * Accepts `selectedNodeId` as a parameter because GraphController cannot
   * access its sibling SelectionController directly. Callers pass
   * `sca.controller.editor.selection.selectedNodeId`.
   */
  getRoutes(
    selectedNodeId: NodeIdentifier | null
  ): ReadonlyMap<string, Component> {
    if (!selectedNodeId) {
      return new Map();
    }
    const inspectable = this._editor?.inspect("");
    if (!inspectable) {
      return new Map();
    }
    return new Map<string, Component>(
      inspectable
        .nodes()
        .filter((node) => node.descriptor.id !== selectedNodeId)
        .map((node) => {
          const id = node.descriptor.id;
          return [
            id,
            {
              id,
              title: node.title(),
              metadata: node.currentDescribe().metadata,
            },
          ];
        })
    );
  }

  /**
   * Returns components with cycle-creating nodes filtered out for the
   * currently selected node. When no node is selected, returns all components.
   *
   * Accepts `selectedNodeId` as a parameter because GraphController cannot
   * access its sibling SelectionController directly.
   */
  getFilteredComponents(
    selectedNodeId: NodeIdentifier | null
  ): ReadonlyMap<GraphIdentifier, Components> {
    if (!selectedNodeId) {
      return this._components;
    }
    const inspectable = this._editor?.inspect("");
    if (!inspectable) {
      return this._components;
    }
    const components = this._components.get("");
    if (!components) {
      return new Map();
    }

    const graph = inspectable.raw();
    const validComponents = [...components].filter(
      ([id]) => !willCreateCycle({ to: selectedNodeId, from: id }, graph)
    );

    return new Map<GraphIdentifier, Components>([
      ["", new Map(validComponents)],
    ]);
  }

  /**
   * Builds a flat, ordered list of all items available in the Fast Access menu.
   * This replaces the brittle index-offset arithmetic that was previously in
   * the UI component's `willUpdate()` and `#emitCurrentItem()`.
   *
   * The order is: assets → tools → components → routes.
   * Integration items are NOT included here — they remain on the legacy
   * Integrations manager until that migration is complete.
   *
   * @param selectedNodeId The currently selected node (for routes and
   *   filtered components). Pass `null` when no node is selected.
   */
  getFastAccessItems(selectedNodeId: NodeIdentifier | null): FastAccessItem[] {
    const items: FastAccessItem[] = [];

    // Assets
    for (const asset of this._graphAssets.values()) {
      items.push({ kind: "asset", asset });
    }

    // Tools (A2 tools + myTools, sorted by order)
    const allTools = [...this.tools.values(), ...this._myTools.values()].sort(
      (a, b) => (a.order ?? 0) - (b.order ?? 0)
    );
    for (const tool of allTools) {
      items.push({ kind: "tool", tool });
    }

    // Components (filtered for cycles)
    const filteredComponents = this.getFilteredComponents(selectedNodeId);
    const graphComponents = filteredComponents.get("");
    if (graphComponents) {
      for (const component of graphComponents.values()) {
        items.push({ kind: "component", component });
      }
    }

    // Routes
    const routes = this.getRoutes(selectedNodeId);
    for (const route of routes.values()) {
      items.push({ kind: "route", route });
    }

    return items;
  }

  /**
   * Rebuilds myTools from the graph's sub-graphs.
   * Each sub-graph becomes a tool entry keyed by its URL fragment.
   * Uses wholesale Map replacement to trigger @field reactivity.
   */
  #updateMyTools() {
    this._myTools = new Map(
      Object.entries(this._graph?.graphs || {}).map<[string, Tool]>(
        ([graphId, descriptor]) => {
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
        }
      )
    );
  }

  /**
   * Rebuilds agentModeTools based on graph state.
   * - ROUTING_TOOL: Only included when graph has >1 node
   * - MEMORY_TOOL: Always included
   * - NOTEBOOKLM_TOOL: Always included
   * Uses wholesale Map replacement to trigger @field reactivity.
   */
  #updateAgentModeTools() {
    const tools: [string, Tool][] = [];
    if ((this._graph?.nodes?.length ?? 0) > 1) {
      tools.push([`control-flow/routing`, ROUTING_TOOL]);
    }
    tools.push([`function-group/use-memory`, MEMORY_TOOL]);
    tools.push([NOTEBOOKLM_TOOL_PATH, NOTEBOOKLM_TOOL]);
    this._agentModeTools = new Map(tools);
  }

  /**
   * Rebuilds components from inspectable graph nodes.
   * Iterates all graphs (main + sub-graphs) and derives component info.
   * Uses async port/metadata fetching with wholesale Map replacement on resolve.
   * Includes a version guard to prevent stale async updates from overwriting
   * fresher data when multiple updates overlap.
   */
  #componentsUpdateGeneration = 0;
  #updateComponents() {
    if (!this._editor) {
      this._components = new Map();
      return;
    }

    // Increment generation to track this update cycle
    const currentGeneration = ++this.#componentsUpdateGeneration;

    const inspectable = this._editor.inspect("");
    const graphs: [GraphIdentifier, InspectableGraph][] = Object.entries(
      inspectable.graphs() || {}
    );
    graphs.push(["", inspectable]);

    for (const [graphId, graphInspectable] of graphs) {
      const nodeValues: Promise<[string, Component]>[] = [];

      for (const node of graphInspectable.nodes()) {
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

      // When all node values resolve, update the components for this graph
      // Guard against stale updates - only apply if we're still in the same update cycle
      Promise.all(nodeValues).then((nodes) => {
        if (currentGeneration !== this.#componentsUpdateGeneration) {
          return; // A newer update is in progress, discard this stale result
        }
        const graphComponents = new Map<NodeIdentifier, Component>(nodes);
        // Create a new Map to trigger reactivity
        this._components = new Map([
          ...this._components,
          [graphId, graphComponents],
        ]);
      });
    }

    // Initialize with empty maps for each graph (will be updated when promises resolve)
    this._components = new Map(graphs.map(([graphId]) => [graphId, new Map()]));
  }
}
