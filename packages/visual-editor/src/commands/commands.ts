/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphDescriptor } from "@breadboard-ai/types";
import { KeyboardCommand, KeyboardCommandDeps } from "./types";
import * as BreadboardUI from "@breadboard-ai/shared-ui";
import { EditSpec } from "@google-labs/breadboard";
import { MAIN_BOARD_ID } from "../runtime/util";
import { inspectableAssetEdgeToString } from "@breadboard-ai/shared-ui/utils/workspace.js";
import { ClipboardReader } from "../utils/clipboard-reader";
import { Tab } from "../runtime/types";

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

  async do({ runtime, tab, strings }: KeyboardCommandDeps): Promise<void> {
    if (tab?.readOnly || !tab?.graphIsMine) {
      return;
    }

    await runtime.board.save(tab?.id ?? null, 0, {
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

  async do({ runtime, tab }: KeyboardCommandDeps): Promise<void> {
    if (tab?.readOnly || !tab?.graphIsMine) {
      return;
    }

    runtime.edit.undo(tab);
  },
};

const RedoCommand: KeyboardCommand = {
  keys: ["Cmd+Shift+z", "Ctrl+Shift+z"],

  willHandle(tab: Tab | null, evt: Event) {
    return tab !== null && isFocusedOnGraphRenderer(evt);
  },

  async do({ runtime, tab }: KeyboardCommandDeps): Promise<void> {
    if (tab?.readOnly || !tab?.graphIsMine) {
      return;
    }

    runtime.edit.redo(tab);
  },
};

const DeleteCommand: KeyboardCommand = {
  keys: ["Delete", "Backspace"],

  willHandle(tab: Tab | null, evt: Event) {
    return tab !== null && isFocusedOnGraphRenderer(evt);
  },

  async do({
    runtime,
    selectionState,
    tab,
    originalEvent,
  }: KeyboardCommandDeps): Promise<void> {
    if (tab?.readOnly) {
      return;
    }

    if (!isFocusedOnGraphRenderer(originalEvent)) {
      return;
    }

    const editor = runtime.edit.getEditor(tab);
    if (!editor) {
      throw new Error("Unable to edit");
    }

    if (
      !tab ||
      !selectionState ||
      (!tab.moduleId && selectionState.selectionState.graphs.size === 0)
    ) {
      throw new Error("Nothing to delete");
    }

    const graph = editor.inspect("");
    const spec = runtime.util.generateDeleteEditSpecFrom(
      selectionState.selectionState,
      graph
    );

    let projectState: BreadboardUI.State.Project | null = null;
    for (const selectionGraph of selectionState.selectionState.graphs.values()) {
      // First delete any selected Asset Edges.
      if (selectionGraph.assetEdges.size) {
        const assetEdges = graph.assetEdges();

        if (Array.isArray(assetEdges)) {
          for (const selectedAssetEdge of selectionGraph.assetEdges) {
            for (const assetEdge of assetEdges) {
              if (
                selectedAssetEdge !== inspectableAssetEdgeToString(assetEdge)
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

      // Then delete any selected Assets.
      if (selectionGraph.assets.size) {
        if (!projectState) {
          projectState = runtime.state.getOrCreateProjectState(
            tab.mainGraphId,
            editor
          );
        }

        if (!projectState) {
          continue;
        }

        for (const asset of selectionGraph.assets) {
          await projectState.organizer.removeGraphAsset(asset);
        }
      }
    }

    await editor.apply(
      new BreadboardUI.Transforms.MarkInPortsInvalidSpec(spec)
    );

    runtime.select.deselectAll(
      tab.id,
      runtime.util.createWorkspaceSelectionChangeId()
    );
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

  async do({ settings }: KeyboardCommandDeps): Promise<void> {
    if (!settings) {
      return;
    }

    const setting = settings.getItem(
      BreadboardUI.Types.SETTINGS_TYPE.GENERAL,
      "Show Experimental Components"
    );

    if (setting && typeof setting.value === "boolean") {
      const newSetting = structuredClone(setting);
      newSetting.value = !newSetting.value;
      componentStatus = newSetting.value ? "Enabled" : "Disabled";

      settings.setItem(
        BreadboardUI.Types.SETTINGS_TYPE.GENERAL,
        "Show Experimental Components",
        newSetting
      );
      settings.saveItem(BreadboardUI.Types.SETTINGS_TYPE.GENERAL, newSetting);
    }
  },
};

const SelectAllCommand: KeyboardCommand = {
  keys: ["Cmd+a", "Ctrl+a"],

  willHandle(tab: Tab | null, evt: Event) {
    return tab !== null && isFocusedOnGraphRenderer(evt);
  },

  async do({
    runtime,
    tab,
    originalEvent,
  }: KeyboardCommandDeps): Promise<void> {
    if (!isFocusedOnGraphRenderer(originalEvent)) {
      return;
    }

    const editor = runtime.edit.getEditor(tab);
    if (!editor) {
      return;
    }

    if (!tab) {
      throw new Error("Nothing to select");
    }

    const graph = editor.inspect("");
    runtime.select.selectAll(tab.id, runtime.select.generateId(), graph);
  },
};

const CopyCommand: KeyboardCommand = {
  keys: ["Cmd+c", "Ctrl+c"],
  messagePending: "Copying to clipboard",
  messageComplete: "Copied to clipboard",
  messageType: BreadboardUI.Events.ToastType.INFORMATION,
  alwaysNotify: true,

  willHandle(tab: Tab | null, evt: Event) {
    return tab !== null && isFocusedOnGraphRenderer(evt);
  },

  async do({
    runtime,
    selectionState,
    tab,
    originalEvent,
  }: KeyboardCommandDeps): Promise<void> {
    if (!isFocusedOnGraphRenderer(originalEvent)) {
      return;
    }

    const editor = runtime.edit.getEditor(tab);
    if (!editor) {
      throw new Error("Unable to edit graph");
    }

    if (
      !tab ||
      !selectionState ||
      selectionState.selectionState.graphs.size === 0
    ) {
      throw new Error("Nothing to copy");
    }

    const graph = editor.inspect("");
    const board = runtime.util.generateBoardFrom(
      selectionState.selectionState,
      graph
    );

    await navigator.clipboard.writeText(JSON.stringify(board, null, 2));
  },
};

const CutCommand: KeyboardCommand = {
  keys: ["Cmd+x", "Ctrl+x"],

  willHandle(tab: Tab | null, evt: Event) {
    return tab !== null && isFocusedOnGraphRenderer(evt);
  },

  async do({
    runtime,
    selectionState,
    tab,
    originalEvent,
  }: KeyboardCommandDeps): Promise<void> {
    if (!isFocusedOnGraphRenderer(originalEvent)) {
      return;
    }

    if (tab?.readOnly) {
      return;
    }

    const editor = runtime.edit.getEditor(tab);
    if (!editor) {
      throw new Error("Unable to edit");
    }

    if (
      !tab ||
      !selectionState ||
      selectionState.selectionState.graphs.size === 0
    ) {
      throw new Error("Nothing to cut");
    }

    const graph = editor.inspect("");
    const board = runtime.util.generateBoardFrom(
      selectionState.selectionState,
      graph
    );

    const spec = runtime.util.generateDeleteEditSpecFrom(
      selectionState.selectionState,
      graph
    );

    await Promise.all([
      navigator.clipboard.writeText(JSON.stringify(board, null, 2)),
      await editor.apply(
        new BreadboardUI.Transforms.MarkInPortsInvalidSpec(spec)
      ),
    ]);
  },
};

const GroupCommand: KeyboardCommand = {
  keys: ["Cmd+g", "Ctrl+g"],

  willHandle(tab: Tab | null, evt: Event) {
    return tab !== null && isFocusedOnGraphRenderer(evt);
  },

  async do({
    runtime,
    selectionState,
    tab,
    originalEvent,
  }: KeyboardCommandDeps): Promise<void> {
    if (!isFocusedOnGraphRenderer(originalEvent)) {
      return;
    }

    if (tab?.readOnly) {
      return;
    }

    const editor = runtime.edit.getEditor(tab);
    if (!editor) {
      throw new Error("Unable to edit");
    }

    if (
      !tab ||
      !selectionState ||
      selectionState.selectionState.graphs.size === 0
    ) {
      throw new Error("Nothing to group");
    }

    const destinationGraphId = globalThis.crypto.randomUUID();
    for (const [sourceGraphId, selection] of selectionState.selectionState
      .graphs) {
      if (selection.nodes.size === 0) {
        continue;
      }

      await runtime.edit.moveNodesToGraph(
        tab,
        [...selection.nodes],
        sourceGraphId === MAIN_BOARD_ID ? "" : sourceGraphId,
        destinationGraphId
      );
    }

    // Clear all selections.
    runtime.select.processSelections(
      tab.id,
      runtime.util.createWorkspaceSelectionChangeId(),
      null,
      true
    );
  },
};

const UngroupCommand: KeyboardCommand = {
  keys: ["Cmd+Shift+g", "Ctrl+Shift+g"],

  willHandle(tab: Tab | null, evt: Event) {
    return tab !== null && isFocusedOnGraphRenderer(evt);
  },

  async do({
    runtime,
    selectionState,
    tab,
    originalEvent,
  }: KeyboardCommandDeps): Promise<void> {
    if (!isFocusedOnGraphRenderer(originalEvent)) {
      return;
    }

    if (tab?.readOnly) {
      return;
    }

    const editor = runtime.edit.getEditor(tab);
    if (!editor) {
      throw new Error("Unable to edit");
    }

    if (
      !tab ||
      !selectionState ||
      selectionState.selectionState.graphs.size === 0
    ) {
      throw new Error("Nothing to ungroup");
    }

    for (const [sourceGraphId, selection] of selectionState.selectionState
      .graphs) {
      if (selection.nodes.size === 0) {
        continue;
      }

      if (sourceGraphId === MAIN_BOARD_ID) {
        continue;
      }

      await runtime.edit.moveNodesToGraph(
        tab,
        [...selection.nodes],
        sourceGraphId,
        ""
      );
    }

    // Clear all selections.
    runtime.select.processSelections(
      tab.id,
      runtime.util.createWorkspaceSelectionChangeId(),
      null,
      true
    );
  },
};

const PasteCommand: KeyboardCommand = {
  keys: ["Cmd+v", "Ctrl+v"],

  willHandle(tab: Tab | null) {
    return tab !== null;
  },

  async do({
    runtime,
    tab,
    selectionState,
    pointerLocation,
  }: KeyboardCommandDeps): Promise<void> {
    if (tab?.readOnly) {
      return;
    }

    const result = await new ClipboardReader(
      tab?.graph.url,
      runtime.edit.graphStore
    ).read();

    let boardContents: GraphDescriptor | undefined;
    let boardUrl: string | undefined;
    if ("graphUrl" in result) {
      boardUrl = result.graphUrl;
    } else if ("graphDescriptor" in result) {
      boardContents = result.graphDescriptor;
    }
    // .. and more

    // Option 1. User pastes a board when there is no tab - create a new tab
    if (tab) {
      const editor = runtime.edit.getEditor(tab);
      if (!editor) {
        throw new Error("Unable to edit graph");
      }

      const graph = editor.inspect("");
      let spec: EditSpec[] = [];
      // 1a. Paste a board.
      if (boardContents) {
        const destGraphIds = [];
        if (selectionState) {
          for (const id of selectionState.selectionState.graphs.keys()) {
            const state = selectionState.selectionState.graphs.get(id);
            if (
              !state ||
              (state.edges.size === 0 &&
                state.nodes.size === 0 &&
                state.comments.size === 0)
            ) {
              continue;
            }

            if (id === MAIN_BOARD_ID) {
              destGraphIds.push("");
              continue;
            }

            destGraphIds.push(id);
          }
        }

        if (destGraphIds.length === 0) {
          destGraphIds.push("");
        }

        spec = runtime.util.generateAddEditSpecFromDescriptor(
          boardContents,
          graph,
          pointerLocation,
          destGraphIds
        );
      } else if (boardUrl) {
        // 1b. Paste a URL.
        spec = runtime.util.generateAddEditSpecFromURL(
          boardUrl,
          graph,
          pointerLocation
        );
      } else {
        throw new Error("Unable to paste; neither URL nor GraphDescriptor");
      }

      await editor.edit(spec, runtime.util.createEditChangeId());
      const workspaceSelection = runtime.util.generateSelectionFrom(spec);

      runtime.select.processSelections(
        tab.id,
        runtime.util.createWorkspaceSelectionChangeId(),
        workspaceSelection
      );
    } else {
      // Option 2. User pastes a board.
      if (boardContents) {
        runtime.board.createTabFromDescriptor(boardContents);
      }
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
  [GroupCommand.keys, GroupCommand],
  [UngroupCommand.keys, UngroupCommand],
  [
    ToggleExperimentalComponentsCommand.keys,
    ToggleExperimentalComponentsCommand,
  ],
  [UndoCommand.keys, UndoCommand],
  [RedoCommand.keys, RedoCommand],
]);
