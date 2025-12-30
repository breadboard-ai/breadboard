/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AssetPath,
  EditableGraph,
  GraphIdentifier,
  ParameterMetadata,
} from "@breadboard-ai/types";
import {
  Component,
  Components,
  FastAccess,
  FilteredIntegrations,
  GraphAsset,
  StepEditor,
  Tool,
} from "./types.js";
import { FilteredMap } from "./utils/filtered-map.js";
import { signal } from "signal-utils";

export { ReactiveFastAccess };

class ReactiveFastAccess implements FastAccess {
  readonly controlFlow: FilteredMap<Tool>;

  @signal
  get routes(): Map<string, Component> {
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
    return new Map(
      node.outgoing().map((edge) => {
        const id = edge.to.descriptor.id;
        return [
          id,
          {
            id,
            title: edge.to.title(),
          },
        ];
      })
    );
  }

  constructor(
    public readonly graphAssets: Map<AssetPath, GraphAsset>,
    public readonly tools: Map<string, Tool>,
    public readonly myTools: Map<string, Tool>,
    unfilteredControlFlow: Map<string, Tool>,
    public readonly components: Map<GraphIdentifier, Components>,
    public readonly parameters: Map<string, ParameterMetadata>,
    public readonly integrations: FilteredIntegrations,
    private readonly editable: EditableGraph | undefined,
    private readonly stepEditor: Omit<StepEditor, "fastAccess">
  ) {
    this.controlFlow = new FilteredMap(unfilteredControlFlow);
  }
}
