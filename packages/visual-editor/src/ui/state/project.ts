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
} from "./types.js";
import { IntegrationsImpl } from "./integrations.js";
import { updateMap } from "./utils/update-map.js";
import { McpClientManager } from "../../mcp/index.js";
import { StepEditorImpl } from "./step-editor.js";
import { ThemeState } from "./theme-state.js";
import { err, ok } from "@breadboard-ai/utils";
import { transformDataParts } from "../../data/common.js";
import { GoogleDriveBoardServer } from "../../board-server/server.js";
import { ActionTracker } from "../types/types.js";
import { Signal } from "signal-polyfill";
import { SCA } from "../../sca/sca.js";

export { createProjectState, ReactiveProject };

const THUMBNAIL_KEY = "@@thumbnail";

function createProjectState(
  fetchWithCreds: typeof globalThis.fetch,
  boardServer: GoogleDriveBoardServer,
  actionTracker: ActionTracker,
  mcpClientManager: McpClientManager,
  editable: EditableGraph,
  sca: SCA
): Project {
  return new ReactiveProject(
    fetchWithCreds,
    boardServer,
    mcpClientManager,
    actionTracker,
    editable,
    sca
  );
}

class ReactiveProject implements ProjectInternal, ProjectValues {
  readonly #fetchWithCreds: typeof globalThis.fetch;
  readonly #boardServer: GoogleDriveBoardServer;

  #graphChanged = new Signal.State({});
  readonly #editable: EditableGraph;

  @signal
  get editable(): EditableGraph {
    this.#graphChanged.get();
    return this.#editable;
  }

  @signal
  accessor run: ProjectRun;

  readonly graphUrl: URL | null;
  readonly graphAssets: SignalMap<AssetPath, GraphAsset>;

  readonly organizer: Organizer;

  readonly renderer: RendererState;
  readonly integrations: Integrations;
  readonly stepEditor: StepEditor;
  readonly themes: ProjectThemeState;

  constructor(
    fetchWithCreds: typeof globalThis.fetch,
    boardServer: GoogleDriveBoardServer,
    clientManager: McpClientManager,
    private readonly actionTracker: ActionTracker,
    editable: EditableGraph,
    private readonly __sca: SCA
  ) {
    this.#fetchWithCreds = fetchWithCreds;
    this.#boardServer = boardServer;
    this.#editable = editable;
    editable.addEventListener("graphchange", (e) => {
      if (e.visualOnly) return;
      this.#updateGraphAssets();

      this.#graphChanged.set({});
    });
    const graph = editable.raw();
    const graphUrlString = graph?.url;
    this.graphUrl = graphUrlString ? new URL(graphUrlString) : null;
    this.graphAssets = new SignalMap();

    this.organizer = new ReactiveOrganizer(this);
    this.integrations = new IntegrationsImpl(clientManager, editable);
    this.stepEditor = new StepEditorImpl(this, this.__sca);
    this.#updateGraphAssets();
    this.renderer = new RendererStateImpl(this.graphAssets);

    this.run = ReactiveProjectRun.createInert(this.#editable.inspect(""));
    this.themes = new ThemeState(this.#fetchWithCreds, editable, this);
  }

  resetRun(): void {
    this.run = ReactiveProjectRun.createInert(this.#editable.inspect(""));
  }

  connectHarnessRunner(
    runner: HarnessRunner,
    signal?: AbortSignal
  ): Outcome<void> {
    // Intentionally reset this property with a new instance.
    this.run = ReactiveProjectRun.create(
      this.stepEditor,
      this.actionTracker,
      this.#editable.inspect(""),
      runner,
      this.#editable,
      signal
    );
  }

  async apply(transform: EditTransform): Promise<Outcome<void>> {
    const editing = await this.#editable.apply(transform);
    if (!editing.success) {
      return err(editing.error);
    }
  }

  async edit(spec: EditSpec[], label: string): Promise<Outcome<void>> {
    const editing = await this.#editable.edit(spec, label);
    if (!editing.success) {
      return err(editing.error);
    }
  }

  async persistDataParts(contents: LLMContent[]): Promise<LLMContent[]> {
    const urlString = this.#editable.raw().url;
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
    const node = this.#editable.inspect(graphId).nodeById(nodeId);
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
    const node = this.#editable.inspect(graphId).nodeById(nodeId);
    if (!node) {
      return err(`Unable to find node with id "${nodeId}`);
    }
    return node.currentPorts();
  }

  getTitleForNode(
    nodeId: NodeIdentifier,
    graphId: GraphIdentifier
  ): Outcome<string> {
    const node = this.#editable.inspect(graphId).nodeById(nodeId);
    if (!node) {
      return err(`Unable to find node with id "${nodeId}`);
    }
    return node.title();
  }

  findOutputPortId(
    graphId: GraphIdentifier,
    nodeId: NodeIdentifier
  ): Outcome<{ id: PortIdentifier; title: string }> {
    const node = this.#editable.inspect(graphId).nodeById(nodeId);
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

  #updateGraphAssets() {
    const { assets = {} } = this.#editable.raw();
    // Special-case the thumbnail and splash so they doesn't show up.
    delete assets[THUMBNAIL_KEY];

    const graphAssets = Object.entries(assets).map<[string, GraphAsset]>(
      ([path, asset]) => [path, new GraphAssetImpl(this, path, asset)]
    );

    updateMap(this.graphAssets, graphAssets);
  }
}
