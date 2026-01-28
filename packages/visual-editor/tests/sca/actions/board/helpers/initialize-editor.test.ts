/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { afterEach, beforeEach, suite, test } from "node:test";
import type { GraphDescriptor, MutableGraphStore } from "@breadboard-ai/types";
import {
  initializeEditor,
  resetEditor,
} from "../../../../../src/sca/actions/board/helpers/initialize-editor.js";
import type * as Editor from "../../../../../src/sca/controller/subcontrollers/editor/editor.js";
import { setDOM, unsetDOM } from "../../../../fake-dom.js";

function makeMockGraphController(): Editor.Graph.GraphController {
  const state: Record<string, unknown> = {};
  return {
    get id() {
      return state.id as string;
    },
    set id(v: string) {
      state.id = v;
    },
    setEditor: (e: unknown) => {
      state.editor = e;
    },
    get url() {
      return state.url as string;
    },
    set url(v: string) {
      state.url = v;
    },
    get version() {
      return state.version as number;
    },
    set version(v: number) {
      state.version = v;
    },
    get readOnly() {
      return state.readOnly as boolean;
    },
    set readOnly(v: boolean) {
      state.readOnly = v;
    },
    get graphIsMine() {
      return state.graphIsMine as boolean;
    },
    set graphIsMine(v: boolean) {
      state.graphIsMine = v;
    },
    get mainGraphId() {
      return state.mainGraphId;
    },
    set mainGraphId(v: unknown) {
      state.mainGraphId = v;
    },
    get lastLoadedVersion() {
      return state.lastLoadedVersion as number;
    },
    set lastLoadedVersion(v: number) {
      state.lastLoadedVersion = v;
    },
    resetAll: () => {
      for (const key of Object.keys(state)) {
        delete state[key];
      }
    },
    _state: state,
  } as unknown as Editor.Graph.GraphController & { _state: Record<string, unknown> };
}

function makeMockGraph(): GraphDescriptor {
  return {
    nodes: [{ id: "test", type: "foo" }],
    edges: [],
  };
}

function makeMockGraphStore(): MutableGraphStore {
  const graphs = new Map<string, unknown>();
  return {
    addByDescriptor: (graph: GraphDescriptor) => {
      const id = `graph-${graphs.size}`;
      graphs.set(id, graph);
      return { success: true, result: id };
    },
    editByDescriptor: () => ({
      raw: () => ({}),
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  } as unknown as MutableGraphStore;
}

suite("initialize-editor helpers", () => {
  beforeEach(() => {
    setDOM();
  });

  afterEach(() => {
    unsetDOM();
  });

  test("initializes editor with correct state", () => {
    const graphStore = makeMockGraphStore();
    const graphController = makeMockGraphController();
    const graph = makeMockGraph();

    const result = initializeEditor(graphStore, graphController, {
      graph,
      moduleId: null,
      subGraphId: null,
      url: "https://example.com/board.json",
      readOnly: false,
      version: 5,
      lastLoadedVersion: 3,
    });

    assert.strictEqual(result.success, true);
    assert.ok(result.id);
    assert.ok(result.mainGraphId);

    // Verify controller state was set
    assert.strictEqual(graphController.url, "https://example.com/board.json");
    assert.strictEqual(graphController.version, 5);
    assert.strictEqual(graphController.readOnly, false);
    assert.strictEqual(graphController.graphIsMine, true); // !readOnly
    assert.strictEqual(graphController.lastLoadedVersion, 3);
  });

  test("sets graphIsMine to false when readOnly is true", () => {
    const graphStore = makeMockGraphStore();
    const graphController = makeMockGraphController();
    const graph = makeMockGraph();

    initializeEditor(graphStore, graphController, {
      graph,
      moduleId: null,
      subGraphId: null,
      url: "https://example.com/board.json",
      readOnly: true,
      version: 1,
      lastLoadedVersion: -1,
    });

    assert.strictEqual(graphController.readOnly, true);
    assert.strictEqual(graphController.graphIsMine, false);
  });

  test("resetEditor clears controller state", () => {
    const graphController = makeMockGraphController() as Editor.Graph.GraphController & { _state: Record<string, unknown> };

    // Set some state
    graphController.url = "https://example.com/board.json";
    graphController.version = 5;

    resetEditor(graphController);

    // State should be cleared
    assert.strictEqual(Object.keys(graphController._state).length, 0);
  });

  test("throws when graph cannot be added", () => {
    const graphStore = {
      addByDescriptor: () => ({ success: false, error: "Test error" }),
    } as unknown as MutableGraphStore;
    const graphController = makeMockGraphController();
    const graph = makeMockGraph();

    assert.throws(
      () =>
        initializeEditor(graphStore, graphController, {
          graph,
          moduleId: null,
          subGraphId: null,
          url: "https://example.com/board.json",
          readOnly: false,
          version: 1,
          lastLoadedVersion: -1,
        }),
      { message: "Unable to add graph: Test error" }
    );
  });

  test("throws when editor cannot be created", () => {
    const graphStore = {
      addByDescriptor: () => ({ success: true, result: "graph-0" }),
      editByDescriptor: () => null,
    } as unknown as MutableGraphStore;
    const graphController = makeMockGraphController();
    const graph = makeMockGraph();

    assert.throws(
      () =>
        initializeEditor(graphStore, graphController, {
          graph,
          moduleId: null,
          subGraphId: null,
          url: "https://example.com/board.json",
          readOnly: false,
          version: 1,
          lastLoadedVersion: -1,
        }),
      { message: "Unable to edit by descriptor" }
    );
  });
});
