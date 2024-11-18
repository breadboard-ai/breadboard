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
import {
  GraphTag,
  Module,
  ModuleCode,
  ModuleIdentifier,
  ModuleLanguage,
  ModuleMetadata,
  NodeMetadata,
  NodeValue,
} from "@breadboard-ai/types";
import { Sandbox } from "@breadboard-ai/jsandbox";

export class Edit extends EventTarget {
  #editors = new Map<TabId, EditableGraph>();

  constructor(
    public readonly providers: GraphProvider[],
    public readonly loader: GraphLoader,
    public readonly kits: Kit[],
    public readonly sandbox: Sandbox
  ) {
    super();
  }

  getEditor(tab: Tab | null): EditableGraph | null {
    if (!tab) return null;
    if (!tab.graph) return null;
    if (this.#editors.get(tab.id)) {
      return this.#editors.get(tab.id)!;
    }

    const editor = edit(tab.graph, {
      kits: tab.kits,
      loader: this.loader,
      sandbox: this.sandbox,
    });
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
    return editor;
  }

  getHistory(tab: Tab | null) {
    if (!tab) {
      return null;
    }

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
    if (!tab) {
      return null;
    }

    const editableGraph = this.getEditor(tab);
    if (!editableGraph) {
      this.dispatchEvent(new RuntimeErrorEvent("Unable to edit graph"));
      return null;
    }

    return (
      editableGraph
        .inspect(subGraphId)
        .metadata()
        ?.comments?.find((comment) => comment.id === id) ?? null
    );
  }

  getNodeTitle(tab: Tab | null, id: string, subGraphId: string | null = null) {
    if (!tab) {
      return null;
    }

    const editableGraph = this.getEditor(tab);
    if (!editableGraph) {
      this.dispatchEvent(new RuntimeErrorEvent("Unable to edit graph"));
      return null;
    }

    return editableGraph.inspect(subGraphId).nodeById(id)?.title() ?? null;
  }

  getNodeType(tab: Tab | null, id: string, subGraphId: string | null = null) {
    if (!tab) {
      return null;
    }

    const editableGraph = this.getEditor(tab);
    if (!editableGraph) {
      this.dispatchEvent(new RuntimeErrorEvent("Unable to edit graph"));
      return null;
    }

    return (
      editableGraph.inspect(subGraphId).nodeById(id)?.type().metadata() ?? null
    );
  }

  getNodeMetadata(
    tab: Tab | null,
    id: string,
    subGraphId: string | null = null
  ) {
    if (!tab) {
      return null;
    }

    const editableGraph = this.getEditor(tab);
    if (!editableGraph) {
      this.dispatchEvent(new RuntimeErrorEvent("Unable to edit graph"));
      return null;
    }

    return editableGraph.inspect(subGraphId).nodeById(id)?.metadata() ?? null;
  }

  getNodeConfiguration(
    tab: Tab | null,
    id: string,
    subGraphId: string | null = null
  ) {
    if (!tab) {
      return null;
    }

    const editableGraph = this.getEditor(tab);
    if (!editableGraph) {
      this.dispatchEvent(new RuntimeErrorEvent("Unable to edit graph"));
      return null;
    }

    return (
      editableGraph.inspect(subGraphId).nodeById(id)?.configuration() ?? null
    );
  }

  getNodePorts(tab: Tab | null, id: string, subGraphId: string | null = null) {
    if (!tab) {
      return null;
    }

    const editableGraph = this.getEditor(tab);
    if (!editableGraph) {
      this.dispatchEvent(new RuntimeErrorEvent("Unable to edit graph"));
      return null;
    }

    return editableGraph.inspect(subGraphId).nodeById(id)?.ports() ?? null;
  }

  canUndo(tab: Tab | null): boolean {
    if (!tab) {
      return false;
    }

    const editableGraph = this.getEditor(tab);
    if (!editableGraph) {
      this.dispatchEvent(new RuntimeErrorEvent("Unable to edit graph"));
      return false;
    }

    const history = editableGraph.history();
    return history.canUndo();
  }

