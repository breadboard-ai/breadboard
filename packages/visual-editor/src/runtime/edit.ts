/**
 * @license
 * Copyright 2024 Google LLC
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
import { EnhanceSideboard, Tab, TabId } from "./types";
import {
  RuntimeBoardEditEvent,
  RuntimeBoardEnhanceEvent,
  RuntimeErrorEvent,
} from "./events";
import { NodeMetadata } from "@breadboard-ai/types";

export class Edit extends EventTarget {
  #editors = new Map<TabId, EditableGraph>();

  constructor(
    public readonly providers: GraphProvider[],
    public readonly loader: GraphLoader,
    public readonly kits: Kit[]
  ) {
    super();
  }

  getEditor(
    tab: Tab | null,
    subGraphId: string | null = null
  ): EditableGraph | null {
    if (!tab) return null;
    if (!tab.graph) return null;
    if (this.#editors.get(tab.id)) {
      const editor = this.#editors.get(tab.id)!;
      if (subGraphId) {
        return editor.getGraph(subGraphId);
      }

      return editor;
    }

    const editor = edit(tab.graph, { kits: tab.kits, loader: this.loader });
    editor.addEventListener("graphchange", (evt) => {
      tab.graph = evt.graph;
      this.dispatchEvent(
        new RuntimeBoardEditEvent(
          tab.id,
          evt.visualOnly ? [] : evt.affectedNodes,
          evt.visualOnly
        )
      );
    });

    editor.addEventListener("graphchangereject", (evt) => {
      tab.graph = evt.graph;

      const { reason } = evt;
      if (reason.type === "error") {
        this.dispatchEvent(new RuntimeErrorEvent(reason.error));
      }
    });

    this.#editors.set(tab.id, editor);
    if (subGraphId) {
      return editor.getGraph(subGraphId);
    }
    return editor;
  }

  getHistory(tab: Tab | null) {
    const editableGraph = this.getEditor(tab);
    if (!editableGraph) {
      this.dispatchEvent(new RuntimeErrorEvent("Unable to edit graph"));
      return null;
    }

    return editableGraph.history();
  }

  getGraphComment(
    tab: Tab | null,
    id: string,
    subGraphId: string | null = null
  ) {
    const editableGraph = this.getEditor(tab, subGraphId);
    if (!editableGraph) {
      this.dispatchEvent(new RuntimeErrorEvent("Unable to edit graph"));
      return null;
    }

    return (
      editableGraph
        .inspect()
        .metadata()
        ?.comments?.find((comment) => comment.id === id) ?? null
    );
  }

  getNodeTitle(tab: Tab | null, id: string, subGraphId: string | null = null) {
    const editableGraph = this.getEditor(tab, subGraphId);
    if (!editableGraph) {
      this.dispatchEvent(new RuntimeErrorEvent("Unable to edit graph"));
      return null;
    }

    return editableGraph.inspect().nodeById(id)?.title() ?? null;
  }

  getNodeType(tab: Tab | null, id: string, subGraphId: string | null = null) {
    const editableGraph = this.getEditor(tab, subGraphId);
    if (!editableGraph) {
      this.dispatchEvent(new RuntimeErrorEvent("Unable to edit graph"));
      return null;
    }

    return editableGraph.inspect().nodeById(id)?.type().metadata() ?? null;
  }

  getNodeMetadata(
    tab: Tab | null,
    id: string,
    subGraphId: string | null = null
  ) {
    const editableGraph = this.getEditor(tab, subGraphId);
    if (!editableGraph) {
      this.dispatchEvent(new RuntimeErrorEvent("Unable to edit graph"));
      return null;
    }

    return editableGraph.inspect().nodeById(id)?.metadata() ?? null;
  }

  getNodeConfiguration(
    tab: Tab | null,
    id: string,
    subGraphId: string | null = null
  ) {
    const editableGraph = this.getEditor(tab, subGraphId);
    if (!editableGraph) {
      this.dispatchEvent(new RuntimeErrorEvent("Unable to edit graph"));
      return null;
    }

    return editableGraph.inspect().nodeById(id)?.configuration() ?? null;
  }

  getNodePorts(tab: Tab | null, id: string, subGraphId: string | null = null) {
    const editableGraph = this.getEditor(tab, subGraphId);
    if (!editableGraph) {
      this.dispatchEvent(new RuntimeErrorEvent("Unable to edit graph"));
      return null;
    }

    return editableGraph.inspect().nodeById(id)?.ports() ?? null;
  }

  canUndo(tab: Tab | null) {
    const editableGraph = this.getEditor(tab);
    if (!editableGraph) {
      this.dispatchEvent(new RuntimeErrorEvent("Unable to edit graph"));
      return false;
    }

    const history = editableGraph.history();
    return history.canUndo();
  }

  undo(tab: Tab | null) {
    const editableGraph = this.getEditor(tab);
    if (!editableGraph) {
      this.dispatchEvent(new RuntimeErrorEvent("Unable to edit graph"));
      return null;
    }

    const history = editableGraph.history();
    return history.undo();
  }

  canRedo(tab: Tab | null) {
    const editableGraph = this.getEditor(tab);
    if (!editableGraph) {
      this.dispatchEvent(new RuntimeErrorEvent("Unable to edit graph"));
      return false;
    }

    const history = editableGraph.history();
    return history.canRedo();
  }

  redo(tab: Tab | null) {
    const editableGraph = this.getEditor(tab);
    if (!editableGraph) {
      this.dispatchEvent(new RuntimeErrorEvent("Unable to edit graph"));
      return null;
    }

    const history = editableGraph.history();
    return history.redo();
  }

  updateSubBoardInfo(
    tab: Tab | null,
    subGraphId: string,
    title: string,
    version: string,
    description: string,
    status: "published" | "draft" | null,
    isTool: boolean | null
  ) {
    const editableGraph = this.getEditor(tab);
    if (!editableGraph) {
      this.dispatchEvent(
        new RuntimeErrorEvent("Unable to edit subboard; no active board")
      );
      return;
    }

    const subGraph = editableGraph.getGraph(subGraphId);
    if (!subGraph) {
      this.dispatchEvent(
        new RuntimeErrorEvent(`Unable to find subboard with id ${subGraphId}`)
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

  deleteComment(tab: Tab | null, id: string) {
    if (!tab) {
      this.dispatchEvent(new RuntimeErrorEvent("Unable to find tab"));
      return null;
    }

    const graph = tab.graph;
    graph.metadata ??= {};
    graph.metadata.comments ??= [];

    graph.metadata.comments = graph.metadata.comments.filter(
      (comment) => comment.id !== id
    );
    this.dispatchEvent(new RuntimeBoardEditEvent(tab.id, [], false));
  }

  updateBoardInfo(
    tab: Tab | null,
    title: string,
    version: string,
    description: string,
    status: "published" | "draft" | null,
    isTool: boolean | null
  ) {
    if (!tab) {
      this.dispatchEvent(new RuntimeErrorEvent("Unable to find tab"));
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

    // TODO: Plumb Tab ID here.
    this.dispatchEvent(new RuntimeBoardEditEvent(null, [], false));
  }

  createSubGraph(tab: Tab | null, subGraphTitle: string) {
    const editableGraph = this.getEditor(tab);
    if (!editableGraph) {
      this.dispatchEvent(new RuntimeErrorEvent("Unable to create sub board"));
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

  deleteSubGraph(tab: Tab | null, subGraphId: string) {
    const editableGraph = this.getEditor(tab);
    if (!editableGraph) {
      this.dispatchEvent(new RuntimeErrorEvent("Unable to delete sub board"));
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
    tab: Tab | null,
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
    let editableGraph = this.getEditor(tab);

    if (editableGraph && subGraphId) {
      editableGraph = editableGraph.getGraph(subGraphId);
    }

    if (!editableGraph) {
      this.dispatchEvent(new RuntimeErrorEvent("Unable to find board to edit"));
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
            new RuntimeErrorEvent("Unable to move edge - no `to` provided")
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

  async createNode(
    tab: Tab | null,
    id: string,
    nodeType: string,
    configuration: NodeConfiguration | null = null,
    metadata: NodeMetadata | null = null,
    subGraphId: string | null = null
  ) {
    if (tab?.readOnly) {
      return;
    }

    let editableGraph = this.getEditor(tab);
    if (editableGraph && subGraphId) {
      editableGraph = editableGraph.getGraph(subGraphId);
    }

    if (!editableGraph) {
      this.dispatchEvent(new RuntimeErrorEvent("Unable to find board to edit"));
      return;
    }

    const inspectableGraph = editableGraph.inspect();
    const title = (await inspectableGraph.typeById(nodeType)?.metadata())
      ?.title;

    if (title) {
      metadata ??= {};
      metadata.title = title;
    }

    const newNode = {
      id,
      type: nodeType,
      metadata: metadata || undefined,
      configuration: configuration || undefined,
    };

    // Comment nodes are stored in the metadata for the graph
    if (nodeType === "comment") {
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
    tab: Tab | null,
    id: NodeIdentifier,
    metadata: NodeDescriptor["metadata"],
    subGraphId: string | null = null
  ) {
    if (tab?.readOnly) {
      return;
    }

    let editableGraph = this.getEditor(tab);
    if (editableGraph && subGraphId) {
      editableGraph = editableGraph.getGraph(subGraphId);
    }

    if (!editableGraph) {
      this.dispatchEvent(new RuntimeErrorEvent("Unable to find board to edit"));
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
    tab: Tab | null,
    edits: EditSpec[],
    description: string,
    subGraphId: string | null = null
  ) {
    if (tab?.readOnly) {
      return;
    }

    let editableGraph = this.getEditor(tab);
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
    tab: Tab | null,
    id: string,
    text: string,
    subGraphId: string | null = null
  ) {
    if (tab?.readOnly) {
      return;
    }

    let editableGraph = this.getEditor(tab);
    if (editableGraph && subGraphId) {
      editableGraph = editableGraph.getGraph(subGraphId);
    }

    if (!editableGraph) {
      this.dispatchEvent(new RuntimeErrorEvent("Unable to find board to edit"));
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
    tab: Tab | null,
    id: string,
    configuration: NodeConfiguration,
    subGraphId: string | null = null
  ) {
    if (tab?.readOnly) {
      return;
    }

    let editableGraph = this.getEditor(tab);
    if (editableGraph && subGraphId) {
      editableGraph = editableGraph.getGraph(subGraphId);
    }

    if (!editableGraph) {
      this.dispatchEvent(new RuntimeErrorEvent("Unable to find board to edit"));
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

  async enhanceNodeConfiguration(
    tab: Tab | null,
    subGraphId: string | null,
    id: string,
    sideboard: EnhanceSideboard
  ) {
    if (!tab) {
      return;
    }

    if (tab?.readOnly) {
      return;
    }

    let editableGraph = this.getEditor(tab);
    if (editableGraph && subGraphId) {
      editableGraph = editableGraph.getGraph(subGraphId);
    }

    if (!editableGraph) {
      this.dispatchEvent(new RuntimeErrorEvent("Unable to find board to edit"));
      return;
    }

    const inspectableNode = editableGraph.inspect().nodeById(id);
    const configuration = inspectableNode?.descriptor.configuration ?? {};
    const result = await sideboard.enhance(structuredClone(configuration));

    if (!result.success) {
      this.dispatchEvent(
        new RuntimeErrorEvent(`Enhancing failed with error: ${result.error}`)
      );
      return;
    }

    this.dispatchEvent(
      new RuntimeBoardEnhanceEvent(tab.id, [id], result.result)
    );
  }

  changeNodeConfigurationPart(
    tab: Tab | null,
    id: string,
    configurationPart: NodeConfiguration,
    subGraphId: string | null = null,
    metadata: NodeMetadata | null = null
  ) {
    if (tab?.readOnly) {
      return;
    }

    let editableGraph = this.getEditor(tab);
    if (editableGraph && subGraphId) {
      editableGraph = editableGraph.getGraph(subGraphId);
    }

    if (!editableGraph) {
      this.dispatchEvent(new RuntimeErrorEvent("Unable to find board to edit"));
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

    const edits: EditSpec[] = [
      {
        type: "changeconfiguration",
        id: id,
        configuration: updatedConfiguration,
        reset: true,
      },
    ];

    if (metadata) {
      const existingMetadata = inspectableNode?.metadata() || {};
      const newMetadata = {
        ...existingMetadata,
        ...metadata,
      };

      edits.push({ type: "changemetadata", id, metadata: newMetadata }),
        `Change metadata for "${id}"`;
    }

    editableGraph.edit(edits, `Change partial configuration for "${id}"`);
  }

  deleteNode(tab: Tab | null, id: string, subGraphId: string | null = null) {
    if (tab?.readOnly) {
      return;
    }

    let editableGraph = this.getEditor(tab);
    if (editableGraph && subGraphId) {
      editableGraph = editableGraph.getGraph(subGraphId);
    }

    if (!editableGraph) {
      this.dispatchEvent(new RuntimeErrorEvent("Unable to find board to edit"));
      return;
    }

    editableGraph.edit([{ type: "removenode", id: id }], `Remove node ${id}`);
  }
}
