/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EditSpec, GraphDescriptor } from "@breadboard-ai/types";
import { KeyboardCommand, KeyboardCommandDeps } from "./types.js";
import * as BreadboardUI from "../ui/index.js";
import { GraphUtils } from "../utils/graph-utils.js";
import { ClipboardReader } from "../utils/clipboard-reader.js";
import { Tab } from "../runtime/types.js";
import { Utils } from "../sca/utils.js";
import { A2_COMPONENTS } from "../a2/a2-registry.js";

function isFocusedOnGraphRenderer(evt: Event) {
  return evt
    .composedPath()
    .some((target) => target instanceof BreadboardUI.Elements.Renderer);
}

const SaveCommand: KeyboardCommand = {
  keys: ["Cmd+s", "Ctrl+s"],

  willHandle(tab: Tab | null) {
    return tab !== null;
  },

  async do({ sca, tab, strings }: KeyboardCommandDeps): Promise<void> {
    if (tab?.readOnly || !tab?.graphIsMine) {
      return;
    }

    await sca.actions.board.save({
      start: strings.from("STATUS_SAVING_PROJECT"),
      end: strings.from("STATUS_PROJECT_SAVED"),
    });
  },
};

const UndoCommand: KeyboardCommand = {
  keys: ["Cmd+z", "Ctrl+z"],

  willHandle(tab: Tab | null, evt: Event) {
    return tab !== null && isFocusedOnGraphRenderer(evt);
  },

  async do({ sca, tab }: KeyboardCommandDeps): Promise<void> {
    if (tab?.readOnly || !tab?.graphIsMine) {
      return;
    }

    sca.actions.graph.undo();
  },
};

const RedoCommand: KeyboardCommand = {
  keys: ["Cmd+Shift+z", "Ctrl+Shift+z"],

  willHandle(tab: Tab | null, evt: Event) {
    return tab !== null && isFocusedOnGraphRenderer(evt);
  },

  async do({ sca, tab }: KeyboardCommandDeps): Promise<void> {
    if (tab?.readOnly || !tab?.graphIsMine) {
      return;
    }

    sca.actions.graph.redo();
  },
};

const DeleteCommand: KeyboardCommand = {
  keys: ["Delete", "Backspace"],

  willHandle(tab: Tab | null, evt: Event) {
    return tab !== null && isFocusedOnGraphRenderer(evt);
  },

  async do({ sca, tab, originalEvent }: KeyboardCommandDeps): Promise<void> {
    if (tab?.readOnly) {
      return;
    }

    if (!isFocusedOnGraphRenderer(originalEvent)) {
      return;
    }

    const editor = sca.controller.editor.graph.editor;
    if (!editor) {
      throw new Error("Unable to edit");
    }

    const sel = sca.controller.editor.selection;
    if (!tab || sel.size === 0) {
      throw new Error("Nothing to delete");
    }

    const graph = editor.inspect("");
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
              new BreadboardUI.Transforms.ChangeAssetEdge("remove", "", {
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
        await sca.actions.asset.removeGraphAsset(asset);
      }
    }

    await editor.apply(
      new BreadboardUI.Transforms.MarkInPortsInvalidSpec(spec)
    );

    sel.deselectAll();
  },
};

let componentStatus = "Enabled";
const ToggleExperimentalComponentsCommand: KeyboardCommand = {
  keys: ["Cmd+Shift+e", "Ctrl+Shift+e"],
  alwaysNotify: true,
  get messageComplete() {
    return `Experimental Components ${componentStatus}`;
  },

  willHandle() {
    return true;
  },

  async do({ sca }: KeyboardCommandDeps): Promise<void> {
    sca.controller.global.main.experimentalComponents =
      !sca.controller.global.main.experimentalComponents;

    componentStatus = sca.controller.global.main.experimentalComponents
      ? "Enabled"
      : "Disabled";
  },
};

let debugStatus = "Enabled";
const ToggleDebugCommand: KeyboardCommand = {
  keys: ["Cmd+Shift+d", "Ctrl+Shift+d"],
  alwaysNotify: true,
  get messageComplete() {
    return `Debug ${debugStatus}`;
  },

  willHandle() {
    return true;
  },

  async do({ sca }: KeyboardCommandDeps): Promise<void> {
    sca.controller.global.debug.enabled = !sca.controller.global.debug.enabled;

    debugStatus = sca.controller.global.debug.enabled ? "Enabled" : "Disabled";
  },
};