  undo(tab: Tab | null) {
    if (!tab) {
      return null;
    }

    const editableGraph = this.getEditor(tab);
    if (!editableGraph) {
      this.dispatchEvent(new RuntimeErrorEvent("Unable to edit graph"));
      return null;
    }

    const history = editableGraph.history();
    return history.undo();
  }

  canRedo(tab: Tab | null) {
    if (!tab) {
      return false;
    }

    const editableGraph = this.getEditor(tab);
    if (!editableGraph) {
      this.dispatchEvent(new RuntimeErrorEvent("Unable to edit graph"));
      return false;
    }

    const history = editableGraph.history();
    return history.canRedo();
  }

  redo(tab: Tab | null) {
    if (!tab) {
      return null;
    }

    const editableGraph = this.getEditor(tab);
    if (!editableGraph) {
      this.dispatchEvent(new RuntimeErrorEvent("Unable to edit graph"));
      return null;
    }

    const history = editableGraph.history();
    return history.redo();
  }

  async updateSubBoardInfo(
    tab: Tab | null,
    subGraphId: string,
    title: string,
    version: string,
    description: string,
    status: "published" | "draft" | null,
    isTool: boolean | null,
    isComponent: boolean | null
  ) {
    const editableGraph = this.getEditor(tab);
    if (!editableGraph) {
      this.dispatchEvent(
        new RuntimeErrorEvent("Unable to edit subboard; no active board")
      );
      return;
    }

    const subGraph = editableGraph.raw().graphs?.[subGraphId];
    if (!subGraph) {
      this.dispatchEvent(
        new RuntimeErrorEvent(`Unable to find subboard with id ${subGraphId}`)
      );
      return;
    }

    const subGraphDescriptor = subGraph;
    this.#updateGraphValues(
      subGraphDescriptor,
      title,
      version,
      description,
      status,
      isTool,
      isComponent
    );

    await editableGraph.edit(
      [
        { type: "removegraph", id: subGraphId },
        { type: "addgraph", id: subGraphId, graph: subGraphDescriptor },
      ],
      `Replacing graph "${title}"`
    );

    // editableGraph.replaceGraph(subGraphId, subGraphDescriptor);
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

  createModule(
    tab: Tab | null,
    moduleId: ModuleIdentifier,
    module: Module,
    switchToCreatedModule = true
  ) {
    if (!tab) {
      return null;
    }

    const editableGraph = this.getEditor(tab);
    if (!editableGraph) {
      this.dispatchEvent(new RuntimeErrorEvent("Unable to edit graph"));
      return null;
    }

    editableGraph
      .edit(
        [
          {
            type: "addmodule",
            id: moduleId,
            module,
          },
        ],
        `Add module ${moduleId}`
      )
      .then(() => {
        if (!switchToCreatedModule) {
          return;
        }

        tab.moduleId = moduleId;
      });
  }

  deleteModule(tab: Tab | null, moduleId: ModuleIdentifier) {
    if (!tab) {
      return null;
    }

    const editableGraph = this.getEditor(tab);
    if (!editableGraph) {
      this.dispatchEvent(new RuntimeErrorEvent("Unable to edit graph"));
      return null;
    }

    editableGraph.edit(
      [
        {
          type: "removemodule",
          id: moduleId,
        },
      ],
      `Delete module ${moduleId}`
    );
  }

