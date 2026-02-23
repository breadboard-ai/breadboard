/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  EditSpec,
  GraphIdentifier,
  JsonSerializable,
  LLMContent,
  NodeExpectedOutput,
  NodeIdentifier,
  NodeMetadata,
} from "@breadboard-ai/types";
import { filterUndefined, ok, toJson } from "@breadboard-ai/utils";
import {
  UpdateNode,
  ChangeEdge,
  ChangeEdgeAttachmentPoint,
} from "../../../ui/transforms/index.js";
import type { StateEvent } from "../../../ui/events/events.js";
import { MAIN_BOARD_ID } from "../../constants.js";

import {
  makeAction,
  withUIBlocking,
  isFocusedOnGraphRenderer,
} from "../binder.js";
import { Utils } from "../../utils.js";
import {
  asAction,
  ActionMode,
  stateEventTrigger,
  keyboardTrigger,
} from "../../coordination.js";
import {
  onNodeConfigChange,
  onNodeAction as onNodeActionTrigger,
  onCopyShortcut,
} from "./triggers.js";
import { GraphUtils } from "../../../utils/graph-utils.js";
import { ClipboardReader } from "../../../utils/clipboard-reader.js";
import {
  ChangeAssetEdge,
  MarkInPortsInvalidSpec,
  RemoveAssetWithRefs,
} from "../../../ui/transforms/index.js";
import type { GraphDescriptor } from "@breadboard-ai/types";
import { A2_COMPONENTS } from "../../../a2/a2-registry.js";

export const bind = makeAction();

/**
 * Configuration for autoname action.
 */
export interface AutonameConfig {
  nodeId: NodeIdentifier;
  graphId: GraphIdentifier;
  configuration: Record<string, unknown>;
  titleUserModified: boolean;
}

/**
 * Represents the expected structure of the autonamer result.
 */
export interface NotEnoughContextResult {
  notEnoughContext: boolean;
}

export interface NodeConfigurationUpdateResult {
  title: string;
  description: string;
  expected_output?: NodeExpectedOutput[];
}

// NodeExpectedOutput is imported from @breadboard-ai/types

export interface AutonameArguments {
  nodeConfigurationUpdate: {
    configuration: Record<string, unknown>;
    type: string;
  };
  expected_output?: NodeExpectedOutput[];
}

/**
 * Union of possible autonamer results.
 */
export type AutonameResult =
  | NotEnoughContextResult
  | NodeConfigurationUpdateResult;

/**
 * Converts an object to LLMContent format for the autonamer.
 */
function asLLMContent<T>(o: T): LLMContent[] {
  return [{ parts: [{ json: o as JsonSerializable }] }];
}

/**
 * Performs autoname operation on a node.
 *
 * This action can be:
 * - Called directly with a config
 * - Triggered by onNodeConfigChange (reads config from controller state)
 *
 * It:
 * 1. Gets the node type for context
 * 2. Calls the autonamer service
 * 3. Updates the node metadata with the generated title/description
 *
 * **Triggers:**
 * - `onNodeConfigChange`: Fires when a node's configuration changes
 */
