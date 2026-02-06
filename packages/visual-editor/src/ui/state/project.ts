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
  EditSpec,
  EditTransform,
  NodeHandlerMetadata,
  Outcome,
  PortIdentifier,
} from "@breadboard-ai/types";
import { signal } from "signal-utils";

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
  FastAccess,
} from "./types.js";
import { IntegrationsImpl } from "./integrations.js";
import { McpClientManager } from "../../mcp/index.js";
import { ReactiveFastAccess } from "./fast-access.js";
import { FilteredIntegrationsImpl } from "./filtered-integrations.js";
import { ThemeState } from "./theme-state.js";
import { err, ok } from "@breadboard-ai/utils";
import { SCA } from "../../sca/sca.js";
import { transformDataParts } from "../../data/common.js";

export { createProjectState, ReactiveProject };

function createProjectState(
  mcpClientManager: McpClientManager,
  sca: SCA
): Project {
  return new ReactiveProject(mcpClientManager, sca);
}

class ReactiveProject implements ProjectInternal, ProjectValues {
  readonly #sca: SCA;

  @signal
  accessor run: ProjectRun;

  /**
   * Delegates to GraphController.graphUrl
   */
  get graphUrl(): URL | null {
    return this.#sca.controller.editor.graph.graphUrl;
  }

  /**
   * Delegates to GraphController.graphAssets
   */
  get graphAssets(): Map<AssetPath, GraphAsset> {
    return this.#sca.controller.editor.graph.graphAssets;
  }

  readonly organizer: Organizer;

  readonly renderer: RendererState;
  readonly integrations: Integrations;
  readonly fastAccess: FastAccess;
  readonly themes: ProjectThemeState;

  /**
   * Derives editable from SCA controller.
   */
  get #editable() {
    return this.#sca.controller.editor.graph.editor!;
  }

  constructor(clientManager: McpClientManager, sca: SCA) {
    this.#sca = sca;
    const editable = this.#editable;
    this.organizer = new ReactiveOrganizer(this);
    this.integrations = new IntegrationsImpl(clientManager, editable);
    this.fastAccess = new ReactiveFastAccess(
      new FilteredIntegrationsImpl(this.integrations.registered),
      this.#sca
    );
    this.renderer = new RendererStateImpl(this.graphAssets);

    this.run = ReactiveProjectRun.createInert(this.#editable.inspect(""));
    this.themes = new ThemeState(
      this.#sca.services.fetchWithCreds,
      editable,
      this
    );
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
      this.#sca,
      this.#sca.services.actionTracker,
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
      this.#sca.services.googleDriveBoardServer.dataPartTransformer()
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
}
