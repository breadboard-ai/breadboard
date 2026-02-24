/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  AssetPath,
  EditableGraph,
  EditHistoryCreator,
  GraphChangeEvent,
  GraphChangeRejectEvent,
  GraphDescriptor,
  GraphIdentifier,
  GraphStoreArgs,
  GraphTheme,
  InspectableGraph,
  InspectableGraphCache,
  InspectableNodeCache,
  InspectableNodePorts,
  MainGraphIdentifier,
  MutableGraph,
  MutableGraphStore,
  NodeConfiguration,
  NodeDescribeSnapshot,
  NodeDescriptor,
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
import { NodeDescribeEntry } from "./node-describe-entry.js";
import type { NodeDescriber } from "./node-describer.js";
import { Graph } from "../../../../../engine/inspector/graph/graph.js";
import { Node } from "../../../../../engine/inspector/graph/node.js";

import { Tool, Component } from "../../../../types.js";
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
 * Tri-state describing the content state of a graph.
 *
 * - `"loading"` — graph descriptor hasn't been set yet (initial state).
 * - `"empty"`   — graph is loaded but contains no nodes, assets, or sub-graphs.
 * - `"loaded"`  — graph has at least one node, asset, or sub-graph.
 */
export type GraphContentState = "loading" | "empty" | "loaded";

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

export class GraphController extends RootController implements MutableGraph {
  // =========================================================================
  // MutableGraph implementation
  // =========================================================================

  /**
   * MutableGraph.id — stable identifier for this mutable graph instance.
   * Regenerated on each `initialize()` call.
   */
  id!: MainGraphIdentifier;

  /**
   * Dependencies for describers (sandbox, flags, etc.).
   * Set once during initialization via `initialize()`.
   */
  #deps!: GraphStoreArgs;

  get deps(): GraphStoreArgs {
    return this.#deps;
  }

  /**
   * Inspectable sub-graph cache. Provides `.get(id)` and `.graphs()`.
   */
  graphs!: InspectableGraphCache;

  /**
   * Inspectable node cache. Provides `.get(id, graphId)`, `.nodes(graphId)`,
   * `.byType(type, graphId)`.
   */
  nodes!: InspectableNodeCache;

  /**
   * Describe entries map. Keyed by "graphId:nodeId".
   * Entries are created lazily on first `describeNode()` call.
   */
  #describeEntries = new Map<string, NodeDescribeEntry>();

  /**
   * The injected describer function (SCA Service→Controller boundary).
   * Set during `initialize()`.
   */
  #describer!: NodeDescriber;

  /**
   * MutableGraphStore — self-referential. `EditableGraph` reads `store` from
   * the MutableGraph to pass to describer contexts.
   */
  get store(): MutableGraphStore {
    return this;
  }

  /**
   * MutableGraphStore.set — no-op, since GraphController IS the mutable graph.
   * Retained for interface compatibility.
   */
  set(_graph: MutableGraph): void {
    // no-op: GraphController is the MutableGraph, nothing to store.
  }

  /**
   * MutableGraphStore.get — returns `this`.
   */
  get(): MutableGraph {
    return this;
  }

  /**
   * Initializes the MutableGraph state from a graph descriptor.
   * Call this once when loading a graph (replaces `new MutableGraphImpl()`).
   */
  initialize(
    graph: GraphDescriptor,
    deps: GraphStoreArgs,
    describer: NodeDescriber
  ): void {
    this.#deps = deps;
    this.#describer = describer;
    this.id = crypto.randomUUID();
    this.rebuild(graph);
  }

  /**
   * MutableGraph.update — incremental update after an edit.
   * Sets the graph descriptor. Describe refresh is handled reactively
   * by `#onGraphChange()` using the event's `affectedNodes`.
   */
  update(graph: GraphDescriptor, _visualOnly: boolean): void {
    this._graph = graph;
  }

  /**
   * MutableGraph.rebuild — full rebuild of all caches from a new descriptor.
   * Called on rollback, history navigation, and initial load.
   */
  rebuild(graph: GraphDescriptor): void {
    this._graph = graph;
    this.#describeEntries.clear();
    this.graphs = {
      get: (id: GraphIdentifier) => new Graph(id, this),
      graphs: () =>
        Object.fromEntries(
          Object.keys(this._graph?.graphs || {}).map((id) => [
            id,
            new Graph(id, this),
          ])
        ),
    };
    this.nodes = this.#createNodeAccessor();
  }