export const autoname = asAction(
  "Node.autoname",
  {
    mode: ActionMode.Immediate,
    triggeredBy: () => onNodeConfigChange(bind),
  },
  async (config?: AutonameConfig): Promise<void> => {
    const LABEL = "Action: Autoname";
    const { controller, services } = bind;
    const { editor, readOnly, lastNodeConfigChange } = controller.editor.graph;
    const logger = Utils.Logging.getLogger(controller);

    // When triggered (no config), read from controller state
    const effectiveConfig = config ?? lastNodeConfigChange;

    // Guard: no config from either source
    if (!effectiveConfig) {
      return;
    }

    // Guard conditions
    if (readOnly || !editor) {
      return;
    }

    const { nodeId, graphId, configuration, titleUserModified } =
      effectiveConfig;
    const { autonamer } = services;
    const flags = await bind.env.flags.flags();

    // Skip if output templates disabled AND title was user-modified.
    if (!flags.outputTemplates && titleUserModified) {
      return;
    }

    // Get node type for autonaming context.
    const inspector = controller.editor.graph.inspect(graphId);
    const node = inspector.nodeById(nodeId);
    if (!node) {
      logger.log(
        Utils.Logging.Formatter.warning(`Unable to find node "${nodeId}"`),
        LABEL
      );
      return;
    }

    const type = node.descriptor.type;

    // Abort if graph changes during autonaming.
    const abortController = new AbortController();
    let graphChanged = false;
    editor.addEventListener(
      "graphchange",
      () => {
        graphChanged = true;
        abortController.abort();
      },
      { once: true }
    );

    const outputs = await autonamer.autoname(
      asLLMContent({
        nodeConfigurationUpdate: { configuration, type },
      } satisfies AutonameArguments),
      abortController.signal
    );

    if (graphChanged) {
      logger.log(
        Utils.Logging.Formatter.verbose(
          "Results discarded due to graph change"
        ),
        LABEL
      );
      return;
    }

    if (!ok(outputs)) {
      logger.log(
        Utils.Logging.Formatter.error("Autoname error:", outputs.$error),
        LABEL
      );
      return;
    }

    const result = toJson<AutonameResult>(outputs);
    if (!result) {
      logger.log(Utils.Logging.Formatter.warning("Result not found"), LABEL);
      return;
    }

    logger.log(
      Utils.Logging.Formatter.verbose("Autoname result:", result),
      LABEL
    );

    if ("notEnoughContext" in result) {
      logger.log(
        Utils.Logging.Formatter.verbose(
          "Not enough context to autoname",
          nodeId
        ),
        LABEL
      );
      return;
    }

    // Clip trailing period that may crop up in LLM response.
    if (result.description.endsWith(".")) {
      result.description = result.description.slice(0, -1);
    }

    // Build metadata update, excluding title if user already modified it.
    const metadata: NodeMetadata = filterUndefined({
      title: titleUserModified ? undefined : result.title,
      userModified: true,
      expected_output: result.expected_output,
    });

    const applying = await editor.apply(
      new UpdateNode(nodeId, graphId, null, metadata, null)
    );

    if (!applying.success) {
      logger.log(
        Utils.Logging.Formatter.warning(
          "Failed to apply autoname",
          applying.error
        ),
        LABEL
      );
    }
  }
);

// =============================================================================
// Event-Triggered Actions
// =============================================================================

/**
 * Changes node configuration.
 *
 * **Triggers:** `node.change` StateEvent
 */
export const onNodeChange = asAction(
  "Node.onNodeChange",
  {
    mode: ActionMode.Immediate,
    triggeredBy: () => {
      const { services } = bind;
      return stateEventTrigger(
        "Node Change",
        services.stateEventBus,
        "node.change"
      );
    },
  },
  async (evt?: StateEvent<"node.change">): Promise<void> => {
    const { controller } = bind;
    if (controller.editor.graph.readOnly) return;

    const { editor } = controller.editor.graph;
    if (!editor) return;

    const detail = evt!.detail;
    await withUIBlocking(controller, async () => {
      const transform = new UpdateNode(
        detail.id,
        detail.subGraphId ?? "",
        detail.configurationPart,
        detail.metadata,
        detail.ins
      );
      const result = await editor.apply(transform);
      if (!result.success) {
        throw new Error(result.error);
      }
      // Set the signal so the autoname trigger can react.
      controller.editor.graph.lastNodeConfigChange = {
        nodeId: detail.id,
        graphId: detail.subGraphId ?? "",
        configuration: detail.configurationPart,
        titleUserModified: transform.titleUserModified,
      };
    });
  }
);

/**
 * Adds a new node and selects it.
 *
 * **Triggers:** `node.add` StateEvent
 */
