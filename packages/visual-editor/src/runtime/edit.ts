/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  blankLLMContent,
  edit,
  EditableGraph,
  EditSpec,
  GraphDescriptor,
  GraphLoader,
  GraphProvider,
  Kit,
  NodeConfiguration,
  NodeDescriptor,
  NodeIdentifier,
} from "@google-labs/breadboard";
import { VETab, VETabId } from "./types";
import { VEEditEvent, VEErrorEvent } from "./events";
import { NodeMetadata } from "@google-labs/breadboard-schema/graph.js";

export class Edit extends EventTarget {
  #editors = new Map<VETabId, EditableGraph>();

  constructor(
    public readonly providers: GraphProvider[],
    public readonly loader: GraphLoader
  ) {
    super();
  }

  getEditor(tab: VETab | null, kits: Kit[]): EditableGraph | null {
    if (!tab) return null;
    if (!tab.graph) return null;
    if (this.#editors.get(tab.id)) return this.#editors.get(tab.id)!;

    const editor = edit(tab.graph, { kits, loader: this.loader });
    editor.addEventListener("graphchange", (evt) => {
      tab.graph = evt.graph;

      this.dispatchEvent(new VEEditEvent(evt.visualOnly));
    });

    editor.addEventListener("graphchangereject", (evt) => {
      tab.graph = evt.graph;

      const { reason } = evt;
      if (reason.type === "error") {
        this.dispatchEvent(new VEErrorEvent(reason.error));
      }
    });

    this.#editors.set(tab.id, editor);
    return editor;
  }

  getHistory(tab: VETab | null, kits: Kit[]) {
    const editableGraph = this.getEditor(tab, kits);
    if (!editableGraph) {
      this.dispatchEvent(new VEErrorEvent("Unable to edit graph"));
      return null;
    }

    return editableGraph.history();
  }

  canUndo(tab: VETab | null, kits: Kit[]) {
    const editableGraph = this.getEditor(tab, kits);
    if (!editableGraph) {
      this.dispatchEvent(new VEErrorEvent("Unable to edit graph"));
      return false;
    }

    const history = editableGraph.history();
    return history.canUndo();
  }

  undo(tab: VETab | null, kits: Kit[]) {
    const editableGraph = this.getEditor(tab, kits);
    if (!editableGraph) {
      this.dispatchEvent(new VEErrorEvent("Unable to edit graph"));
      return null;
    }

    const history = editableGraph.history();
    return history.undo();
  }

  canRedo(tab: VETab | null, kits: Kit[]) {
    const editableGraph = this.getEditor(tab, kits);
    if (!editableGraph) {
      this.dispatchEvent(new VEErrorEvent("Unable to edit graph"));
      return false;
    }

    const history = editableGraph.history();
    return history.canRedo();
  }

  redo(tab: VETab | null, kits: Kit[]) {
    const editableGraph = this.getEditor(tab, kits);
    if (!editableGraph) {
      this.dispatchEvent(new VEErrorEvent("Unable to edit graph"));
      return null;
    }

    const history = editableGraph.history();
    return history.redo();
  }

  updateSubBoardInfo(
    tab: VETab | null,
    kits: Kit[],
    subGraphId: string,
    title: string,
    version: string,
    description: string,
    status: "published" | "draft" | null,
    isTool: boolean | null
  ) {
    const editableGraph = this.getEditor(tab, kits);
    if (!editableGraph) {
      this.dispatchEvent(
        new VEErrorEvent("Unable to edit subboard; no active board")
      );
      return;
    }

    const subGraph = editableGraph.getGraph(subGraphId);
    if (!subGraph) {
      this.dispatchEvent(
        new VEErrorEvent(`Unable to find subboard with id ${subGraphId}`)
      );
      return;
    }

    const subGraphDescriptor = subGraph.raw();
    this.#updateGraphValues(
      subGraphDescriptor,
      title,
      version,
      description,
      status,
      isTool
    );

    editableGraph.replaceGraph(subGraphId, subGraphDescriptor);
  }

