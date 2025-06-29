/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LifecyclePathRegistryEntry } from "@breadboard-ai/types";

export const emptyEntry = () => ({
  children: [],
  data: null,
});

// A more generic clone of inspector/run/PathRegistry
// TODO: Reconcile the two implementations.
export class Registry<Data> {
  root: LifecyclePathRegistryEntry<Data>;
  // parent: LifecyclePathRegistryEntry | null;

  constructor(root: LifecyclePathRegistryEntry<Data> = emptyEntry()) {
    this.root = root;
  }

  // constructor(parent: LifecyclePathRegistryEntry | null) {
  //   this.parent = parent;
  // }

  /**
   * The main traversal function for the path registry. It will find the
   * entry for the given path, creating it if permitted, and return it.
   *
   * This function is what builds the graph tree.
   *
   * @param readonly -- If true, the registry is read-only and will not be
   *    modified.
   * @param registry -- The registry to traverse. Used in recursion.
   * @param fullPath -- The full path to the current node. Passed along during
   *   recursion.
   * @param path -- The current path to the node. Used in recursion.
   * @returns -- The entry for the given path, or undefined if the path is
   *  empty or invalid.
   */
  #findOrCreate(
    current: LifecyclePathRegistryEntry<Data>,
    readonly: boolean,
    fullPath: number[],
    path: number[]
  ): LifecyclePathRegistryEntry<Data> | null {
    // Marking events dirty, because we're about to mutate something within
    // this swath of the registry.
    const [head, ...tail] = path;
    if (head === undefined) {
      return null;
    }
    let entry = current.children[head];
    if (!entry) {
      if (tail.length !== 0) {
        // If you see this message in the console, it's a problem with the
        // underlying runner. The runner should always provide paths
        // incrementally, so there should never be a situation where we don't
        // have a registry entry for an index in the middle of the path.
        console.warn("Path registry entry not found for", path, "in", fullPath);
      }
      if (readonly) {
        console.warn("Path registry is read-only. Not adding", fullPath);
        return null;
      }
      entry = current.children[head] = emptyEntry();
    }
    if (tail.length === 0) {
      return entry;
    }
    return this.#findOrCreate(entry, readonly, fullPath, tail);
  }

  find(path: number[]) {
    return this.#findOrCreate(this.root, true, path, path);
  }

  create(path: number[]) {
    return this.#findOrCreate(
      this.root,
      false,
      path,
      path
    ) as LifecyclePathRegistryEntry<Data>;
  }
}