const DownloadAgentTracesCommand: KeyboardCommand = {
  keys: ["Cmd+Shift+x", "Ctrl+Shift+x"],
  alwaysNotify: true,
  messagePending: "Downloading agent traces...",
  messageComplete: "Agent traces downloaded",
  messageType: BreadboardUI.Events.ToastType.INFORMATION,

  willHandle() {
    return true;
  },

  async do({ sca }: KeyboardCommandDeps): Promise<void> {
    const traces = sca.services.agentContext.exportTraces();
    if (traces.length === 0) {
      return;
    }
    const blob = new Blob([JSON.stringify(traces, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, "0");
    const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
    a.download = `agent-traces-${timestamp}.log.json`;
    a.click();
    URL.revokeObjectURL(url);
  },
};

const SelectAllCommand: KeyboardCommand = {
  keys: ["Cmd+a", "Ctrl+a"],

  willHandle(tab: Tab | null, evt: Event) {
    return tab !== null && isFocusedOnGraphRenderer(evt);
  },

  async do({ tab, originalEvent, sca }: KeyboardCommandDeps): Promise<void> {
    if (!isFocusedOnGraphRenderer(originalEvent)) {
      return;
    }

    const editor = sca.controller.editor.graph.editor;
    if (!editor) {
      return;
    }

    if (!tab) {
      throw new Error("Nothing to select");
    }

    const graph = editor.inspect("");
    sca.controller.editor.selection.selectAll(graph);
  },
};

const CopyCommand: KeyboardCommand = {
  keys: ["Cmd+c", "Ctrl+c"],
  messagePending: "Copying to clipboard",
  messageComplete: "Copied to clipboard",
  messageType: BreadboardUI.Events.ToastType.INFORMATION,
  alwaysNotify: true,

  willHandle(tab: Tab | null, evt: Event) {
    // If text is selected (e.g., error messages), allow native copy behavior.
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) {
      return false;
    }
    return tab !== null && isFocusedOnGraphRenderer(evt);
  },

  async do({ tab, originalEvent, sca }: KeyboardCommandDeps): Promise<void> {
    if (!isFocusedOnGraphRenderer(originalEvent)) {
      return;
    }

    const editor = sca.controller.editor.graph.editor;
    if (!editor) {
      throw new Error("Unable to edit graph");
    }

    const sel = sca.controller.editor.selection;
    if (!tab || sel.size === 0) {
      throw new Error("Nothing to copy");
    }

    const graph = editor.inspect("");
    const board = GraphUtils.generateBoardFrom(sel.selection, graph);

    await navigator.clipboard.writeText(JSON.stringify(board, null, 2));
  },
};

const CutCommand: KeyboardCommand = {
  keys: ["Cmd+x", "Ctrl+x"],

  willHandle(tab: Tab | null, evt: Event) {
    return tab !== null && isFocusedOnGraphRenderer(evt);
  },

  async do({ tab, originalEvent, sca }: KeyboardCommandDeps): Promise<void> {
    if (!isFocusedOnGraphRenderer(originalEvent)) {
      return;
    }

    if (tab?.readOnly) {
      return;
    }

    const editor = sca.controller.editor.graph.editor;
    if (!editor) {
      throw new Error("Unable to edit");
    }

    const sel = sca.controller.editor.selection;
    if (!tab || sel.size === 0) {
      throw new Error("Nothing to cut");
    }

    const workspaceState = sel.selection;
    const graph = editor.inspect("");
    const board = GraphUtils.generateBoardFrom(workspaceState, graph);
    const spec = GraphUtils.generateDeleteEditSpecFrom(workspaceState, graph);

    await Promise.all([
      navigator.clipboard.writeText(JSON.stringify(board, null, 2)),
      await editor.apply(
        new BreadboardUI.Transforms.MarkInPortsInvalidSpec(spec)
      ),
    ]);
  },
};

const PasteCommand: KeyboardCommand = {
  keys: ["Cmd+v", "Ctrl+v"],

  willHandle(tab: Tab | null) {
    return tab !== null;
  },

  async do({ tab, pointerLocation, sca }: KeyboardCommandDeps): Promise<void> {
    if (tab?.readOnly) {
      return;
    }

    const result = await new ClipboardReader(
      tab?.graph.url,
      sca.services.loader
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

    // Option 1. User pastes a board when there is no tab - create a new tab
    if (tab) {
      const editor = sca.controller.editor.graph.editor;
      if (!editor) {
        throw new Error("Unable to edit graph");
      }

      const graph = editor.inspect("");
      let spec: EditSpec[] = [];
      // 1a. Paste a board.
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
        // 1b. Paste a URL.
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
        if (!maybeGenerate) {
          return;
        }

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
      const sel = sca.controller.editor.selection;
      sel.deselectAll();
      for (const nodeId of GraphUtils.nodeIdsFromSpec(spec)) {
        sel.addNode(nodeId);
      }
    }
  },
};

const DuplicateCommand: KeyboardCommand = {
  keys: ["Cmd+d", "Ctrl+d"],

  willHandle(tab: Tab | null, evt: Event) {
    return tab !== null && isFocusedOnGraphRenderer(evt);
  },

  async do({
    tab,
    pointerLocation,
    originalEvent,
    sca,
  }: KeyboardCommandDeps): Promise<void> {
    if (!isFocusedOnGraphRenderer(originalEvent)) {
      return;
    }

    const editor = sca.controller.editor.graph.editor;
    if (!editor) {
      throw new Error("Unable to edit graph");
    }

    const sel = sca.controller.editor.selection;
    if (!tab || sel.size === 0) {
      throw new Error("Nothing to duplicate");
    }

    if (tab?.readOnly) {
      return;
    }

    const graph = editor.inspect("");
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
  },
};

export const keyboardCommands = new Map<string[], KeyboardCommand>([
  [SaveCommand.keys, SaveCommand],
  [DeleteCommand.keys, DeleteCommand],
  [SelectAllCommand.keys, SelectAllCommand],
  [CopyCommand.keys, CopyCommand],
  [CutCommand.keys, CutCommand],
  [PasteCommand.keys, PasteCommand],
  [
    ToggleExperimentalComponentsCommand.keys,
    ToggleExperimentalComponentsCommand,
  ],
  [ToggleDebugCommand.keys, ToggleDebugCommand],
  [DownloadAgentTracesCommand.keys, DownloadAgentTracesCommand],
  [UndoCommand.keys, UndoCommand],
  [RedoCommand.keys, RedoCommand],
  [DuplicateCommand.keys, DuplicateCommand],
]);