  updateBoardInfo(
    tab: VETab | null,
    title: string,
    version: string,
    description: string,
    status: "published" | "draft" | null,
    isTool: boolean | null
  ) {
    if (!tab) {
      this.dispatchEvent(new VEErrorEvent("Unable to find tab"));
      return null;
    }

    this.#updateGraphValues(
      tab.graph,
      title,
      version,
      description,
      status,
      isTool
    );
  }

  #updateGraphValues(
    graph: GraphDescriptor,
    title: string,
    version: string,
    description: string,
    status: "published" | "draft" | null,
    isTool: boolean | null
  ) {
    graph.title = title;
    graph.version = version;
    graph.description = description;

    if (status) {
      graph.metadata ??= {};
      graph.metadata.tags ??= [];

      switch (status) {
        case "published": {
          if (!graph.metadata.tags.includes("published")) {
            graph.metadata.tags.push("published");
          }
          break;
        }

        case "draft": {
          graph.metadata.tags = graph.metadata.tags.filter(
            (tag) => tag !== "published"
          );
          break;
        }
      }
    }

    if (isTool !== null) {
      graph.metadata ??= {};
      graph.metadata.tags ??= [];

      if (isTool) {
        if (!graph.metadata.tags.includes("tool")) {
          graph.metadata.tags.push("tool");
        }
      } else {
        graph.metadata.tags = graph.metadata.tags.filter(
          (tag) => tag !== "tool"
        );
      }
    }
  }

  createSubGraph(tab: VETab | null, kits: Kit[], subGraphTitle: string) {
    const editableGraph = this.getEditor(tab, kits);
    if (!editableGraph) {
      this.dispatchEvent(new VEErrorEvent("Unable to create sub board"));
      return;
    }

    const id = globalThis.crypto.randomUUID();
    const board = blankLLMContent();
    board.title = subGraphTitle;

    const editResult = editableGraph.addGraph(id, board);
    if (!editResult) {
      return null;
    }

    return id;
  }

  deleteSubGraph(tab: VETab | null, kits: Kit[], subGraphId: string) {
    const editableGraph = this.getEditor(tab, kits);
    if (!editableGraph) {
      this.dispatchEvent(new VEErrorEvent("Unable to delete sub board"));
      return;
    }

    const editResult = editableGraph.removeGraph(subGraphId);
    if (!editResult.success) {
      return null;
    }

    if (subGraphId === tab?.subGraphId) {
      tab.subGraphId = null;
    }
  }

  changeEdge(
    tab: VETab | null,
    kits: Kit[],
    changeType: "add" | "remove" | "move",
    from: {
      from: string;
      to: string;
      in: string;
      out: string;
      constant?: boolean;
    },
    to?: {
      from: string;
      to: string;
      in: string;
      out: string;
      constant?: boolean;
    },
    subGraphId: string | null = null
  ) {
    let editableGraph = this.getEditor(tab, kits);

    if (editableGraph && subGraphId) {
      editableGraph = editableGraph.getGraph(subGraphId);
    }

    if (!editableGraph) {
      this.dispatchEvent(new VEErrorEvent("Unable to find board to edit"));
      return;
    }

    switch (changeType) {
      case "add": {
        editableGraph.edit(
          [{ type: "addedge", edge: from }],
          `Add edge between ${from.from} and ${from.to}`
        );
        break;
      }

      case "remove": {
        editableGraph.edit(
          [{ type: "removeedge", edge: from }],
          `Remove edge between ${from.from} and ${from.to}`
        );
        break;
      }

      case "move": {
        if (!to) {
          this.dispatchEvent(
            new VEErrorEvent("Unable to move edge - no `to` provided")
          );
          return;
        }

        editableGraph.edit(
          [
            {
              type: "changeedge",
              from: from,
              to: to,
            },
          ],
          `Change edge from between ${from.from} and ${from.to} to ${to.from} and ${to.to}`
        );
        break;
      }
    }
  }

  createNode(
    tab: VETab | null,
    kits: Kit[],
    id: string,
    nodeType: string,
    configuration: NodeConfiguration | null = null,
    metadata: NodeMetadata | null = null,
    subGraphId: string | null = null
  ) {
    const newNode = {
      id,
      type: nodeType,
      metadata: metadata || undefined,
      configuration: configuration || undefined,
    };

    let editableGraph = this.getEditor(tab, kits);
    if (editableGraph && subGraphId) {
      editableGraph = editableGraph.getGraph(subGraphId);
    }

    if (!editableGraph) {
      this.dispatchEvent(new VEErrorEvent("Unable to find board to edit"));
      return;
    }

    // Comment nodes are stored in the metadata for the graph
    if (nodeType === "comment") {
      console.log("Creating comment", metadata);
      const inspectableGraph = editableGraph.inspect();
      if (!metadata) {
        return;
      }

      const graphMetadata = inspectableGraph.metadata() || {};
      graphMetadata.comments = graphMetadata.comments || [];
      graphMetadata.comments.push({
        id,
        text: "",
        metadata,
      });

      editableGraph.edit(
        [{ type: "changegraphmetadata", metadata: graphMetadata }],
        `Change metadata for graph - add comment "${id}"`
      );
      return;
    }

    editableGraph.edit([{ type: "addnode", node: newNode }], `Add node ${id}`);
  }

  updateNodeMetadata(
    tab: VETab | null,
    kits: Kit[],
    id: NodeIdentifier,
    metadata: NodeDescriptor["metadata"],
    subGraphId: string | null = null
  ) {
    let editableGraph = this.getEditor(tab, kits);
    if (editableGraph && subGraphId) {
      editableGraph = editableGraph.getGraph(subGraphId);
    }

    if (!editableGraph) {
      this.dispatchEvent(new VEErrorEvent("Unable to find board to edit"));
      return;
    }

    const inspectableGraph = editableGraph.inspect();
    const existingNode = inspectableGraph.nodeById(id);
    const existingMetadata = existingNode?.metadata() || {};
    const newMetadata = {
      ...existingMetadata,
      ...metadata,
    };

    editableGraph.edit(
      [{ type: "changemetadata", id, metadata: newMetadata }],
      `Change metadata for "${id}"`
    );
  }

  multiEdit(
    tab: VETab | null,
    kits: Kit[],
    edits: EditSpec[],
    description: string,
    subGraphId: string | null = null
  ) {
    let editableGraph = this.getEditor(tab, kits);
    if (editableGraph && subGraphId) {
      editableGraph = editableGraph.getGraph(subGraphId);
    }

    if (!editableGraph) {
      console.warn("Unable to multi-edit; no active graph");
      return;
    }

    editableGraph.edit(edits, description);
  }

  changeComment(
    tab: VETab | null,
    kits: Kit[],
    id: string,
    text: string,
    subGraphId: string | null = null
  ) {
    let editableGraph = this.getEditor(tab, kits);
    if (editableGraph && subGraphId) {
      editableGraph = editableGraph.getGraph(subGraphId);
    }

    if (!editableGraph) {
      this.dispatchEvent(new VEErrorEvent("Unable to find board to edit"));
      return;
    }

    const inspectableGraph = editableGraph.inspect();
    const graphMetadata = inspectableGraph.metadata() || {};
    graphMetadata.comments ??= [];

    const comment = graphMetadata.comments.find((comment) => comment.id === id);
    if (!comment) {
      console.warn("Unable to update comment; not found");
      return;
    }

    comment.text = text;
    editableGraph.edit(
      [{ type: "changegraphmetadata", metadata: graphMetadata }],
      `Change metadata for graph - add comment "${id}"`
    );
  }

  changeNodeConfiguration(
    tab: VETab | null,
    kits: Kit[],
    id: string,
    configuration: NodeConfiguration,
    subGraphId: string | null = null
  ) {
    let editableGraph = this.getEditor(tab, kits);
    if (editableGraph && subGraphId) {
      editableGraph = editableGraph.getGraph(subGraphId);
    }

    if (!editableGraph) {
      this.dispatchEvent(new VEErrorEvent("Unable to find board to edit"));
      return;
    }

    editableGraph.edit(
      [
        {
          type: "changeconfiguration",
          id,
          configuration,
          reset: true,
        },
      ],
      `Change configuration for "${id}"`
    );
  }

  changeNodeConfigurationPart(
    tab: VETab | null,
    kits: Kit[],
    id: string,
    configurationPart: NodeConfiguration,
    subGraphId: string | null = null
  ) {
    let editableGraph = this.getEditor(tab, kits);
    if (editableGraph && subGraphId) {
      editableGraph = editableGraph.getGraph(subGraphId);
    }

    if (!editableGraph) {
      this.dispatchEvent(new VEErrorEvent("Unable to find board to edit"));
      return;
    }

    const inspectableNode = editableGraph.inspect().nodeById(id);
    const configuration = inspectableNode?.descriptor.configuration ?? {};
    const updatedConfiguration = structuredClone(configuration);
    for (const [key, value] of Object.entries(configurationPart)) {
      if (value === null || value === undefined) {
        delete updatedConfiguration[key];
        continue;
      }

      updatedConfiguration[key] = value;
    }

    editableGraph.edit(
      [
        {
          type: "changeconfiguration",
          id: id,
          configuration: updatedConfiguration,
          reset: true,
        },
      ],
      `Change partial configuration for "${id}"`
    );
  }

  deleteNode(
    tab: VETab | null,
    kits: Kit[],
    id: string,
    subGraphId: string | null = null
  ) {
    let editableGraph = this.getEditor(tab, kits);
    if (editableGraph && subGraphId) {
      editableGraph = editableGraph.getGraph(subGraphId);
    }

    if (!editableGraph) {
      this.dispatchEvent(new VEErrorEvent("Unable to find board to edit"));
      return;
    }

    editableGraph.edit([{ type: "removenode", id: id }], `Remove node ${id}`);
  }
}