  changeModuleLanguage(
    tab: Tab | null,
    moduleId: ModuleIdentifier,
    language: ModuleLanguage
  ) {
    if (!tab) {
      return null;
    }

    const editableGraph = this.getEditor(tab);
    if (!editableGraph) {
      this.dispatchEvent(new RuntimeErrorEvent("Unable to edit graph"));
      return null;
    }

    const module = editableGraph.inspect("").moduleById(moduleId);
    if (!module) {
      return null;
    }

    const newModule: Module = {
      code: module.code(),
      metadata: module.metadata(),
    };

    if (!newModule.metadata) {
      return null;
    }

    switch (language) {
      case "typescript": {
        if (newModule.metadata.source?.language === "typescript") {
          console.warn("Attempt to convert TypeScript module to TypeScript");
          return null;
        }

        newModule.metadata.source = {
          code: module.code(),
          language: "typescript",
        };
        break;
      }

      case "javascript": {
        if (newModule.metadata.source?.language === "javascript") {
          console.warn("Attempt to convert JavaScript module to JavaScript");
          return null;
        }

        // Apply the existing code to the root value and remove the metadata
        // source.
        if (newModule.metadata.source?.code) {
          newModule.code = newModule.metadata.source?.code;
        }

        delete newModule.metadata.source;
        break;
      }
    }

    this.editModule(tab, moduleId, newModule.code, newModule.metadata);
  }

  editModule(
    tab: Tab | null,
    moduleId: ModuleIdentifier,
    moduleCode: ModuleCode,
    moduleMetadata: ModuleMetadata
  ) {
    if (!tab) {
      return null;
    }

    const editableGraph = this.getEditor(tab);
    if (!editableGraph) {
      this.dispatchEvent(new RuntimeErrorEvent("Unable to edit graph"));
      return null;
    }

    editableGraph.edit(
      [
        {
          type: "changemodule",
          id: moduleId,
          module: {
            code: moduleCode,
            metadata: moduleMetadata,
          },
        },
      ],
      `Update module ${moduleId}`
    );
  }

