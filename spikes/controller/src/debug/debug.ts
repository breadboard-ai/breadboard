/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { effect } from "signal-utils/subtle/microtask-effect";
import { Controller } from "../controller/controller";
import type { Pane, FolderApi, BaseBladeParams } from "tweakpane";
import { isHydrating } from "../controller/utils/hydration";
import { DebugBinding } from "../controller/types";

/**
 * Types and State Management
 */
let pane: Pane | undefined;

const debugDisposables = new Map<string, () => void>();
const folderCache = new Map<string, FolderApi>();
const bladeRegistry = new Map<
  string,
  { blade: ReturnType<FolderApi["addBinding"]>; path: string }
>();

/**
 * Main entry point for initializing the Tweakpane debug interface.
 */
export async function maybeAddDebugControls(
  controller: Controller,
  element: HTMLElement
) {
  if (!controller.debug.show) return;

  const { Pane } = await import("tweakpane");
  pane = new Pane({ title: "Debug Console", container: element });

  injectStyles(element);
  setupFilter(pane);
  buildHierarchy(controller, pane);
}

/**
 * Tweakpane injects default styles into the head; we move them to the
 * specific container to ensure proper encapsulation or rendering.
 */
function injectStyles(element: HTMLElement) {
  const styles = document.querySelector(
    'style[data-tp-style="plugin-default"]'
  );
  if (!styles) {
    throw new Error(
      "Unable to render debug console: Tweakpane styles not found."
    );
  }
  element.appendChild(styles);
}

/**
 * Adds a search input to the top of the pane to filter bindings by path.
 */
function setupFilter(targetPane: Pane) {
  const filterState = { query: "" };
  targetPane
    .addBinding(filterState, "query", { label: "Filter" })
    .on("change", (ev) => applyFilter(ev.value.toLowerCase()));
}

/**
 * Iterates through registered debug values and constructs the folder tree.
 */
function buildHierarchy(controller: Controller, targetPane: Pane) {
  const sortedEntries = [...controller.debug.values.entries()].sort((a, b) =>
    a[0].localeCompare(b[0])
  );

  for (const [fullPath, { config, binding }] of sortedEntries) {
    const segments = fullPath.split("/").filter(Boolean);
    const propertyName = segments.pop() ?? "unknown";

    const parentFolder = ensureFoldersExist(segments, targetPane);
    createBinding(fullPath, propertyName, config, binding, parentFolder);
  }
}

/**
 * Recursively creates or retrieves nested folders based on path segments.
 */
function ensureFoldersExist(segments: string[], root: Pane): Pane | FolderApi {
  let currentParent: Pane | FolderApi = root;
  let pathAccumulator = "";

  for (const segment of segments) {
    pathAccumulator = pathAccumulator
      ? `${pathAccumulator}/${segment}`
      : segment;

    if (!folderCache.has(pathAccumulator)) {
      const folder = currentParent.addFolder({
        title: segment.charAt(0).toUpperCase() + segment.slice(1),
        expanded: false,
      });
      folderCache.set(pathAccumulator, folder);
    }
    currentParent = folderCache.get(pathAccumulator)!;
  }

  return currentParent;
}

/**
 * Sets up the individual binding with a proxy for Signal synchronization
 * and an effect for reactive UI updates.
 */
function createBinding(
  fullPath: string,
  label: string,
  config: BaseBladeParams,
  binding: DebugBinding,
  parent: Pane | FolderApi
) {
  const proxy = {
    get value() {
      const v = binding.get();
      // Handle hydration state to prevent Tweakpane from failing on null/undefined
      return isHydrating(v) ? 0 : v;
    },
    set value(v) {
      binding.set(v);
    },
  };

  try {
    const blade = parent.addBinding(proxy, "value", {
      ...config,
      label: (config.label as string) ?? label,
    });

    bladeRegistry.set(fullPath, { blade, path: fullPath.toLowerCase() });

    const dispose = effect(() => {
      binding.get(); // Establish signal dependency
      blade.refresh();
    });

    debugDisposables.set(fullPath, dispose);
  } catch (e) {
    console.warn(`[Debug] Could not bind ${fullPath}:`, e);
  }
}

/**
 * Hides/Shows blades and folders based on search query and auto-expands matches.
 */
function applyFilter(query: string) {
  const isSearching = query.length > 0;

  // Update visibility for individual bindings
  bladeRegistry.forEach(({ blade, path }) => {
    blade.hidden = !path.includes(query);
  });

  // Update visibility and expansion for folders
  folderCache.forEach((folder, folderPath) => {
    const lowerPath = folderPath.toLowerCase();
    const hasVisibleChild = Array.from(bladeRegistry.values()).some(
      (item) => item.path.startsWith(lowerPath) && !item.blade.hidden
    );

    if (isSearching) {
      folder.expanded = hasVisibleChild;
      folder.hidden = !hasVisibleChild;
    } else {
      folder.hidden = false;
      // Note: We don't force collapse here to preserve user state
    }
  });
}

/**
 * Tears down the pane and cleans up all active signal effects.
 */
export function maybeRemoveDebugControls() {
  if (!pane) return;

  debugDisposables.forEach((dispose) => dispose());
  pane.dispose();

  pane = undefined;
  debugDisposables.clear();
  folderCache.clear();
  bladeRegistry.clear();
}