export const onNodeAdd = asAction(
  "Node.onNodeAdd",
  {
    mode: ActionMode.Immediate,
    triggeredBy: () => {
      const { services } = bind;
      return stateEventTrigger("Node Add", services.stateEventBus, "node.add");
    },
  },
  async (evt?: StateEvent<"node.add">): Promise<void> => {
    const { controller } = bind;
    const { editor } = controller.editor.graph;
    if (!editor) return;

    const detail = evt!.detail;
    await withUIBlocking(controller, async () => {
      await editor.edit(
        [{ type: "addnode", graphId: detail.graphId, node: detail.node }],
        `Add step: ${detail.node.metadata?.title ?? detail.node.id}`
      );
      controller.editor.selection.selectNodes([detail.node.id]);
    });
  }
);

/**
 * Moves the selected nodes and assets.
 *
 * **Triggers:** `node.moveselection` StateEvent
 */
export const onMoveSelection = asAction(
  "Node.onMoveSelection",
  {
    mode: ActionMode.Immediate,
    triggeredBy: () => {
      const { services } = bind;
      return stateEventTrigger(
        "Node Move Selection",
        services.stateEventBus,
        "node.moveselection"
      );
    },
  },
  async (evt?: StateEvent<"node.moveselection">): Promise<void> => {
    const { controller } = bind;
    const { editor } = controller.editor.graph;
    if (!editor) return;

    const detail = evt!.detail;
    await withUIBlocking(controller, async () => {
      const edits: EditSpec[] = [];
      for (const update of detail.updates) {
        if (update.type === "node") {
          const inspector = controller.editor.graph.inspect(update.graphId);
          const node = inspector.nodeById(update.id);
          const existingMetadata = node?.metadata() ?? {};
          const existingVisual = (existingMetadata.visual ?? {}) as Record<
            string,
            unknown
          >;
          edits.push({
            type: "changemetadata",
            id: update.id,
            graphId: update.graphId,
            metadata: {
              ...existingMetadata,
              visual: { ...existingVisual, x: update.x, y: update.y },
            },
          });
        } else {
          const graph = editor.raw();
          const asset = graph.assets?.[update.id];
          if (!asset?.metadata) continue;
          edits.push({
            type: "changeassetmetadata",
            path: update.id,
            metadata: {
              ...asset.metadata,
              visual: { x: update.x, y: update.y },
            },
          });
        }
      }
      await editor.edit(edits, "Update selection position");
    });
  }
);

/**
 * Adds, removes, or changes an edge.
 *
 * **Triggers:** `node.changeedge` StateEvent
 */
export const onChangeEdge = asAction(
  "Node.onChangeEdge",
  {
    mode: ActionMode.Immediate,
    triggeredBy: () => {
      const { services } = bind;
      return stateEventTrigger(
        "Node Change Edge",
        services.stateEventBus,
        "node.changeedge"
      );
    },
  },
  async (evt?: StateEvent<"node.changeedge">): Promise<void> => {
    const { controller } = bind;
    const { editor } = controller.editor.graph;
    if (!editor) return;

    const detail = evt!.detail;
    await withUIBlocking(controller, async () => {
      const graphId = detail.subGraphId ?? "";
      const transform = new ChangeEdge(
        detail.changeType,
        graphId,
        detail.from,
        detail.to
      );
      const result = await editor.apply(transform);
      if (!result.success) {
        throw new Error(result.error);
      }
    });
  }
);

/**
 * Changes the attachment point of an edge.
 *
 * **Triggers:** `node.changeedgeattachmentpoint` StateEvent
 */