  #graphNodes(graphId: GraphIdentifier): NodeDescriptor[] {
    if (!graphId) return this._graph?.nodes ?? [];
    return this._graph?.graphs?.[graphId]?.nodes || [];
  }

  #createNodeAccessor(): InspectableNodeCache {
    return {
      get: (id, graphId) => {
        const descriptor = this.#graphNodes(graphId).find((n) => n.id === id);
        return descriptor ? new Node(descriptor, this, graphId) : undefined;
      },
      nodes: (graphId) =>
        this.#graphNodes(graphId).map((n) => new Node(n, this, graphId)),
      byType: (type, graphId) =>
        this.#graphNodes(graphId)
          .filter((n) => n.type === type)
          .map((n) => new Node(n, this, graphId)),
    };
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
  accessor sessionId: ReturnType<typeof globalThis.crypto.randomUUID> | null =
    null;

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
   * Returns non-null to satisfy MutableGraph. Before `initialize()`
   * is called, `_graph` is null, but nothing should read `.graph` via the
   * MutableGraph contract before initialization.
   */
  get graph(): GraphDescriptor {
    return this._graph!;
  }

  /**
   * The content state of the graph. Distinguishes between three states:
   *
   * - `"loading"` — the graph descriptor hasn't been set yet
   *   (`_graph` is null). This is the initial state before `setEditor()`
   *   is called. UI consumers should avoid showing the "empty" message
   *   during this transient phase to prevent a flash of empty content.
   *
   * - `"empty"` — the graph is loaded but has no nodes, assets,
   *   or sub-graphs. This is the genuine empty state where the user
   *   hasn't added any content yet.
   *
   * - `"loaded"` — the graph has at least one node, asset,
   *   or sub-graph. Normal editing/preview state.
   */
  get graphContentState(): GraphContentState {
    const g = this._graph;
    if (!g) return "loading";
    const hasContent =
      (g.nodes?.length ?? 0) > 0 ||
      Object.keys(g.assets ?? {}).length > 0 ||
      Object.keys(g.graphs ?? {}).length > 0;
    return hasContent ? "loaded" : "empty";
  }

  /**
   * Whether the graph is empty (has no nodes, assets, or sub-graphs).
   * @deprecated Use `graphContentState` instead, which distinguishes
   * "loading" from "empty".
   */
  get empty() {
    return this.graphContentState === "empty";
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

    // Skip derived state updates on visual-only changes (e.g., node movement)
    if (evt.visualOnly) return;

    // Only bump topologyVersion on structural changes (add/remove node/edge,
    // replace-graph). Config/metadata edits are NOT topology changes and must
    // not trigger runner re-preparation, which would wipe the current run state.
    if (evt.topologyChange) {
      this.topologyVersion++;
    }
    this.#refreshDescribers(evt.affectedNodes);
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

  /**
   * Returns a snapshot of a node's describe state.
   * Creates an entry lazily if one doesn't exist yet.
   */
  describeNode(
    id: NodeIdentifier,
    graphId: GraphIdentifier
  ): NodeDescribeSnapshot {
    const key = `${graphId}:${id}`;
    let entry = this.#describeEntries.get(key);
    if (!entry) {
      const node = this.nodes?.get(id, graphId);
      const type = node?.descriptor.type ?? "";
      const config = node?.configuration() ?? {};
      entry = new NodeDescribeEntry(this.#describer, type, config);
      this.#describeEntries.set(key, entry);
    }
    return entry.snapshot();
  }

  /**
   * Refreshes describe entries for nodes affected by a graph change.
   */
  #refreshDescribers(affectedNodes: { id: string; graphId: string }[]) {
    for (const { id, graphId } of affectedNodes) {
      const key = `${graphId}:${id}`;
      const entry = this.#describeEntries.get(key);
      if (entry) {
        const node = this.nodes?.get(id, graphId);
        const config = node?.configuration() ?? {};
        entry.refresh(config);
      }
    }
  }

  // =========================================================================
  // Graph Inspection
  // =========================================================================

  /**
   * Returns an `InspectableGraph` for the given sub-graph (or the main graph
   * when `graphId` is `""`).
   *
   * This is backed by the existing `Graph` class with `this` as the
   * `MutableGraph` — no extra state is created.
   */
  inspect(graphId: GraphIdentifier): InspectableGraph {
    return new Graph(graphId, this);
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
    const node = this.nodes?.get(nodeId, graphId);
    if (!node) {
      return err(`Unable to find node with id "${nodeId}"`);
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
    const node = this.nodes?.get(nodeId, graphId);
    if (!node) {
      return err(`Unable to find node with id "${nodeId}"`);
    }
    return node.currentPorts();
  }

  getTitleForNode(
    nodeId: NodeIdentifier,
    graphId: GraphIdentifier
  ): Outcome<string> {
    const node = this.nodes?.get(nodeId, graphId);
    if (!node) {
      return err(`Unable to find node with id "${nodeId}"`);
    }
    return node.title();
  }

  findOutputPortId(
    graphId: GraphIdentifier,
    nodeId: NodeIdentifier
  ): Outcome<{ id: PortIdentifier; title: string }> {
    const node = this.nodes?.get(nodeId, graphId);
    if (!node) {
      return err(`Unable to find node with id "${nodeId}"`);
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
      return err(`Unable to find a port on node with id "${nodeId}"`);
    }
    result.id = firstPort.name as PortIdentifier;
    return result;
  }

  /**
   * Resets the graph state when a board is closed.
   */
  resetAll() {
    this.sessionId = null;
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
    // Reset MutableGraph caches (will be re-initialized on next load)
    this.graphs = undefined!;
    this.nodes = undefined!;
    this.#describeEntries.clear();
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
    if (!this.nodes) {
      return new Map();
    }
    const inspectable = this.inspect("");
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
    const graph = this.graph;
    if (!graph) {
      return this._components;
    }
    const components = this._components.get("");
    if (!components) {
      return new Map();
    }

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

    if (!this.nodes) {
      this._components = new Map();
      return;
    }
    const inspectable = this.inspect("");
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
