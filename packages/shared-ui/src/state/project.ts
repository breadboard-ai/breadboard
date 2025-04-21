/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AssetPath,
  GraphIdentifier,
  LLMContent,
  NodeIdentifier,
  ParameterMetadata,
} from "@breadboard-ai/types";
import {
  BoardServer,
  EditableGraph,
  EditSpec,
  EditTransform,
  err,
  GraphStoreEntry,
  MainGraphIdentifier,
  MutableGraphStore,
  ok,
  Outcome,
  PortIdentifier,
  transformDataParts,
} from "@google-labs/breadboard";
import { SignalMap } from "signal-utils/map";
import { ReactiveOrganizer } from "./organizer";
import {
  Component,
  ConnectorState,
  FastAccess,
  GraphAsset,
  Organizer,
  Project,
  ProjectInternal,
  RendererState,
  Tool,
} from "./types";
import { ReactiveFastAccess } from "./fast-access";
import { SideBoardRuntime } from "../sideboards/types";
import { isA2 } from "@breadboard-ai/a2";
import { RendererStateImpl } from "./renderer";
import { ConnectorStateImpl } from "./connectors";
import { ConnectorType } from "../connectors/types";
import { GraphAssetImpl } from "./graph-asset";

export { createProjectState, ReactiveProject };

const THUMBNAIL_KEY = "@@thumbnail";

/**
 * Controls the filter for tools. Use it to tweak what shows up in the "Tools"
 * section of the "@" menu.
 */
function isTool(entry: GraphStoreEntry) {
  return (
    !entry.updating &&
    entry.tags?.includes("tool") &&
    !!entry.url &&
    entry?.tags.includes("quick-access") &&
    isA2(entry.url)
  );
}

function createProjectState(
  mainGraphId: MainGraphIdentifier,
  store: MutableGraphStore,
  runtime: SideBoardRuntime,
  boardServerFinder: (url: URL) => BoardServer | null,
  editable?: EditableGraph
): Project {
  return new ReactiveProject(
    mainGraphId,
    store,
    runtime,
    boardServerFinder,
    editable
  );
}

type ReactiveComponents = SignalMap<NodeIdentifier, Component>;

type BoardServerFinder = (url: URL) => BoardServer | null;

class ReactiveProject implements ProjectInternal {
  #mainGraphId: MainGraphIdentifier;
  #store: MutableGraphStore;
  #runtime: SideBoardRuntime;
  #boardServerFinder: BoardServerFinder;
  #editable?: EditableGraph;
  #connectorInstances: Set<string> = new Set();
  #connectorMap: SignalMap<string, ConnectorType>;

  readonly graphUrl: URL | null;
  readonly graphAssets: SignalMap<AssetPath, GraphAsset>;

  readonly tools: SignalMap<string, Tool>;
  readonly myTools: SignalMap<string, Tool>;
  readonly organizer: Organizer;
  readonly fastAccess: FastAccess;
  readonly components: SignalMap<GraphIdentifier, ReactiveComponents>;
  readonly parameters: SignalMap<string, ParameterMetadata>;
  readonly connectors: ConnectorState;
  readonly renderer: RendererState;