  updateBoardInfo(
    tab: Tab | null,
    title: string,
    version: string,
    description: string,
    status: "published" | "draft" | null,
    isTool: boolean | null,
    isComponent: boolean | null
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
      isTool,
      isComponent
    );
  }

  #updateGraphValues(
    graph: GraphDescriptor,
    title: string,
    version: string,
    description: string,
    status: "published" | "draft" | null,
    isTool: boolean | null,
    isComponent: boolean | null
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

    updateTag("tool", isTool);
    updateTag("component", isComponent);

    // TODO: Plumb Tab ID here.
    this.dispatchEvent(new RuntimeBoardEditEvent(null, [], false));

    function updateTag(tagName: GraphTag, value: boolean | null) {
      if (value !== null) {
        graph.metadata ??= {};
        graph.metadata.tags ??= [];

        if (value) {
          if (!graph.metadata.tags.includes(tagName)) {
            graph.metadata.tags.push(tagName);
          }
        } else {
          graph.metadata.tags = graph.metadata.tags.filter(
            (tag) => tag !== tagName
          );
        }
      }
    }
  }

  async createSubGraph(tab: Tab | null, subGraphTitle: string) {
    const editableGraph = this.getEditor(tab);
    if (!editableGraph) {
      this.dispatchEvent(new RuntimeErrorEvent("Unable to create sub board"));
      return;
    }

    const id = globalThis.crypto.randomUUID();
    const board = blankLLMContent();
    board.title = subGraphTitle;

    const editResult = await editableGraph.edit(
      [{ type: "addgraph", graph: board, id }],
      `Adding subgraph ${subGraphTitle}`
    );
    if (!editResult.success) {
      return null;
    }

    return id;
  }

  async deleteSubGraph(tab: Tab | null, subGraphId: string) {
    const editableGraph = this.getEditor(tab);
    if (!editableGraph) {
      this.dispatchEvent(new RuntimeErrorEvent("Unable to delete sub board"));
      return;
    }

    const editResult = await editableGraph.edit(
      [{ type: "removegraph", id: subGraphId }],
      `Removing subgraph $"{subGraphId}"`
    );
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
    const editableGraph = this.getEditor(tab);
    const graphId = subGraphId || "";

    if (!editableGraph) {
      this.dispatchEvent(new RuntimeErrorEvent("Unable to find board to edit"));
      return;
    }

    switch (changeType) {
      case "add": {
        editableGraph.edit(
          [{ type: "addedge", edge: from, graphId }],
          `Add edge between ${from.from} and ${from.to}`
        );
        break;
      }

      case "remove": {
        editableGraph.edit(
          [{ type: "removeedge", edge: from, graphId }],
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
              graphId,
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

    const editableGraph = this.getEditor(tab);
    const graphId = subGraphId || "";

    if (!editableGraph) {
      this.dispatchEvent(new RuntimeErrorEvent("Unable to find board to edit"));
      return;
    }

    const inspectableGraph = editableGraph.inspect(subGraphId);
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
        [{ type: "changegraphmetadata", metadata: graphMetadata, graphId }],
        `Change metadata for graph - add comment "${id}"`
      );
      return;
    }

    editableGraph.edit(
      [{ type: "addnode", node: newNode, graphId }],
      `Add node ${id}`
    );
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

    editableGraph.edit(
      [{ type: "changemetadata", id, metadata: newMetadata, graphId }],
      `Change metadata for "${id}"`
    );
  }

  multiEdit(tab: Tab | null, edits: EditSpec[], description: string) {
    if (tab?.readOnly) {
      return;
    }

    const editableGraph = this.getEditor(tab);

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

    const editableGraph = this.getEditor(tab);
    const graphId = subGraphId || "";

    if (!editableGraph) {
      this.dispatchEvent(new RuntimeErrorEvent("Unable to find board to edit"));
      return;
    }

    const inspectableGraph = editableGraph.inspect(subGraphId);
    const graphMetadata = inspectableGraph.metadata() || {};
    graphMetadata.comments ??= [];

    const comment = graphMetadata.comments.find((comment) => comment.id === id);
    if (!comment) {
      console.warn("Unable to update comment; not found");
      return;
    }

    comment.text = text;
    editableGraph.edit(
      [{ type: "changegraphmetadata", metadata: graphMetadata, graphId }],
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

    const editableGraph = this.getEditor(tab);
    const graphId = subGraphId || "";

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
          graphId,
        },
      ],
      `Change configuration for "${id}"`
    );
  }

  async enhanceNodeConfiguration(
    tab: Tab | null,
    subGraphId: string | null,
    id: string,
    sideboard: EnhanceSideboard,
    property?: string,
    value?: NodeValue
  ) {
    if (!tab) {
      return;
    }

    if (tab?.readOnly) {
      return;
    }

    const editableGraph = this.getEditor(tab);
    const graphId = subGraphId || "";

    if (!editableGraph) {
      this.dispatchEvent(new RuntimeErrorEvent("Unable to find board to edit"));
      return;
    }

    const inspectableNode = editableGraph.inspect(graphId).nodeById(id);
    const configuration = structuredClone(
      inspectableNode?.descriptor.configuration ?? {}
    );

    // If there is a value to use over and above the current configuration
    // value we apply it here.
    if (property && value) {
      configuration[property] = value;
    }

    const result = await sideboard.enhance(configuration);

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

    const editableGraph = this.getEditor(tab);
    const graphId = subGraphId || "";

    if (!editableGraph) {
      this.dispatchEvent(new RuntimeErrorEvent("Unable to find board to edit"));
      return;
    }

    const inspectableNode = editableGraph.inspect(graphId).nodeById(id);
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
        graphId,
      },
    ];

    if (metadata) {
      const existingMetadata = inspectableNode?.metadata() || {};
      const newMetadata = {
        ...existingMetadata,
        ...metadata,
      };

      edits.push({
        type: "changemetadata",
        id,
        metadata: newMetadata,
        graphId,
      }),
        `Change metadata for "${id}"`;
    }

    editableGraph.edit(edits, `Change partial configuration for "${id}"`);
  }

  deleteNode(tab: Tab | null, id: string, subGraphId: string | null = null) {
    if (tab?.readOnly) {
      return;
    }

    const editableGraph = this.getEditor(tab);
    const graphId = subGraphId || "";

    if (!editableGraph) {
      this.dispatchEvent(new RuntimeErrorEvent("Unable to find board to edit"));
      return;
    }

    editableGraph.edit(
      [{ type: "removenode", id, graphId }],
      `Remove node ${id}`
    );
  }
}
