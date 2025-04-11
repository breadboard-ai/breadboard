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

function isFocusedOnGraphRenderer(evt: Event) {
  return evt
    .composedPath()
    .some((target) => target instanceof BreadboardUI.Elements.Renderer);
}

export const DeleteCommand: KeyboardCommand = {
  keys: ["Delete", "Backspace"],

  willHandle(evt: Event) {
    return isFocusedOnGraphRenderer(evt);
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
          projectState = runtime.state.getOrCreate(tab.mainGraphId, editor);
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

export const SelectAllCommand: KeyboardCommand = {
  keys: ["Cmd+a", "Ctrl+a"],

  willHandle(evt: Event) {
    return isFocusedOnGraphRenderer(evt);
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

export const CopyCommand: KeyboardCommand = {
  keys: ["Cmd+c", "Ctrl+c"],
  messagePending: "Copying to clipboard",
  messageComplete: "Copied to clipboard",
  messageType: BreadboardUI.Events.ToastType.INFORMATION,
  alwaysNotify: true,

  willHandle(evt: Event) {
    return isFocusedOnGraphRenderer(evt);
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

export const CutCommand: KeyboardCommand = {
  keys: ["Cmd+x", "Ctrl+x"],

  willHandle(evt: Event) {
    return isFocusedOnGraphRenderer(evt);
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

export const GroupCommand: KeyboardCommand = {
  keys: ["Cmd+g", "Ctrl+g"],

  willHandle(evt: Event) {
    return isFocusedOnGraphRenderer(evt);
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

export const UngroupCommand: KeyboardCommand = {
  keys: ["Cmd+Shift+g", "Ctrl+Shift+g"],

  willHandle(evt: Event) {
    return isFocusedOnGraphRenderer(evt);
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

// We do this unusual concatenation to bamboozle TypeScript. If we just check
// for the presence of 'canParse' in URL then the else case assumes we're
// dealing with the nodejs version of URL, which isn't necessarily the case; we
// could just as well be dealing with an older browser version. So we do this
// concatenation which is functionally inert but which means the TypeScript
// compiler continues to work on the assumption that it's a browser URL.
const cP = "" + "canParse";
function canParse(urlLike: string): boolean {
  const maybeFragment = urlLike.startsWith("#");

  if (cP in URL) {
    if (maybeFragment) {
      return URL.canParse(urlLike, window.location.href);
    }
    return URL.canParse(urlLike);
  }

  try {
    if (maybeFragment) {
      new URL(urlLike, window.location.href);
    } else {
      new URL(urlLike);
    }
    return true;
  } catch (err) {
    return false;
  }
}

export const PasteCommand: KeyboardCommand = {
  keys: ["Cmd+v", "Ctrl+v"],

  willHandle() {
    return true;
  },

  async do({
    runtime,
    tab,
    selectionState,
    pointerLocation,
  }: KeyboardCommandDeps): Promise<void> {
    const clipboardContents = await navigator.clipboard.readText();
    let boardContents: GraphDescriptor | undefined;
    let boardUrl: string | undefined;
    try {
      if (canParse(clipboardContents)) {
        boardUrl = (
          URL.parse(clipboardContents, tab?.graph.url) ?? { href: undefined }
        ).href;
      } else {
        boardContents = JSON.parse(clipboardContents);
        // TODO: Proper board checks.
        if (
          !boardContents ||
          !("edges" in boardContents && "nodes" in boardContents)
        ) {
          throw new Error("Not a board");
        }
      }

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
    } catch (err) {
      throw new Error("Invalid clipboard contents");
    }
  },
};