  constructor(
    mainGraphId: MainGraphIdentifier,
    store: MutableGraphStore,
    runtime: SideBoardRuntime,
    boardServerFinder: BoardServerFinder,
    editable?: EditableGraph
  ) {
    this.#mainGraphId = mainGraphId;
    this.#store = store;
    this.#runtime = runtime;
    this.#boardServerFinder = boardServerFinder;
    this.#editable = editable;
    store.addEventListener("update", (event) => {
      if (event.mainGraphId === mainGraphId) {
        this.#updateComponents();
        this.#updateGraphAssets();
        this.#updateParameters();
        this.#updateMyTools();
      }
      this.#updateConnectors();
      this.#updateTools();
    });
    const graphUrlString = this.#store.get(mainGraphId)?.graph.url;
    this.graphUrl = graphUrlString ? new URL(graphUrlString) : null;
    this.graphAssets = new SignalMap();
    this.tools = new SignalMap();
    this.components = new SignalMap();
    this.myTools = new SignalMap();
    this.parameters = new SignalMap();
    this.#connectorMap = new SignalMap();
    this.#updateConnectors();
    this.connectors = new ConnectorStateImpl(this, this.#connectorMap);
    this.organizer = new ReactiveOrganizer(this);
    this.fastAccess = new ReactiveFastAccess(
      this,
      this.graphAssets,
      this.tools,
      this.myTools,
      this.components,
      this.parameters
    );
    this.#updateGraphAssets();
    this.renderer = new RendererStateImpl(this.graphAssets);
    this.#updateComponents();
    this.#updateTools();
    this.#updateMyTools();
    this.#updateParameters();
  }

  runtime(): SideBoardRuntime {
    return this.#runtime;
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

  async persistBlobs(contents: LLMContent[]): Promise<LLMContent[]> {
    const urlString = this.#store.get(this.#mainGraphId)?.graph.url;
    if (!urlString) return contents;

    const server = this.#boardServerFinder(new URL(urlString));
    if (!server || !server.dataPartTransformer) return contents;

    const url = new URL(urlString);

    const transformed = await transformDataParts(
      url,
      contents,
      "persistent",
      server.dataPartTransformer(url)
    );
    if (!ok(transformed)) {
      return contents;
    }

    return transformed;
  }

  findOutputPortId(
    graphId: GraphIdentifier,
    nodeId: NodeIdentifier
  ): Outcome<{ id: PortIdentifier; title: string }> {
    const inspectable = this.#store.inspect(this.#mainGraphId, graphId);
    if (!inspectable) {
      return err(`Unable to inspect graph with "${this.#mainGraphId}"`);
    }
    const node = inspectable.nodeById(nodeId);
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
    const mutable = this.#store.get(this.#mainGraphId);
    if (!mutable) return;

    const tools = Object.entries(mutable.graph.graphs || {}).map<
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

  /**
   * Must run **after** #updateGraphAssets.
   */
  #updateTools() {
    const graphs = this.#store.graphs();
    const toolGraphEntries = graphs.filter(isTool);

    const tools: [string, Tool][] = [];

    for (const entry of toolGraphEntries) {
      const tool = toTool(entry);
      const isPartOfConnector = !!entry.mainGraph.tags?.includes("connector");
      if (!isPartOfConnector) {
        tools.push(tool);
      }
    }

    // Add a tool bundle for each connector with "tools" export
    for (const graphAsset of this.graphAssets.values()) {
      const { path, connector, metadata: { title } = {} } = graphAsset;
      if (!connector || !connector.type.tools) continue;

      tools.push([
        connector.type.url,
        {
          url: connector.type.url,
          title: `${title} Tools`,
          icon: connector.type.icon,
          connectorInstance: path,
        } satisfies Tool,
      ]);
    }

    updateMap(this.tools, tools);

    function toTool(entry: GraphStoreEntry): [string, Tool] {
      return [
        entry.url!,
        {
          url: entry.url!,
          title: entry.title,
          description: entry.description,
          order: entry.order || Number.MAX_SAFE_INTEGER,
          icon: entry.icon,
        } satisfies Tool,
      ];
    }
  }

  #updateComponents() {
    const mutable = this.#store.get(this.#mainGraphId);
    if (!mutable) return;

    const map = this.components;
    const toDelete = new Set(map.keys());
    const updated = Object.entries(mutable.graphs.graphs());
    updated.push(["", this.#store.inspect(this.#mainGraphId, "")!]);
    updated.forEach(([key, value]) => {
      let currentValue = map.get(key);
      if (!currentValue) {
        currentValue = new SignalMap<NodeIdentifier, Component>();
        map.set(key, currentValue);
      } else {
        toDelete.delete(key);
      }
      updateMap(
        currentValue,
        value.nodes().map((node) => [
          node.descriptor.id,
          {
            id: node.descriptor.id,
            title: node.title(),
            description: node.description(),
          },
        ])
      );
    });

    [...toDelete.values()].forEach((key) => {
      map.delete(key);
    });
  }

  #updateGraphAssets() {
    const mutable = this.#store.get(this.#mainGraphId);
    if (!mutable) return;

    this.#connectorInstances.clear();

    const { assets = {} } = mutable.graph;
    // Special-case the thumnail and splash so they doesn't show up.
    delete assets[THUMBNAIL_KEY];

    const graphAssets = Object.entries(assets).map<[string, GraphAsset]>(
      ([path, asset]) => [path, new GraphAssetImpl(this, path, asset)]
    );

    updateMap(this.graphAssets, graphAssets);
  }

  #updateParameters() {
    const mutable = this.#store.get(this.#mainGraphId);
    if (!mutable) return;

    const { parameters = {} } = mutable.graph?.metadata || {};

    updateMap(
      this.parameters,
      Object.entries(parameters).map(([id, parameter]) => [id, parameter])
    );
  }

  #updateConnectors() {
    const graphs = this.#store.mainGraphs();
    const connectors = graphs.filter(
      (graph) =>
        graph.tags?.includes("connector") &&
        graph.tags?.includes("published") &&
        graph.url
    );
    updateMap(
      this.#connectorMap,
      connectors.map((connector) => {
        const url = connector.url!;
        const load = connector.exportTags.includes("connector-load");
        const save = connector.exportTags.includes("connector-save");
        const tools = connector.exportTags.includes("connector-tools");
        const singleton = !!connector.tags?.includes("connector-singleton");
        const experimental = !!connector.tags?.includes("experimental");
        return [
          url,
          {
            url,
            icon: connector.icon,
            title: connector.title || "Unknown Connector",
            description: connector.description,
            singleton,
            load,
            save,
            tools,
            experimental,
          } satisfies ConnectorType,
        ];
      })
    );
  }

  connectorInstanceExists(url: string): boolean {
    return this.#connectorInstances.has(url);
  }

  addConnectorInstance(url: string): void {
    this.#connectorInstances.add(url);
  }
}

/**
 * Incrementally updates a map, given updated values.
 * Updates the values in `updated`, deletes the ones that aren't in it.
 */
function updateMap<T extends SignalMap>(
  map: T,
  updated: [string, unknown][]
): void {
  const toDelete = new Set(map.keys());

  updated.forEach(([key, value]) => {
    map.set(key, value);
    toDelete.delete(key);
  });

  [...toDelete.values()].forEach((key) => {
    map.delete(key);
  });
}
