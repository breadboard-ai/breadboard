/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  EditableGraph,
  EditHistoryCreator,
  EditSpec,
  GraphDescriptor,
  MutableGraphStore,
  NodeConfiguration,
  NodeDescriptor,
  NodeIdentifier,
} from "@breadboard-ai/types";
import { RuntimeFlagManager } from "@breadboard-ai/types";
import { Tab, WorkspaceVisualChangeId, WorkspaceVisualState } from "./types.js";
import { RuntimeErrorEvent, RuntimeVisualChangeEvent } from "./events.js";
import { Edge, GraphIdentifier, NodeMetadata } from "@breadboard-ai/types";
import { MAIN_BOARD_ID } from "./util.js";
import * as BreadboardUI from "../ui/index.js";
import { AssetEdge, EdgeAttachmentPoint } from "../ui/types/types.js";
import { Autonamer } from "./autonamer.js";
import { SCA } from "../sca/sca.js";

export class Edit extends EventTarget {
  constructor(
    public readonly graphStore: MutableGraphStore,
    // These parameters are kept for backward compatibility but are no longer
    // used after the SCA migration. The autonamer is now accessed via services.
    _autonamer: Autonamer,
    _flags: RuntimeFlagManager,
    /** Here for migrations */
    private readonly __sca: SCA
  ) {
    super();
  }

  getEditor(_tab: Tab | null): EditableGraph | null {
    return this.__sca.controller.editor.graph.editor;
  }

  undo(_tab: Tab | null) {
    return this.__sca.actions.graph.undo();
  }

  redo(_tab: Tab | null) {
    return this.__sca.actions.graph.redo();
  }

  async processVisualChanges(
    tab: Tab | null,
    visualChangeId: WorkspaceVisualChangeId,
    visualState: WorkspaceVisualState
  ) {
    const editableGraph = this.getEditor(tab);
    if (!editableGraph) {
      this.dispatchEvent(new RuntimeErrorEvent("Unable to delete sub board"));
      return;
    }

    const edits: EditSpec[] = [];
    for (const [subGraphId, graphVisualState] of visualState) {
      let graphId = "";
      if (subGraphId !== MAIN_BOARD_ID) {
        graphId = subGraphId;
      }

      if (graphVisualState.graph) {
        const metadata = editableGraph.inspect(graphId).metadata() ?? {};
        const visual = { ...metadata.visual, ...graphVisualState.graph.visual };
        metadata.visual = visual;

        // Only subgraphs can be minimized.
        if (graphId === "") {
          delete metadata.visual.minimized;
        }

        edits.push({
          type: "changegraphmetadata",
          graphId,
          metadata,
        });
      }

      for (const [id, entityVisualState] of graphVisualState.nodes) {
        switch (entityVisualState.type) {
          case "comment": {
            const graphMetadata =
              editableGraph.inspect(graphId).metadata() ?? {};
            const commentNode = graphMetadata.comments?.find(
              (commentNode) => commentNode.id === id
            );

            if (commentNode && commentNode.metadata) {
              commentNode.metadata.visual = {
                x: entityVisualState.x,
                y: entityVisualState.y,
                collapsed: entityVisualState.expansionState,
                outputHeight: entityVisualState.outputHeight ?? 0,
              };
            }
            break;
          }

          case "node": {
            const existingMetadata =
              editableGraph.inspect(graphId).nodeById(id)?.metadata() ?? {};

            edits.push({
              type: "changemetadata",
              graphId,
              id: id,
              metadata: {
                ...existingMetadata,
                visual: {
                  x: entityVisualState.x,
                  y: entityVisualState.y,
                  collapsed: entityVisualState.expansionState,
                  outputHeight: entityVisualState.outputHeight ?? 0,
                },
              },
            });
          }
        }
      }
    }

    await editableGraph.edit(edits, visualChangeId);

    this.dispatchEvent(new RuntimeVisualChangeEvent(visualChangeId));
  }