export const onChangeEdgeAttachmentPoint = asAction(
  "Node.onChangeEdgeAttachmentPoint",
  {
    mode: ActionMode.Immediate,
    triggeredBy: () => {
      const { services } = bind;
      return stateEventTrigger(
        "Node Change Edge Attachment Point",
        services.stateEventBus,
        "node.changeedgeattachmentpoint"
      );
    },
  },
  async (evt?: StateEvent<"node.changeedgeattachmentpoint">): Promise<void> => {
    const { controller } = bind;
    const { editor } = controller.editor.graph;
    if (!editor) return;

    const detail = evt!.detail;
    await withUIBlocking(controller, async () => {
      const transform = new ChangeEdgeAttachmentPoint(
        detail.graphId === MAIN_BOARD_ID ? "" : detail.graphId,
        detail.edge,
        detail.which,
        detail.attachmentPoint
      );
      const result = await editor.apply(transform);
      if (!result.success) {
        throw new Error(result.error);
      }
    });
  }
);

// =============================================================================
// Keyboard-triggered Actions
// =============================================================================

/**
 * Delete selected nodes, edges, asset edges, and assets.
 *
 * **Triggers:** `Delete` / `Backspace`, guard: focused on graph renderer
 */
export const onDelete = asAction(
  "Node.onDelete",
  {
    mode: ActionMode.Awaits,
    triggeredBy: () =>
      keyboardTrigger(
        "Delete Shortcut",
        ["Delete", "Backspace"],
        isFocusedOnGraphRenderer
      ),
  },
  async (): Promise<void> => {
    const { controller } = bind;
    const { editor, readOnly } = controller.editor.graph;
    if (readOnly || !editor) return;

    const sel = controller.editor.selection;
    if (sel.size === 0) return;

    const graph = controller.editor.graph.inspect("");
    const spec = GraphUtils.generateDeleteEditSpecFrom(sel.selection, graph);

    // Delete selected Asset Edges.
    const selection = sel.selection;
    if (selection.assetEdges.size) {
      const assetEdges = graph.assetEdges();

      if (Array.isArray(assetEdges)) {
        for (const selectedAssetEdge of selection.assetEdges) {
          for (const assetEdge of assetEdges) {
            if (
              selectedAssetEdge !==
              Utils.Helpers.toAssetEdgeIdentifier(assetEdge)
            ) {
              continue;
            }

            await editor.apply(
              new ChangeAssetEdge("remove", "", {
                assetPath: assetEdge.assetPath,
                direction: assetEdge.direction,
                nodeId: assetEdge.node.descriptor.id,
              })
            );
          }
        }
      }
    }

    // Delete selected Assets.
    if (selection.assets.size) {
      for (const asset of selection.assets) {
        await editor.apply(new RemoveAssetWithRefs(asset));
      }
    }

    await editor.apply(new MarkInPortsInvalidSpec(spec));

    sel.deselectAll();
  }
);

/**
 * Select all nodes in the graph.
 *
 * **Triggers:** `Cmd+a` / `Ctrl+a`, guard: focused on graph renderer
 */
export const onSelectAll = asAction(
  "Node.onSelectAll",
  {
    mode: ActionMode.Immediate,
    triggeredBy: () =>
      keyboardTrigger(
        "Select All Shortcut",
        ["Cmd+a", "Ctrl+a"],
        isFocusedOnGraphRenderer
      ),
  },
  async (): Promise<void> => {
    const { controller } = bind;
    const { editor } = controller.editor.graph;
    if (!editor) return;

    const graph = controller.editor.graph.inspect("");
    controller.editor.selection.selectAll(graph);
  }
);

/**
 * Copy selected nodes to clipboard.
 *
 * **Triggers:** `Cmd+c` / `Ctrl+c`, guard: focused on graph renderer + no text selection
 */
export const onCopy = asAction(
  "Node.onCopy",
  {
    mode: ActionMode.Awaits,
    triggeredBy: () => onCopyShortcut(),
  },
  async (): Promise<void> => {
    const { controller } = bind;
    const { editor } = controller.editor.graph;
    if (!editor) return;

    const sel = controller.editor.selection;
    if (sel.size === 0) return;

    const graph = controller.editor.graph.inspect("");
    const board = GraphUtils.generateBoardFrom(sel.selection, graph);

    await navigator.clipboard.writeText(JSON.stringify(board, null, 2));
  }
);

