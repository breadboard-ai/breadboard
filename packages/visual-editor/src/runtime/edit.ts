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
  isStoredData,
  Kit,
  MoveToGraphTransform,
  MutableGraphStore,
  NodeConfiguration,
  NodeDescriptor,
  NodeIdentifier,
  ok,
  Outcome,
  PortIdentifier,
} from "@google-labs/breadboard";
import { GraphLoader } from "@breadboard-ai/types";
import {
  EnhanceSideboard,
  Tab,
  TabId,
  WorkspaceSelectionState,
  WorkspaceVisualChangeId,
  WorkspaceVisualState,
} from "./types";
import {
  RuntimeBoardAutonameEvent,
  RuntimeBoardEditEvent,
  RuntimeBoardEnhanceEvent,
  RuntimeErrorEvent,
  RuntimeShareDialogRequestedEvent,
  RuntimeVisualChangeEvent,
} from "./events";
import {
  CommentNode,
  Edge,
  GraphIdentifier,
  GraphMetadata,
  GraphTag,
  GraphTheme,
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
import { StateManager } from "./state";
import { GoogleDriveClient } from "@breadboard-ai/google-drive-kit/google-drive-client.js";
import { extractGoogleDriveFileId } from "@breadboard-ai/google-drive-kit/board-server/utils.js";

export class Edit extends EventTarget {
  #editors = new Map<TabId, EditableGraph>();
  // Since the tabs are gone, we can have a single instance now.
  #autoname: Autoname;

  constructor(
    public readonly state: StateManager,
    public readonly loader: GraphLoader,
    public readonly kits: Kit[],
    public readonly sandbox: Sandbox,
    public readonly graphStore: MutableGraphStore,
    public readonly sideboards: SideBoardRuntime,
    public readonly settings: BreadboardUI.Types.SettingsStore | null
  ) {
    super();

    this.#autoname = new Autoname(sideboards, {
      statuschange: (status) => {
        this.dispatchEvent(new RuntimeBoardAutonameEvent(status));
      },
    });
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

  async createTheme(tab: Tab | null, appTheme: AppTheme) {
    const mainGraphId = tab?.mainGraphId;
    if (!mainGraphId) {
      console.warn(`Failed to create theme: no mainGraphId for tab`);
      return;
    }

    const editableGraph = this.getEditor(tab);
    if (!editableGraph) {
      console.warn(`Failed to create theme: no editable graph`);
      return;
    }

    const project = this.state.getOrCreateProjectState(
      mainGraphId,
      editableGraph
    );

    if (!project) {
      console.warn(`Failed to create theme: unable to create state`);
      return;
    }

    const { primary, secondary, tertiary, error, neutral, neutralVariant } =
      appTheme;

    const graphTheme: GraphTheme = {
      template: "basic",
      templateAdditionalOptions: {},
      palette: {
        primary,
        secondary,
        tertiary,
        error,
        neutral,
        neutralVariant,
      },
      themeColors: {
        primaryColor: appTheme.primaryColor,
        secondaryColor: appTheme.secondaryColor,
        backgroundColor: appTheme.backgroundColor,
        primaryTextColor: appTheme.primaryTextColor,
        textColor: appTheme.textColor,
      },
    };

    // TODO: Show some status.
    if (appTheme.splashScreen) {
      const persisted = await project.persistDataParts([
        { parts: [appTheme.splashScreen] },
      ]);
      const splashScreen = persisted?.[0].parts[0];
      if (isStoredData(splashScreen)) {
        graphTheme.splashScreen = splashScreen;
      } else {
        console.warn("Unable to save splash screen", splashScreen);
      }
    }

    const metadata: GraphMetadata = editableGraph.raw().metadata ?? {};
    metadata.visual ??= {};
    metadata.visual.presentation ??= {};
    metadata.visual.presentation.themes ??= {};

    const id = globalThis.crypto.randomUUID();
    metadata.visual.presentation.themes[id] = graphTheme;
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

  /**
   * Finds all assets in the graph, checks if their sharing permissions match
   * that of the main graph, and prompts the user to fix them if needed.
   */
  async checkGoogleDriveAssetShareStatus(
    tab: Tab,
    googleDriveClient: GoogleDriveClient
  ): Promise<void> {
    const graph = tab?.graph;
    if (!graph) {
      console.error(`No graph was found`);
      return;
    }

    const driveAssetFileIds =
      BreadboardUI.Utils.findGoogleDriveAssetsInGraph(graph);

    if (driveAssetFileIds.length === 0) {
      return;
    }
    if (!graph.url) {
      console.error(`Graph had no URL`);
      return;
    }
    const graphFileId = extractGoogleDriveFileId(graph.url);
    if (!graphFileId) {
      return;
    }

    // Retrieve all relevant permissions.
    const rawAssetPermissionsPromise = Promise.all(
      driveAssetFileIds.map(
        async (assetFileId) =>
          [
            assetFileId,
            await googleDriveClient.getFilePermissions(assetFileId),
          ] as const
      )
    );

    const processedGraphPermissions = (
      await googleDriveClient.getFilePermissions(graphFileId)
    )
      .filter(
        (permission) =>
          // We're only concerned with how the graph is shared to others.
          permission.role !== "owner"
      )
      .map((permission) => ({
        ...permission,
        // We only care about reading the file, so downgrade "writer",
        // "commenter", and other roles to "reader" (note that all roles are
        // supersets of of "reader", see
        // https://developers.google.com/workspace/drive/api/guides/ref-roles).
        role: "reader",
      }));

    // Look at each asset and determine whether it is missing any of the
    // permissions that the graph has.
    const assetToMissingPermissions = new Map<
      string,
      gapi.client.drive.Permission[]
    >();
    for (const [
      assetFileId,
      assetPermissions,
    ] of await rawAssetPermissionsPromise) {
      const missingPermissions = new Map(
        processedGraphPermissions.map((graphPermission) => [
          BreadboardUI.Utils.stringifyPermission(graphPermission),
          graphPermission,
        ])
      );
      for (const assetPermission of assetPermissions) {
        missingPermissions.delete(
          BreadboardUI.Utils.stringifyPermission({
            ...assetPermission,
            // See note above about "reader".
            role: "reader",
          })
        );
      }
      if (missingPermissions.size > 0) {
        assetToMissingPermissions.set(assetFileId, [
          ...missingPermissions.values(),
        ]);
      }
    }

    // Prompt to sync the permissions.
    if (assetToMissingPermissions.size > 0) {
      this.dispatchEvent(
        new RuntimeShareDialogRequestedEvent(assetToMissingPermissions)
      );
    }
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

  async updateBoardTitleAndDescription(
    tab: Tab | null,
    title: string | null,
    description: string | null
  ) {
    if (!tab) {
      this.dispatchEvent(new RuntimeErrorEvent("Unable to find tab"));
      return null;
    }

    if (title !== null) {
      tab.graph.title = title;
    }
    if (description !== null) {
      tab.graph.description = description;
    }

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

  /**
   * Use this function to trigger autoname on a node. It will force over
   * `userModified` and disregard any settings.
   */
  async autonameNode(
    tab: Tab | null,
    id: string,
    subGraphId: string | null = null
  ) {
    if (tab?.readOnly) {
      return;
    }

    const editableGraph = this.getEditor(tab);

    if (!editableGraph) {
      this.dispatchEvent(new RuntimeErrorEvent("Unable to find board to edit"));
      return;
    }

    const inspectable = editableGraph.inspect(subGraphId);
    const configuration = inspectable.nodeById(id)?.configuration();
    if (!configuration) return;

    const graphId = subGraphId || "";

    return this.#autonameInternal(editableGraph, id, graphId, configuration);
  }

  async #autonameInternal(
    editableGraph: EditableGraph,
    id: NodeIdentifier,
    graphId: string,
    configuration: NodeConfiguration
  ): Promise<Outcome<void>> {
    const generatingAutonames = await this.#autoname.onNodeConfigurationUpdate(
      editableGraph,
      id,
      graphId,
      configuration
    );
    if (!ok(generatingAutonames)) {
      console.warn("Autonaming error", generatingAutonames.$error);
      return;
    }

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
    const metadata: NodeMetadata = {
      title: generatingAutonames.title,
      userModified: true,
    };

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
    if (updateNodeTransform.titleUserModified) {
      // Don't autoname when title was modified by the user.
      return;
    }

    return this.#autonameInternal(
      editableGraph,
      id,
      graphId,
      configurationPart
    );
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