  async changeEdge(
    _tab: Tab | null,
    changeType: "add" | "remove" | "move",
    from: Edge,
    to?: Edge,
    subGraphId: string | null = null
  ) {
    try {
      this.__sca.actions.graph.changeEdge(changeType, from, to, subGraphId);
    } catch (err) {
      this.dispatchEvent(new RuntimeErrorEvent(String(err)));
    }
  }

  async changeAssetEdge(
    tab: Tab | null,
    changeType: "add" | "remove",
    edge: AssetEdge,
    subGraphId: string | null = null
  ) {
    const editableGraph = this.getEditor(tab);
    const graphId = subGraphId || "";

    if (!editableGraph) {
      this.dispatchEvent(new RuntimeErrorEvent("Unable to find board to edit"));
      return;
    }

    const changing = await editableGraph.apply(
      new BreadboardUI.Transforms.ChangeAssetEdge(changeType, graphId, edge)
    );
    if (changing.success) return;

    this.dispatchEvent(new RuntimeErrorEvent(changing.error));
  }

  async changeEdgeAttachmentPoint(
    tab: Tab | null,
    graphId: GraphIdentifier,
    edge: Edge,
    which: "from" | "to",
    attachmentPoint: EdgeAttachmentPoint
  ) {
    const editableGraph = this.getEditor(tab);
    if (!editableGraph) {
      this.dispatchEvent(new RuntimeErrorEvent("Unable to find board to edit"));
      return;
    }

    const changing = await editableGraph.apply(
      new BreadboardUI.Transforms.ChangeEdgeAttachmentPoint(
        graphId,
        edge,
        which,
        attachmentPoint
      )
    );
    if (changing.success) return;

    this.dispatchEvent(new RuntimeErrorEvent(changing.error));
  }

  async updateNodeMetadata(
    tab: Tab | null,
    id: NodeIdentifier,
    metadata: NodeDescriptor["metadata"],
    subGraphId: string | null = null
  ) {
    if (tab?.readOnly) {
      return;
    }

    const editableGraph = this.getEditor(tab);
    const graphId = subGraphId || "";

    if (!editableGraph) {
      this.dispatchEvent(new RuntimeErrorEvent("Unable to find board to edit"));
      return;
    }

    const inspectableGraph = editableGraph.inspect(subGraphId);
    const existingNode = inspectableGraph.nodeById(id);
    const existingMetadata = existingNode?.metadata() || {};
    const newMetadata = {
      ...existingMetadata,
      ...metadata,
    };

    return editableGraph.edit(
      [{ type: "changemetadata", id, metadata: newMetadata, graphId }],
      `Change metadata for "${id}"`
    );
  }

  async multiEdit(tab: Tab | null, edits: EditSpec[], description: string) {
    if (tab?.readOnly) {
      return;
    }

    const editableGraph = this.getEditor(tab);

    if (!editableGraph) {
      console.warn("Unable to multi-edit; no active graph");
      return;
    }

    return editableGraph.edit(edits, description);
  }

  /**
   * @deprecated Use `sca.actions.graph.changeNodeConfiguration` instead.
   * This method is retained for backward compatibility during migration.
   */
  async changeNodeConfigurationPart(
    _tab: Tab | null,
    id: string,
    configurationPart: NodeConfiguration,
    subGraphId: string | null = null,
    metadata: NodeMetadata | null = null,
    ins: { path: string; title: string }[] | null = null
  ) {
    return this.__sca.actions.graph.changeNodeConfiguration(
      id,
      subGraphId ?? "",
      configurationPart,
      metadata,
      ins
    );
  }

  replaceGraph(
    tab: Tab | null,
    replacement: GraphDescriptor,
    creator: EditHistoryCreator
  ) {
    if (tab?.readOnly) {
      return;
    }
    const editableGraph = this.getEditor(tab);
    if (!editableGraph) {
      this.dispatchEvent(new RuntimeErrorEvent("Unable to find board to edit"));
      return;
    }
    return editableGraph.edit(
      [{ type: "replacegraph", replacement, creator }],
      `Replace graph`
    );
  }
}