/**
 * Cut selected nodes to clipboard and delete them.
 *
 * **Triggers:** `Cmd+x` / `Ctrl+x`, guard: focused on graph renderer
 */
export const onCut = asAction(
  "Node.onCut",
  {
    mode: ActionMode.Awaits,
    triggeredBy: () =>
      keyboardTrigger(
        "Cut Shortcut",
        ["Cmd+x", "Ctrl+x"],
        isFocusedOnGraphRenderer
      ),
  },
  async (): Promise<void> => {
    const { controller } = bind;
    const { editor, readOnly } = controller.editor.graph;
    if (readOnly || !editor) return;

    const sel = controller.editor.selection;
    if (sel.size === 0) return;

    const workspaceState = sel.selection;
    const graph = controller.editor.graph.inspect("");
    const board = GraphUtils.generateBoardFrom(workspaceState, graph);
    const spec = GraphUtils.generateDeleteEditSpecFrom(workspaceState, graph);

    await Promise.all([
      navigator.clipboard.writeText(JSON.stringify(board, null, 2)),
      editor.apply(new MarkInPortsInvalidSpec(spec)),
    ]);
  }
);

/**
 * Paste from clipboard.
 *
 * **Triggers:** `Cmd+v` / `Ctrl+v`
 */
export const onPaste = asAction(
  "Node.onPaste",
  {
    mode: ActionMode.Awaits,
    triggeredBy: () =>
      keyboardTrigger("Paste Shortcut", ["Cmd+v", "Ctrl+v"], () => {
        const { controller } = bind;
        return !!controller.editor.graph.editor;
      }),
  },
  async (): Promise<void> => {
    const { controller, services } = bind;
    const { editor, readOnly } = controller.editor.graph;
    if (readOnly || !editor) return;

    const pointerLocation = controller.global.main.pointerLocation;

    const result = await new ClipboardReader(
      controller.editor.graph.url ?? undefined,
      services.loader
    ).read();

    let boardContents: GraphDescriptor | undefined;
    let boardUrl: string | undefined;
    let plainText: string | undefined;
    if ("graphUrl" in result) {
      boardUrl = result.graphUrl;
    } else if ("graphDescriptor" in result) {
      boardContents = result.graphDescriptor;
    } else if ("text" in result) {
      plainText = result.text;
    }

    const graph = controller.editor.graph.inspect("");
    let spec: EditSpec[] = [];

    if (boardContents) {
      // Since subgraphs are legacy, always paste into the main graph.
      const destGraphIds = [""];
      spec = GraphUtils.generateAddEditSpecFromDescriptor(
        boardContents,
        graph,
        pointerLocation,
        destGraphIds
      );
    } else if (boardUrl) {
      spec = GraphUtils.generateAddEditSpecFromURL(
        boardUrl,
        graph,
        pointerLocation
      );
    } else if (plainText) {
      // Use the statically registered Generate component.
      const maybeGenerate = A2_COMPONENTS.find(
        (component) => component.title === "Generate"
      );
      if (!maybeGenerate) return;

      spec = GraphUtils.generateAddEditSpecFromDescriptor(
        {
          edges: [],
          nodes: [
            {
              type: maybeGenerate.url,
              id: globalThis.crypto.randomUUID(),
              metadata: {
                title: "Pasted content",
              },
              configuration: {
                config$prompt: {
                  role: "user",
                  parts: [
                    {
                      text: plainText,
                    },
                  ],
                },
              },
            },
          ],
        },
        graph,
        pointerLocation,
        [""]
      );
    } else {
      return;
    }

    await editor.edit(spec, GraphUtils.createEditChangeId());

    // Select the newly pasted nodes
    const sel = controller.editor.selection;
    sel.deselectAll();
    for (const nodeId of GraphUtils.nodeIdsFromSpec(spec)) {
      sel.addNode(nodeId);
    }
  }
);

