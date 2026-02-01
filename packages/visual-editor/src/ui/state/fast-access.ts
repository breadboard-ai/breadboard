/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AssetPath,
  EditableGraph,
  GraphIdentifier,
} from "@breadboard-ai/types";
import {
  Component,
  Components,
  FastAccess,
  FilterableMap,
  FilteredIntegrations,
  GraphAsset,
  StepEditor,
  Tool,
} from "./types.js";
import { FilteredMap } from "./utils/filtered-map.js";
import { signal } from "signal-utils";
import { willCreateCycle } from "@breadboard-ai/utils";

export { ReactiveFastAccess };

class ReactiveFastAccess implements FastAccess {
  readonly controlFlow: FilterableMap<Tool>;
  readonly routes: FilterableMap<Component>;

  @signal
  get #routes(): Map<string, Component> {
    const nodeSelection = this.stepEditor.nodeSelection;
    if (!nodeSelection) {
      return new Map();
    }
    const inspectable = this.editable?.inspect(nodeSelection.graph);
    if (!inspectable) {
      return new Map();
    }
    const node = inspectable.nodeById(nodeSelection.node);
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
  get components(): Map<GraphIdentifier, Components> {
    const nodeSelection = this.stepEditor.nodeSelection;
    if (!nodeSelection) {
      return this.allComponents;
    }
    const inspectable = this.editable?.inspect(nodeSelection.graph);
    if (!inspectable) {
      return this.allComponents;
    }
    const components = this.allComponents.get(nodeSelection.graph);
    if (!components) {
      return new Map();
    }

    const graph = inspectable.raw();

    const validComponents = [...components].filter(
      ([id]) => !willCreateCycle({ to: nodeSelection.node, from: id }, graph)
    );

    return new Map<GraphIdentifier, Components>([
      [nodeSelection.graph, new Map(validComponents)],
    ]);
  }

  constructor(
    public readonly graphAssets: Map<AssetPath, GraphAsset>,
    public readonly tools: Map<string, Tool>,
    public readonly myTools: Map<string, Tool>,
    unfilteredControlFlow: Map<string, Tool>,
    private readonly allComponents: Map<GraphIdentifier, Components>,
    public readonly integrations: FilteredIntegrations,
    private readonly editable: EditableGraph | undefined,
    private readonly stepEditor: Omit<StepEditor, "fastAccess">
  ) {
    this.controlFlow = new FilteredMap(() => unfilteredControlFlow);
    this.routes = new FilteredMap(() => this.#routes);
  }
}
