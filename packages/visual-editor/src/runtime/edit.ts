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
  Outcome,
} from "@breadboard-ai/types";
import {
  JsonSerializable,
  LLMContent,
  NodeExpectedOutput,
  RuntimeFlagManager,
} from "@breadboard-ai/types";
import { Tab, WorkspaceVisualChangeId, WorkspaceVisualState } from "./types.js";
import { RuntimeErrorEvent, RuntimeVisualChangeEvent } from "./events.js";
import { Edge, GraphIdentifier, NodeMetadata } from "@breadboard-ai/types";
import { MAIN_BOARD_ID } from "./util.js";
import * as BreadboardUI from "../ui/index.js";
import { AssetEdge, EdgeAttachmentPoint } from "../ui/types/types.js";
import { Autonamer } from "./autonamer.js";
import { err, filterUndefined, ok, toJson } from "@breadboard-ai/utils";
import { SCA } from "../sca/sca.js";

export type AutonameArguments = {
  nodeConfigurationUpdate: {
    type: string;
    configuration: NodeConfiguration;
  };
};

export type NotEnoughContextResult = {
  notEnoughContext: true;
};

export type NodeConfigurationUpdateResult = {
  title: string;
  description: string;
  expected_output?: NodeExpectedOutput[];
};

export type AutonameResult =
  | NotEnoughContextResult
  | NodeConfigurationUpdateResult;

export class Edit extends EventTarget {
  constructor(
    public readonly graphStore: MutableGraphStore,
    private readonly autonamer: Autonamer,
    private readonly flags: RuntimeFlagManager,
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

  async addNodeWithEdge(
    _tab: Tab | null,
    node: NodeDescriptor,
    edge: Edge,
    subGraphId: string | null = null
  ) {
    try {
      this.__sca.actions.graph.addNodeWithEdge(node, edge, subGraphId);
    } catch (err) {
      this.dispatchEvent(new RuntimeErrorEvent(String(err)));
    }
  }

  async changeEdge(
    tab: Tab | null,
    changeType: "add" | "remove" | "move",
    from: Edge,
    to?: Edge,
    subGraphId: string | null = null
  ) {
    const editableGraph = this.getEditor(tab);
    const graphId = subGraphId || "";

    if (!editableGraph) {
      this.dispatchEvent(new RuntimeErrorEvent("Unable to find board to edit"));
      return;
    }

    const changing = await editableGraph.apply(
      new BreadboardUI.Transforms.ChangeEdge(changeType, graphId, from, to)
    );
    if (changing.success) return;

    this.dispatchEvent(new RuntimeErrorEvent(changing.error));
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

  async #autonameInternal(
    editableGraph: EditableGraph,
    id: NodeIdentifier,
    graphId: string,
    configuration: NodeConfiguration,
    titleUserModified: boolean
  ): Promise<Outcome<void>> {
    const inspector = editableGraph.inspect(graphId);
    const node = inspector.nodeById(id);
    if (!node) {
      const msg = `Unable to find node with id: "${id}"`;
      console.error(msg);
      return err(msg);
    }
    const type = node.descriptor.type;

    const abortController = new AbortController();
    let graphChanged = false;
    editableGraph.addEventListener(
      "graphchange",
      () => {
        graphChanged = true;
        abortController.abort();
      },
      { once: true }
    );

    const outputs = await this.autonamer.autoname(
      asLLMContent({
        nodeConfigurationUpdate: { configuration, type },
      } satisfies AutonameArguments),
      abortController.signal
    );

    if (graphChanged) {
      // Graph changed in the middle of a task, throw away the results.
      const msg = "Results discarded due to graph change";
      console.log(msg);
      return err(msg);
    }
    if (!ok(outputs)) {
      console.error(outputs.$error);
      return outputs;
    }
    const generatingAutonames = toJson<AutonameResult>(outputs);
    if (!generatingAutonames) {
      return err(`Autonaming result not found`);
    }
    console.log("AUTONAMING RESULT", generatingAutonames);

    if ("notEnoughContext" in generatingAutonames) {
      console.log("Not enough context to autoname", id);
      return;
    }

    // Clip period at the end of the sentence that may occasionally crop up
    // in LLM response.
    const { description } = generatingAutonames;
    if (description.endsWith(".")) {
      generatingAutonames.description = description.slice(0, -1);
    }

    // For now, only edit titles and set `userModifed` so that the autoname
    // only works once.
    const metadata: NodeMetadata = filterUndefined({
      title: generatingAutonames.title,
      userModified: true,
      expected_output: generatingAutonames.expected_output,
    });

    if (titleUserModified) {
      delete metadata.title;
    }

    const applyingAutonames = await editableGraph.apply(
      new BreadboardUI.Transforms.UpdateNode(id, graphId, null, metadata, null)
    );
    if (!applyingAutonames.success) {
      console.warn("Failed to apply autoname", applyingAutonames.error);
    }
  }

  async changeNodeConfigurationPart(
    tab: Tab | null,
    id: string,
    configurationPart: NodeConfiguration,
    subGraphId: string | null = null,
    metadata: NodeMetadata | null = null,
    ins: { path: string; title: string }[] | null = null
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

    const updateNodeTransform = new BreadboardUI.Transforms.UpdateNode(
      id,
      graphId,
      configurationPart,
      metadata,
      ins
    );

    const editing = await editableGraph.apply(updateNodeTransform);
    if (!editing.success) {
      console.warn("Failed to change node configuration", editing.error);
      return;
    }

    const { titleUserModified } = updateNodeTransform;
    const enableOutputTemplates = (await this.flags.flags()).outputTemplates;

    if (!enableOutputTemplates && titleUserModified) {
      return;
    }

    return this.#autonameInternal(
      editableGraph,
      id,
      graphId,
      configurationPart,
      titleUserModified
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

function asLLMContent<T>(o: T): LLMContent[] {
  return [{ parts: [{ json: o as JsonSerializable }] }];
}
