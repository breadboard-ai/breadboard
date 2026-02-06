/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AssetPath, GraphIdentifier } from "@breadboard-ai/types";
import {
  Component,
  Components,
  FastAccess,
  FilterableMap,
  FilteredIntegrations,
  GraphAsset,
  Tool,
} from "./types.js";
import { FilteredMap } from "./utils/filtered-map.js";
import { signal } from "signal-utils";
import { willCreateCycle } from "@breadboard-ai/utils";
import { SCA } from "../../sca/sca.js";

export { ReactiveFastAccess };

class ReactiveFastAccess implements FastAccess {
  readonly agentMode: FilterableMap<Tool>;
  readonly routes: FilterableMap<Component>;

  /**
   * Derives graphAssets from SCA controller.
   */
  get graphAssets(): Map<AssetPath, GraphAsset> {
    return this.sca.controller.editor.graph.graphAssets;
  }

  /**
   * Derives tools from SCA controller.
   */
  get tools(): ReadonlyMap<string, Tool> {
    return this.sca.controller.editor.graph.tools;
  }

  /**
   * Derives myTools from SCA controller.
   */
  get myTools(): ReadonlyMap<string, Tool> {
    return this.sca.controller.editor.graph.myTools;
  }

  @signal
  get #routes(): Map<string, Component> {
    const selectedNodeId = this.sca.controller.editor.graph.selectedNodeId;
    if (!selectedNodeId) {
      return new Map();
    }
    const inspectable = this.sca.controller.editor.graph.editor?.inspect("");
    if (!inspectable) {
      return new Map();
    }
    const node = inspectable.nodeById(selectedNodeId);
    if (!node) {
      return new Map();
    }
    return new Map<string, Component>(
      node.outgoing().map((edge) => {
        const node = edge.to;
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

  @signal
  get components(): ReadonlyMap<GraphIdentifier, Components> {
    const allComponents = this.sca.controller.editor.graph.components;
    const selectedNodeId = this.sca.controller.editor.graph.selectedNodeId;

    if (!selectedNodeId) {
      return allComponents;
    }
    const inspectable = this.sca.controller.editor.graph.editor?.inspect("");
    if (!inspectable) {
      return allComponents;
    }
    const components = allComponents.get("");
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

  constructor(
    public readonly integrations: FilteredIntegrations,
    private readonly sca: SCA
  ) {
    this.agentMode = new FilteredMap(
      () => this.sca.controller.editor.graph.agentModeTools
    );
    this.routes = new FilteredMap(() => this.#routes);
  }
}
