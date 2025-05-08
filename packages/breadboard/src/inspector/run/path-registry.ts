/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ModuleIdentifier } from "@breadboard-ai/types";
import { timestamp } from "../../timestamp.js";
import { GraphIdentifier, OutputValues } from "../../types.js";
import {
  InspectableGraph,
  InspectableRunEdge,
  InspectableRunErrorEvent,
  InspectableRunEvent,
  InspectableRunNodeEvent,
  MainGraphIdentifier,
  PathRegistryEntry,
  SequenceView,
} from "../types.js";
import { idFromPath } from "./conversions.js";

export const SECRET_PATH = [-2];
export const ERROR_PATH = [-3];

export const createSimpleEntry = (
  path: number[],
  event: InspectableRunEvent
) => {
  const entry: PathRegistryEntry = {
    path,
    parent: null,
    children: [],
    mainGraphId: null,
    moduleId: null,
    graphId: "",
    graphStart: 0,
    graphEnd: 0,
    event,
    sidecars: [],
    empty: () => true,
    events: [],
    edges: [],
    graph: null,
    view: null,
    find: () => null,
  };
  return entry;
};

class Entry implements PathRegistryEntry {
  id: string = "";
  parent: PathRegistryEntry | null;
  #events: InspectableRunEvent[] = [];
  #eventsIsDirty = false;
  #children: Entry[] = [];
  event: InspectableRunEvent | null = null;
  sidecars: InspectableRunEvent[] = [];
  // Keep track of some sidecar events so that we can clean them up later.
  // We only need to keep track of input and output events, since the
  // secret and error do not have a corresponding `nodeend` event.
  #trackedSidecars: Map<string, InspectableRunEvent> = new Map();

  mainGraphId: MainGraphIdentifier | null = null;
  /**
   * If this entry represents a module that is running, this value must be
   * set to the id of the module.
   */
  moduleId: ModuleIdentifier | null = null;
  graphId: GraphIdentifier = "";
  // Wait until `graphstart` event to set the start time.
  graphStart: number = 0;
  graphEnd: number | null = null;
  graph: InspectableGraph | null = null;
  edges: InspectableRunEdge[] = [];
  view: SequenceView | null = null;

  constructor(
    public path: number[],
    parent: PathRegistryEntry | null
  ) {
    this.id = idFromPath(path);
    this.parent = parent;
  }

  empty(): boolean {
    return this.#children.length === 0;
  }

  addSidecar(path: number[], event: InspectableRunEvent) {
    const key = idFromPath(path);
    this.children[this.children.length - 1].sidecars.push(event);
    this.#trackedSidecars.set(key, event);
    this.#eventsIsDirty = true;
  }

  /**
   * We handle error specially, because unlike sidecars, errors result
   * in stopping the run, and we need to display them at the end of the run.
   * @param event -- The error event to add.
   */
  addError(event: InspectableRunErrorEvent) {
    const entry = this.create([this.#children.length]);
    entry.event = event as unknown as InspectableRunNodeEvent;
  }

  finalizeSidecar(
    path: number[],
    data?: { timestamp: number; outputs?: OutputValues }
  ) {
    const key = idFromPath(path);
    const sidecar = this.#trackedSidecars.get(key);
    switch (sidecar?.type) {
      // These are bubbling inputs and inputs.
      case "node": {
        if (data) {
          sidecar.end = data.timestamp;
          sidecar.outputs = data.outputs || null;
        }
        break;
      }
      case "secret": {
        sidecar.end = data?.timestamp || timestamp();
        break;
      }
    }
    this.#trackedSidecars.delete(key);
    this.#eventsIsDirty = true;
  }

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
    readonly: boolean,
    fullPath: number[],
    path: number[]
  ): PathRegistryEntry | null {
    // Marking events dirty, because we're about to mutate something within
    // this swath of the registry.
    if (!readonly) this.#eventsIsDirty = true;
    const [head, ...tail] = path;
    if (head === undefined) {
      return null;
    }
    let entry = this.#children[head];
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
      entry = this.#children[head] = new Entry(fullPath, this);
    }
    if (tail.length === 0) {
      return entry;
    }
    return entry.#findOrCreate(readonly, fullPath, tail);
  }

  find(path: number[]) {
    return this.#findOrCreate(true, path, path);
  }

  create(path: number[]) {
    return this.#findOrCreate(false, path, path) as Entry;
  }

  arrangeSidecars() {
    const before: InspectableRunNodeEvent[] = [];
    const after: InspectableRunNodeEvent[] = [];
    this.sidecars.forEach((sidecar) => {
      const event = sidecar as InspectableRunNodeEvent;
      if (event.end === null) {
        after.push(event);
      } else {
        before.push(event);
      }
    });
    if (this.event?.type === "node") {
      if (this.event.end !== null && this.event.hidden) {
        return null;
      }
    }
    return [...before, this.event, ...after];
  }

  get children() {
    return this.#children;
  }

  #updateEvents() {
    this.#events = this.#children
      .filter(Boolean)
      .flatMap((entry) => entry.arrangeSidecars())
      .filter(Boolean) as InspectableRunEvent[];
  }

  get events() {
    if (this.#eventsIsDirty) {
      this.#updateEvents();
      this.#eventsIsDirty = false;
    }
    return this.#events;
  }
}

export class PathRegistry extends Entry {
  constructor() {
    super([], null);
  }

  override find(path: number[]): PathRegistryEntry | null {
    if (path.length == 0) return this;
    return super.find(path);
  }

  override create(path: number[]): Entry {
    if (path.length == 0) return this;
    return super.create(path);
  }
}
