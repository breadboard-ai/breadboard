/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  blankLLMContent,
  defaultModuleContent,
  EditableGraph,
  EditHistoryCreator,
  EditSpec,
  GraphDescriptor,
  GraphLoader,
  GraphProvider,
  Kit,
  MoveToGraphTransform,
  MutableGraphStore,
  NodeConfiguration,
  NodeDescriptor,
  NodeIdentifier,
  ok,
  PortIdentifier,
} from "@google-labs/breadboard";
import {
  EnhanceSideboard,
  Tab,
  TabId,
  WorkspaceSelectionState,
  WorkspaceVisualChangeId,
  WorkspaceVisualState,
} from "./types";
import {
  RuntimeBoardEditEvent,
  RuntimeBoardEnhanceEvent,
  RuntimeErrorEvent,
  RuntimeVisualChangeEvent,
} from "./events";
import {
  CommentNode,
  Edge,
  GraphIdentifier,
  GraphMetadata,
  GraphTag,
  GraphTheme,
  Module,
  ModuleCode,
  ModuleIdentifier,
  ModuleLanguage,
  ModuleMetadata,
  NodeMetadata,
  NodeValue,
} from "@breadboard-ai/types";
import { Sandbox } from "@breadboard-ai/jsandbox";
import { createGraphId, MAIN_BOARD_ID } from "./util";
import * as BreadboardUI from "@breadboard-ai/shared-ui";
import {
  AppTheme,
  AssetEdge,
  EdgeAttachmentPoint,
} from "@breadboard-ai/shared-ui/types/types.js";
import { SideBoardRuntime } from "@breadboard-ai/shared-ui/sideboards/types.js";
import { Autoname } from "@breadboard-ai/shared-ui/sideboards/autoname.js";

function isModule(source: unknown): source is Module {
  return typeof source === "object" && source !== null && "code" in source;
}

export class Edit extends EventTarget {
  #editors = new Map<TabId, EditableGraph>();
  // Since the tabs are gone, we can have a single instance now.
  #autoname: Autoname;

  constructor(
    public readonly providers: GraphProvider[],
    public readonly loader: GraphLoader,
    public readonly kits: Kit[],
    public readonly sandbox: Sandbox,
    public readonly graphStore: MutableGraphStore,
    public readonly sideboards: SideBoardRuntime,
    public readonly settings: BreadboardUI.Types.SettingsStore | null
  ) {
    super();
    const allGraphs = !!this.settings
      ?.getSection(BreadboardUI.Types.SETTINGS_TYPE.GENERAL)
      ?.items.get("Enable autonaming")?.value;

    this.#autoname = new Autoname(sideboards, allGraphs);
  }