/**
 * Duplicate selected nodes.
 *
 * **Triggers:** `Cmd+d` / `Ctrl+d`, guard: focused on graph renderer
 */
export const onDuplicate = asAction(
  "Node.onDuplicate",
  {
    mode: ActionMode.Awaits,
    triggeredBy: () =>
      keyboardTrigger(
        "Duplicate Shortcut",
        ["Cmd+d", "Ctrl+d"],
        isFocusedOnGraphRenderer
      ),
  },
  async (): Promise<void> => {
    const { controller } = bind;
    const { editor, readOnly } = controller.editor.graph;
    if (readOnly || !editor) return;

    const sel = controller.editor.selection;
    if (sel.size === 0) return;

    const pointerLocation = controller.global.main.pointerLocation;
    const graph = controller.editor.graph.inspect("");
    const boardContents = GraphUtils.generateBoardFrom(sel.selection, graph);

    let spec: EditSpec[] = [];
    if (boardContents) {
      // Since subgraphs are legacy, always duplicate into the main graph.
      const destGraphIds = [""];
      spec = GraphUtils.generateAddEditSpecFromDescriptor(
        boardContents,
        graph,
        pointerLocation,
        destGraphIds
      );
    }

    await editor.edit(spec, GraphUtils.createEditChangeId());

    // Select the newly duplicated nodes
    sel.deselectAll();
    for (const nodeId of GraphUtils.nodeIdsFromSpec(spec)) {
      sel.addNode(nodeId);
    }
  }
);

/**
 * Undo via keyboard shortcut.
 *
 * **Triggers:** `Cmd+z` / `Ctrl+z`, guard: focused on graph renderer
 */
export const onUndoKeyboard = asAction(
  "Node.onUndoKeyboard",
  {
    mode: ActionMode.Immediate,
    triggeredBy: () =>
      keyboardTrigger(
        "Undo Shortcut",
        ["Cmd+z", "Ctrl+z"],
        isFocusedOnGraphRenderer
      ),
  },
  async (): Promise<void> => {
    const { controller } = bind;
    const history = controller.editor.graph.editor?.history();
    if (!history || !history.canUndo()) return;
    await history.undo();
  }
);

/**
 * Redo via keyboard shortcut.
 *
 * **Triggers:** `Cmd+Shift+z` / `Ctrl+Shift+z`, guard: focused on graph renderer
 */
export const onRedoKeyboard = asAction(
  "Node.onRedoKeyboard",
  {
    mode: ActionMode.Immediate,
    triggeredBy: () =>
      keyboardTrigger(
        "Redo Shortcut",
        ["Cmd+Shift+z", "Ctrl+Shift+z"],
        isFocusedOnGraphRenderer
      ),
  },
  async (): Promise<void> => {
    const { controller } = bind;
    const history = controller.editor.graph.editor?.history();
    if (!history || !history.canRedo()) return;
    await history.redo();
  }
);

// =============================================================================
// State-Event-Triggered Actions
// =============================================================================

/**
 * Handles a node action request from the console or graph.
 *
 * Maps the legacy "console" action context to "step" (the SCA-native name)
 * and sets the request on the RunController, which triggers pre-action
 * orchestration (e.g. applying pending edits) followed by action dispatch.
 *
 * **Triggers:** `node.action` StateEvent
 */
export const onNodeAction = asAction(
  "Node.onNodeAction",
  {
    mode: ActionMode.Immediate,
    triggeredBy: () => onNodeActionTrigger(bind),
  },
  async (evt?: StateEvent<"node.action">): Promise<void> => {
    const detail = evt!.detail;
    const { nodeId, actionContext } = detail;
    if (!actionContext) return;

    // Event uses "console" for step-list context; SCA uses "step".
    const mapped = actionContext === "console" ? "step" : actionContext;

    const { controller } = bind;
    controller.run.main.setNodeActionRequest({ nodeId, actionContext: mapped });
  }
);
