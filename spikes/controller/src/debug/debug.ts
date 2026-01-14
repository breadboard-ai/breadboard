/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { effect } from "signal-utils/subtle/microtask-effect";
import { Controller } from "../controller/controller.js";
import type { Pane, FolderApi, BaseBladeParams } from "tweakpane";
import { isHydrating } from "../controller/utils/hydration.js";
import { DebugBinding } from "../controller/types.js";

/**
 * Global state for the debug interface lifecycle.
 */
let pane: Pane | undefined;

const debugDisposables = new Map<string, () => void>();
const folderCache = new Map<string, FolderApi>();
const bladeRegistry = new Map<
  string,
  { blade: ReturnType<FolderApi["addBinding"]>; path: string }
>();

/**
 * Initializes the Tweakpane console if debugging is enabled.
 */
export async function maybeAddDebugControls(
  controller: Controller,
  element: HTMLElement
) {
  if (!controller.debug.show) return;

  const { Pane } = await import("tweakpane");
  pane = new Pane({ title: "Debug Console", container: element });
  const g = pane.addFolder({ title: "Global", expanded: false });
  g.addBinding(controller.debug.log.levels, "verbose", { label: "Verbose" });
  g.addBinding(controller.debug.log.levels, "info", { label: "Info" });
  g.addBinding(controller.debug.log.levels, "errors", { label: "Errors" });
  g.addBinding(controller.debug.log.levels, "warnings", { label: "Warnings" });

  injectStyles(element);
  buildHierarchy(controller, pane);
}

/**
 * Moves Tweakpane's global styles into the local container for correct rendering.
 */
function injectStyles(element: HTMLElement) {
  const styles = document.querySelector(
    'style[data-tp-style="plugin-default"]'
  );
  if (!styles) throw new Error("Tweakpane styles not found.");
  element.appendChild(styles);
}

/**
 * Builds the folder structure and deferred bindings.
 */
function buildHierarchy(controller: Controller, targetPane: Pane) {
  const sortedEntries = [...controller.debug.values.entries()].sort((a, b) =>
    a[0].localeCompare(b[0])
  );

  for (const [fullPath, { config, binding }] of sortedEntries) {
    const segments = fullPath.split("/").filter(Boolean);
    const propertyName = segments.pop() ?? "unknown";
    const parentFolder = ensureFoldersExist(segments, targetPane);

    waitForHydrationAndBind(
      fullPath,
      propertyName,
      config,
      binding,
      parentFolder
    );
  }
}

/**
 * Watches the signal and only creates the UI binding once the data is ready.
 */
function waitForHydrationAndBind(
  fullPath: string,
  label: string,
  config: BaseBladeParams,
  binding: DebugBinding,
  parent: Pane | FolderApi
) {
  let initialized = false;

  const dispose = effect(() => {
    const currentValue = binding.get();

    if (isHydrating(currentValue)) return;

    if (!initialized) {
      initialized = true;
      try {
        const blade = finalizeBinding(label, config, binding, parent);
        bladeRegistry.set(fullPath, { blade, path: fullPath.toLowerCase() });
      } catch (e) {
        console.warn(`[Debug] Failed to bind ${fullPath}:`, e);
      }
    } else {
      const registered = bladeRegistry.get(fullPath);
      if (registered) registered.blade.refresh();
    }
  });

  debugDisposables.set(fullPath, dispose);
}

/**
 * Creates the binding with specific handling for colors and objects.
 */
function finalizeBinding(
  label: string,
  config: BaseBladeParams,
  binding: DebugBinding,
  parent: Pane | FolderApi
) {
  const initialValue = binding.get();
  const isObject = typeof initialValue === "object" && initialValue !== null;

  const proxy = {
    get value() {
      return binding.get();
    },
    set value(v) {
      const current = binding.get();
      if (isHydrating(current)) return;

      // Handle object reference identity (crucial for colors)
      if (v !== current) {
        const newValue = isObject ? (Array.isArray(v) ? [...v] : { ...v }) : v;
        binding.set(newValue);
      }
    },
  };

  const blade = parent.addBinding(proxy, "value", {
    ...config,
    label: (config.label as string) ?? label,
  });

  // Explicit change listener bypasses proxy assignment issues for complex types
  blade.on("change", (ev) => {
    if (typeof ev.value !== "object") return;
    binding.set(structuredClone(ev.value));
  });

  return blade;
}

/**
 * Creates nested folders and caches them to avoid duplication.
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
        expanded: true,
      });
      folderCache.set(pathAccumulator, folder);
    }
    currentParent = folderCache.get(pathAccumulator)!;
  }

  return currentParent;
}

/**
 * Disposes of the pane and all signal effects.
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