  getEditor(tab: Tab | null): EditableGraph | null {
    if (!tab) return null;
    if (!tab.graph) return null;
    if (this.#editors.get(tab.id)) {
      return this.#editors.get(tab.id)!;
    }

    const editor = this.graphStore.editByDescriptor(tab.graph, {
      creator: tab.creator,
      history: tab.history,
      onHistoryChanged: tab.onHistoryChanged,
    });
    if (!editor) {
      return null;
    }
    editor.addEventListener("graphchange", (evt) => {
      tab.graph = evt.graph;

      this.#autoname.addTask(editor, evt).then((result) => {
        if (!ok(result)) {
          console.log("AUTONAMING ERROR", result.$error);
        }
      });

      this.dispatchEvent(
        new RuntimeBoardEditEvent(
          tab.id,
          // This is wrong, since we lose the graphId here.
          // TODO: Propagate graphId out to listeners of
          // RuntimeBoardEditEvent.
          evt.visualOnly ? [] : evt.affectedNodes.map((node) => node.id),
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

  getNodeCurrentMetadata(
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
        .nodeById(id)
        ?.type()
        .currentMetadata() ?? null
    );
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
      editableGraph.inspect(subGraphId).nodeById(id)?.type().type() ?? null
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

  async createTheme(tab: Tab | null, theme: GraphTheme) {
    const editableGraph = this.getEditor(tab);
    if (!editableGraph) {
      this.dispatchEvent(
        new RuntimeErrorEvent("Unable to edit subboard; no active board")
      );
      return;
    }

    const metadata: GraphMetadata = editableGraph.raw().metadata ?? {};
    metadata.visual ??= {};
    metadata.visual.presentation ??= {};
    metadata.visual.presentation.themes ??= {};

    const id = globalThis.crypto.randomUUID();
    metadata.visual.presentation.themes[id] = theme;
    metadata.visual.presentation.theme = id;

    return editableGraph.edit(
      [{ type: "changegraphmetadata", metadata, graphId: "" }],
      "Updating theme"
    );
  }

  async changeTheme(tab: Tab | null, theme: string) {
    const editableGraph = this.getEditor(tab);
    if (!editableGraph) {
      this.dispatchEvent(
        new RuntimeErrorEvent("Unable to edit subboard; no active board")
      );
      return;
    }

    const metadata: GraphMetadata = editableGraph.raw().metadata ?? {};
    metadata.visual ??= {};
    metadata.visual.presentation ??= {};
    metadata.visual.presentation.themes ??= {};

    if (!metadata.visual.presentation.themes[theme]) {
      this.dispatchEvent(new RuntimeErrorEvent("Theme does not exist"));
      return;
    }

    metadata.visual.presentation.theme = theme;

    return editableGraph.edit(
      [{ type: "changegraphmetadata", metadata, graphId: "" }],
      "Updating theme"
    );
  }

  async deleteTheme(tab: Tab | null, theme: string) {
    const editableGraph = this.getEditor(tab);
    if (!editableGraph) {
      this.dispatchEvent(
        new RuntimeErrorEvent("Unable to edit subboard; no active board")
      );
      return;
    }

    const metadata: GraphMetadata = editableGraph.raw().metadata ?? {};
    metadata.visual ??= {};
    metadata.visual.presentation ??= {};
    metadata.visual.presentation.themes ??= {};

    if (!metadata.visual.presentation.themes[theme]) {
      this.dispatchEvent(new RuntimeErrorEvent("Theme does not exist"));
      return;
    }

    delete metadata.visual.presentation.themes[theme];
    const themes = Object.keys(metadata.visual.presentation.themes);
    metadata.visual.presentation.theme = themes.at(-1);

    return editableGraph.edit(
      [{ type: "changegraphmetadata", metadata, graphId: "" }],
      "Updating theme"
    );
  }

  async updateTheme(tab: Tab | null, themeId: string, theme: GraphTheme) {
    const editableGraph = this.getEditor(tab);
    if (!editableGraph) {
      this.dispatchEvent(
        new RuntimeErrorEvent("Unable to edit subboard; no active board")
      );
      return;
    }

    const metadata: GraphMetadata = editableGraph.raw().metadata ?? {};
    metadata.visual ??= {};
    metadata.visual.presentation ??= {};
    metadata.visual.presentation.themes ??= {};

    if (!metadata.visual.presentation.themes[themeId]) {
      this.dispatchEvent(new RuntimeErrorEvent("Theme does not exist"));
      return;
    }

    metadata.visual.presentation.themes[themeId] = theme;

    return editableGraph.edit(
      [{ type: "changegraphmetadata", metadata, graphId: "" }],
      "Updating theme"
    );
  }

  async applyTheme(
    tab: Tab | null,
    theme: AppTheme,
    appTitle: string | null,
    appDescription: string | null,
    template: string | null,
    templateAdditionalOptionsChosen: Record<string, string> | null
  ) {
    const editableGraph = this.getEditor(tab);
    if (!editableGraph) {
      this.dispatchEvent(
        new RuntimeErrorEvent("Unable to edit subboard; no active board")
      );
      return;
    }

    const metadata: GraphMetadata = editableGraph.raw().metadata ?? {};
    metadata.visual ??= {};
    metadata.visual.presentation ??= {};
    if (appTitle) {
      metadata.visual.presentation.title = appTitle;
    }

    if (appDescription) {
      metadata.visual.presentation.description = appDescription;
    }

    if (template) {
      metadata.visual.presentation.template = template;
    }

    if (templateAdditionalOptionsChosen) {
      metadata.visual.presentation.templateAdditionalOptions =
        templateAdditionalOptionsChosen;
    }

    metadata.visual.presentation.themeColors = {
      primaryColor: theme.primaryColor,
      primaryTextColor: theme.primaryTextColor,
      secondaryColor: theme.secondaryColor,
      backgroundColor: theme.backgroundColor,
      textColor: theme.textColor,
    };

    return editableGraph.edit(
      [{ type: "changegraphmetadata", metadata, graphId: "" }],
      "Updating theme"
    );
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
  }

  async updateModuleInfo(
    tab: Tab | null,
    moduleId: string,
    title: string,
    description: string
  ) {
    const editableGraph = this.getEditor(tab);
    if (!editableGraph) {
      this.dispatchEvent(
        new RuntimeErrorEvent("Unable to edit module; no active board")
      );
      return;
    }

    const module = editableGraph.inspect("").moduleById(moduleId);
    if (!module) {
      return null;
    }

    const code = module.code();
    const metadata = { ...module.metadata() };

    metadata.title = title;
    metadata.description = description;

    this.editModule(tab, moduleId, code, metadata);
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

  async copyBoardItem(
    tab: Tab | null,
    type: "graph" | "module",
    id: GraphIdentifier | ModuleIdentifier,
    title: string
  ) {
    if (!tab) {
      return null;
    }

    const editableGraph = this.getEditor(tab);
    if (!editableGraph) {
      this.dispatchEvent(new RuntimeErrorEvent("Unable to edit graph"));
      return null;
    }

    const edits: EditSpec[] = [];
    switch (type) {
      case "graph": {
        const graph = editableGraph.raw().graphs?.[id];
        if (!graph) {
          console.warn(
            `Issued copy request for "${id}", but no such graph was found`
          );
          break;
        }

        const newGraph = structuredClone(graph);
        newGraph.title = title;

        const newId = crypto.randomUUID();
        edits.push({ type: "addgraph", graph: newGraph, id: newId });
        break;
      }

      case "module": {
        const module = editableGraph.raw().modules?.[id];
        if (!module) {
          console.warn(
            `Issued copy request for "${id}", but no such module was found`
          );
          break;
        }

        const newModule = structuredClone(module);
        newModule.metadata ??= {};
        newModule.metadata.title = title;

        const newId = crypto.randomUUID();
        edits.push({ type: "addmodule", module: newModule, id: newId });
        break;
      }

      default:
        throw new Error(`Unexpected copy type ${type}`);
    }

    if (!edits.length) {
      return;
    }

    return editableGraph.edit(edits, `Copying to ${title} (${type})`);
  }

  async createWorkspaceItem(
    tab: Tab | null,
    type: "declarative" | "imperative",
    title: string | null,
    settings: BreadboardUI.Types.SettingsStore | null
  ) {
    if (!tab) {
      return null;
    }

    const editableGraph = this.getEditor(tab);
    if (!editableGraph) {
      this.dispatchEvent(new RuntimeErrorEvent("Unable to edit graph"));
      return null;
    }

    title ??= "Untitled item";

    const edits: EditSpec[] = [];
    switch (type) {
      case "declarative": {
        const id: string = crypto.randomUUID();
        const board: GraphDescriptor | undefined = undefined;
        // TODO: Figure out what this code was supposed to do.
        // if (source) {
        //   if (typeof source === "string" || source instanceof URL) {
        //     try {
        //       const sourceResponse = await fetch(source);
        //       board = await sourceResponse.json();
        //     } catch (err) {
        //       console.warn(err);
        //       return;
        //     }
        //   } else if (isGraphDescriptor(source)) {
        //     board = source;
        //   }
        // }
        await this.createSubGraph(tab, title, id, board);
        break;
      }

      case "imperative": {
        const id = title.replace(/[^a-zA-Z0-9]/g, "-");
        let source: Module | undefined = undefined;
        const createAsTypeScript =
          settings
            ?.getSection(BreadboardUI.Types.SETTINGS_TYPE.GENERAL)
            .items.get("Use TypeScript as Module default language")?.value ??
          false;

        if (createAsTypeScript) {
          source = {
            code: "",
            metadata: {
              title,
              source: {
                code: defaultModuleContent("typescript"),
                language: "typescript",
              },
            },
          };
        } else {
          source = {
            code: defaultModuleContent(),
            metadata: {
              title,
            },
          };
        }

        let module: Module | undefined = undefined;
        if (source) {
          if (typeof source === "string" || source instanceof URL) {
            try {
              const sourceResponse = await fetch(source);
              module = await sourceResponse.json();
            } catch (err) {
              console.warn(err);
              return;
            }
          } else if (isModule(source)) {
            module = source;
          }
        }

        if (!module) {
          module = { code: defaultModuleContent(), metadata: { title } };
        }

        this.createModule(tab, id, module);
        break;
      }

      default:
        throw new Error(`Unexpected copy type ${type}`);
    }

    if (!edits.length) {
      return;
    }

    return editableGraph.edit(edits, `Copying to ${title} (${type})`);
  }

  async createModule(
    tab: Tab | null,
    moduleId: ModuleIdentifier,
    module: Module = { code: defaultModuleContent("javascript") },
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

    return editableGraph
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

  async deleteModule(tab: Tab | null, moduleId: ModuleIdentifier) {
    if (!tab) {
      return null;
    }

    const editableGraph = this.getEditor(tab);
    if (!editableGraph) {
      this.dispatchEvent(new RuntimeErrorEvent("Unable to edit graph"));
      return null;
    }

    const result = await editableGraph.edit(
      [
        {
          type: "removemodule",
          id: moduleId,
        },
      ],
      `Delete module ${moduleId}`
    );

    if (!result.success) {
      this.dispatchEvent(new RuntimeErrorEvent("Unable to delete module"));
      return;
    }

    if (tab.moduleId === moduleId) {
      tab.moduleId = null;
    }
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

  async toggleExport(
    tab: Tab,
    id: ModuleIdentifier | GraphIdentifier,
    exportType: "imperative" | "declarative"
  ) {
    const editableGraph = this.getEditor(tab);
    if (!editableGraph) {
      this.dispatchEvent(new RuntimeErrorEvent("Unable to edit graph"));
      return null;
    }

    return editableGraph.edit(
      [{ type: "toggleexport", exportType, id }],
      `Toggle export for ${exportType} graph "${id}"`
    );
  }

  updateBoardInfo(
    tab: Tab | null,
    title: string,
    version: string,
    description: string,
    status: "published" | "draft" | "private" | null,
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

  async updateBoardTitle(tab: Tab | null, title: string) {
    if (!tab) {
      this.dispatchEvent(new RuntimeErrorEvent("Unable to find tab"));
      return null;
    }

    tab.graph.title = title;
    tab.graph.metadata ??= {};
    tab.graph.metadata.userModified = true;
    this.dispatchEvent(new RuntimeBoardEditEvent(null, [], false));
  }

  async updateBoardDescription(tab: Tab | null, description: string) {
    if (!tab) {
      this.dispatchEvent(new RuntimeErrorEvent("Unable to find tab"));
      return null;
    }

    tab.graph.description = description;
    tab.graph.metadata ??= {};
    tab.graph.metadata.userModified = true;
    this.dispatchEvent(new RuntimeBoardEditEvent(null, [], false));
  }

  #updateGraphValues(
    graph: GraphDescriptor,
    title: string,
    version: string,
    description: string,
    status: "published" | "draft" | "private" | null,
    isTool: boolean | null,
    isComponent: boolean | null
  ) {
    graph.title = title;
    graph.version = version;
    graph.description = description;

    graph.metadata ??= {};
    graph.metadata.userModified = true;

    if (status) {
      graph.metadata.tags ??= [];

      switch (status) {
        case "published": {
          if (!graph.metadata.tags.includes("published")) {
            graph.metadata.tags.push("published");
          }
          graph.metadata.tags = graph.metadata.tags.filter(
            (tag) => tag !== "private"
          );
          break;
        }

        case "draft": {
          graph.metadata.tags = graph.metadata.tags.filter(
            (tag) => tag !== "published" && tag !== "private"
          );
          break;
        }

        case "private": {
          graph.metadata.tags = graph.metadata.tags.filter(
            (tag) => tag !== "published" && tag !== "private"
          );
          graph.metadata.tags.push("private");
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

  async createSubGraph(
    tab: Tab | null,
    subGraphTitle: string,
    id: GraphIdentifier = globalThis.crypto.randomUUID(),
    board = blankLLMContent()
  ) {
    const editableGraph = this.getEditor(tab);
    if (!editableGraph) {
      this.dispatchEvent(new RuntimeErrorEvent("Unable to create sub board"));
      return;
    }

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

  async createReference(
    tab: Tab | null,
    graphId: GraphIdentifier,
    nodeId: NodeIdentifier,
    portId: PortIdentifier,
    value: NodeValue
  ) {
    const editableGraph = this.getEditor(tab);
    if (!editableGraph) {
      this.dispatchEvent(new RuntimeErrorEvent("Unable to edit"));
      return;
    }

    if (graphId === MAIN_BOARD_ID) {
      graphId = "";
    }

    if (typeof value === "string") {
      // Convert to `UnresolvedPathBoardCapability`, so that it is resolved
      // at runtime.
      // This is important for ensuring that relative URLs are resolved
      // relative to where they are invoked from, rather than to where they
      // are used.
      value = { kind: "board", path: value };
    }

    const node = editableGraph.inspect(graphId).nodeById(nodeId);
    const port = node
      ?.currentPorts()
      .inputs.ports.find((port) => port.name === portId);
    const config = node?.configuration();
    if (!config || !port) {
      this.dispatchEvent(new RuntimeErrorEvent("Unable to create reference"));
      return;
    }

    const newConfigurationPart: NodeValue = structuredClone({
      [portId]: config[portId],
    });

    if (!newConfigurationPart[portId]) {
      if (port.type.schema.type === "array") {
        newConfigurationPart[portId] = [value];
      } else {
        newConfigurationPart[portId] = value;
      }
    } else {
      if (Array.isArray(newConfigurationPart[portId])) {
        if (newConfigurationPart[portId].includes(value)) {
          this.dispatchEvent(new RuntimeErrorEvent("Reference already exists"));
          return;
        }

        newConfigurationPart[portId].push(value);
      } else {
        if (port.type.schema.type === "array") {
          newConfigurationPart[portId] = [value];
        } else {
          newConfigurationPart[portId] = value;
        }
      }
    }

    return this.changeNodeConfigurationPart(
      tab,
      nodeId,
      newConfigurationPart,
      graphId === "" ? null : graphId
    );
  }

  async processVisualChange(
    tab: Tab | null,
    visualChangeId: WorkspaceVisualChangeId,
    graphId: GraphIdentifier,
    visual: GraphMetadata["visual"]
  ) {
    const editableGraph = this.getEditor(tab);
    if (!editableGraph) {
      this.dispatchEvent(new RuntimeErrorEvent("Unable to delete sub board"));
      return;
    }

    const edits: EditSpec[] = [];
    if (graphId === MAIN_BOARD_ID) {
      graphId = "";
    }

    const metadata = editableGraph.inspect(graphId).metadata() ?? {};
    const currentVisual = { ...metadata.visual, ...visual };
    metadata.visual = currentVisual;

    // Only subgraphs can be minimized.
    if (graphId === "") {
      delete currentVisual.minimized;
    }

    edits.push({
      type: "changegraphmetadata",
      graphId,
      metadata,
    });

    await editableGraph.edit(edits, visualChangeId);

    this.dispatchEvent(new RuntimeVisualChangeEvent(visualChangeId));
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
    tab: Tab | null,
    node: NodeDescriptor,
    edge: Edge,
    subGraphId: string | null = null
  ) {
    const editableGraph = this.getEditor(tab);
    const graphId = subGraphId || "";

    if (!editableGraph) {
      this.dispatchEvent(new RuntimeErrorEvent("Unable to find board to edit"));
      return;
    }

    const changing = await editableGraph.apply(
      new BreadboardUI.Transforms.AddNodeWithEdge(node, edge, graphId)
    );
    if (changing.success) return;

    this.dispatchEvent(new RuntimeErrorEvent(changing.error));
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

  async createNode(
    tab: Tab | null,
    id: string,
    nodeType: string,
    configuration: NodeConfiguration | null = null,
    metadata: NodeMetadata | null = null,
    subGraphId: string | null = null,
    options: { sourceId: NodeIdentifier; portId: PortIdentifier } | null = null
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

    editableGraph.apply(
      new BreadboardUI.Transforms.CreateNode(
        id,
        graphId,
        nodeType,
        configuration,
        metadata,
        options
      )
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

    return editableGraph.apply(updateNodeTransform);
  }

  async moveNodesToGraph(
    tab: Tab | null,
    ids: NodeIdentifier[],
    sourceGraphId: GraphIdentifier,
    destinationGraphId: GraphIdentifier | null = null,
    positionDelta: DOMPoint | null = null
  ) {
    if (tab?.readOnly) {
      return;
    }

    const editableGraph = this.getEditor(tab);

    if (!editableGraph) {
      this.dispatchEvent(new RuntimeErrorEvent("Unable to find board to edit"));
      return;
    }

    return editableGraph.apply(
      new BreadboardUI.Transforms.MoveNodesToGraph(
        ids,
        sourceGraphId,
        destinationGraphId,
        positionDelta
      )
    );
  }

  async createParam(
    tab: Tab | null,
    graphId: GraphIdentifier,
    path: string,
    title: string,
    description?: string
  ) {
    if (tab?.readOnly) {
      return;
    }

    const editableGraph = this.getEditor(tab);
    if (!editableGraph) {
      this.dispatchEvent(new RuntimeErrorEvent("Unable to find board to edit"));
      return;
    }

    return editableGraph.apply(
      new BreadboardUI.Transforms.CreateParam(graphId, path, title, description)
    );
  }

  async deleteParam(tab: Tab | null, graphId: GraphIdentifier, path: string) {
    if (tab?.readOnly) {
      return;
    }

    const editableGraph = this.getEditor(tab);
    if (!editableGraph) {
      this.dispatchEvent(new RuntimeErrorEvent("Unable to find board to edit"));
      return;
    }

    return editableGraph.apply(
      new BreadboardUI.Transforms.DeleteParam(graphId, path)
    );
  }

  /**
   *
   * @deprecated
   */
  async moveToNewGraph(
    tab: Tab | null,
    selectionState: WorkspaceSelectionState,
    targetGraphId: GraphIdentifier | null,
    delta: { x: number; y: number }
  ) {
    if (tab?.readOnly) {
      return;
    }

    const editableGraph = this.getEditor(tab);
    if (!editableGraph) {
      this.dispatchEvent(new RuntimeErrorEvent("Unable to find board to edit"));
      return;
    }

    targetGraphId = targetGraphId ?? createGraphId();
    const inspectableTargetGraphId =
      targetGraphId === MAIN_BOARD_ID ? "" : targetGraphId;

    const edits: EditSpec[] = [];
    const commentsForTargetGraph: CommentNode[] = [];
    const nodeIds: NodeIdentifier[] = [];

    let hasEdited = false;
    for (const [sourceGraphId, sourceGraph] of selectionState.graphs) {
      const inspectableSourceGraphId =
        sourceGraphId === MAIN_BOARD_ID ? "" : sourceGraphId;
      // Make the new graph if needed.
      if (
        targetGraphId !== MAIN_BOARD_ID &&
        (!editableGraph.raw().graphs ||
          !editableGraph.raw().graphs?.[targetGraphId])
      ) {
        await editableGraph.edit(
          [
            {
              type: "addgraph",
              id: targetGraphId,
              graph: { nodes: [], edges: [], title: "New Board" },
            },
          ],
          "Create new graph"
        );
      }

      // Skip transforms where the target is the same as the source.
      if (inspectableTargetGraphId === inspectableSourceGraphId) {
        continue;
      }

      hasEdited = true;

      if (sourceGraph.comments.size > 0) {
        const metadata =
          editableGraph.inspect(inspectableSourceGraphId).metadata() ?? {};
        const comments = metadata.comments ?? [];
        const graphCommentsAfterEdit: CommentNode[] = [];
        for (const comment of comments) {
          if (sourceGraph.comments.has(comment.id)) {
            const newComment = structuredClone(comment);
            commentsForTargetGraph.push(newComment);
            newComment.metadata ??= {};
            newComment.metadata.visual ??= { x: 0, y: 0 };

            const visual = newComment.metadata.visual as Record<string, number>;
            visual.x += delta.x;
            visual.y += delta.y;
          } else {
            graphCommentsAfterEdit.push(comment);
          }
        }

        // Update the graph's comments.
        metadata.comments = graphCommentsAfterEdit;
        edits.push({
          type: "changegraphmetadata",
          graphId: inspectableSourceGraphId,
          metadata,
        });
      }

      // Track the nodes seen so that we can update their location values.
      nodeIds.push(...sourceGraph.nodes);

      // Transform all the selected nodes into it.
      const transform = new MoveToGraphTransform(
        [...sourceGraph.nodes],
        inspectableSourceGraphId,
        inspectableTargetGraphId
      );

      const result = await editableGraph.apply(transform);
      if (!result.success) {
        this.dispatchEvent(new RuntimeErrorEvent("Unable to transform board"));
        return;
      }
    }

    if (!hasEdited) {
      return;
    }

    // Now go through each one and adjust it by the left-most position and
    // the cursor position.
    for (const nodeId of nodeIds) {
      const node = editableGraph
        .inspect(inspectableTargetGraphId)
        .nodeById(nodeId);
      if (!node) {
        continue;
      }

      const metadata = node.metadata();
      const visual = (metadata.visual ?? {}) as Record<string, number>;

      visual.x += delta.x;
      visual.y += delta.y;

      edits.push({
        type: "changemetadata",
        id: nodeId,
        graphId: inspectableTargetGraphId,
        metadata,
      });
    }

    // Carry any existing comments.
    const inspectableTargetGraph = editableGraph.inspect(
      inspectableTargetGraphId
    );
    commentsForTargetGraph.push(
      ...(inspectableTargetGraph.metadata()?.comments ?? [])
    );

    // Finally set comments.
    edits.push({
      type: "changegraphmetadata",
      graphId: inspectableTargetGraphId,
      metadata: {
        comments: commentsForTargetGraph,
      },
    });

    await editableGraph.edit(edits, "Location updates");
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
