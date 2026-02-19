/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { afterEach, beforeEach, suite, test } from "node:test";
import type { GraphDescriptor, MutableGraph } from "@breadboard-ai/types";
import {
  initializeEditor,
  resetEditor,
} from "../../../../../src/sca/actions/board/helpers/initialize-editor.js";
import type * as Editor from "../../../../../src/sca/controller/subcontrollers/editor/editor.js";
import { setDOM, unsetDOM } from "../../../../fake-dom.js";
import { makeTestGraphStoreArgs } from "../../../../helpers/_graph-store.js";

const testGraphStoreArgs = makeTestGraphStoreArgs();

function makeMockGraphController(): Editor.Graph.GraphController & {
  _state: Record<string, unknown>;
} {
  let mutableGraph: MutableGraph | undefined;
  const state: Record<string, unknown> = {};
  return {
    // MutableGraphStore implementation — just stores the MutableGraph
    set(graph: MutableGraph) {
      mutableGraph = graph;
    },
    get() {
      return mutableGraph;
    },

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
      mutableGraph = undefined;
      for (const key of Object.keys(state)) {
        delete state[key];
      }
    },
    _state: state,
  } as unknown as Editor.Graph.GraphController & {
    _state: Record<string, unknown>;
  };
}

function makeMockGraph(): GraphDescriptor {
  return {
    nodes: [{ id: "test", type: "foo" }],
    edges: [],
  };
}

suite("initialize-editor helpers", () => {
  beforeEach(() => {
    setDOM();
  });

  afterEach(() => {
    unsetDOM();
  });

  test("initializes editor with correct state", () => {
    const graphController = makeMockGraphController();
    const graph = makeMockGraph();

    const result = initializeEditor(graphController, {
      graph,
      subGraphId: null,
      url: "https://example.com/board.json",
      readOnly: false,
      version: 5,
      lastLoadedVersion: 3,
      graphStoreArgs: testGraphStoreArgs,
    });

    assert.strictEqual(result.success, true);
    assert.ok(result.id);

    // Verify controller state was set
    // Note: version is input (5) + 1 for the trigger bump = 6
    assert.strictEqual(graphController.url, "https://example.com/board.json");
    assert.strictEqual(graphController.version, 6);
    assert.strictEqual(graphController.readOnly, false);
    assert.strictEqual(graphController.lastLoadedVersion, 3);
  });

  test("sets graphIsMine to false when readOnly is true", () => {
    const graphController = makeMockGraphController();
    const graph = makeMockGraph();

    initializeEditor(graphController, {
      graph,
      subGraphId: null,
      url: "https://example.com/board.json",
      readOnly: true,
      version: 1,
      lastLoadedVersion: -1,
      graphStoreArgs: testGraphStoreArgs,
    });

    assert.strictEqual(graphController.readOnly, true);
  });

  test("resetEditor clears controller state", () => {
    const graphController = makeMockGraphController();

    // Set some state
    graphController.url = "https://example.com/board.json";
    graphController.version = 5;

    resetEditor(graphController);

    // State should be cleared
    assert.strictEqual(Object.keys(graphController._state).length, 0);
  });
});
