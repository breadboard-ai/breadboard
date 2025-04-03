/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";
import { GraphEditHistory } from "../../src/editor/history.js";
import { GraphDescriptor } from "@breadboard-ai/types";
import { EditHistoryController } from "../../src/index.js";

class FakeController implements EditHistoryController {
  #graph: GraphDescriptor = { nodes: [], edges: [] };
  graph() {
    return this.#graph;
  }
  setGraph(graph: GraphDescriptor) {
    this.#graph = graph;
  }
}

test("GraphEditHistory correctly adds new items", (t) => {
  const mockGraph1 = { m: "1" } as unknown as GraphDescriptor;
  const mockGraph2 = { m: "2" } as unknown as GraphDescriptor;
  const history = new GraphEditHistory(new FakeController());
  t.assert(history.current() === null);
  history.add(mockGraph1, "test", { role: "user" }, Date.now());
  t.deepEqual(history.current(), mockGraph1);
  t.assert(history.entries().length === 1);
  history.add(mockGraph2, "test", { role: "user" }, Date.now());
  t.deepEqual(history.current(), mockGraph2);
  t.assert(history.entries().length === 2);
});

test("GraphEditHistory correctly goes undo", (t) => {
  const mockGraph1 = { m: "1" } as unknown as GraphDescriptor;
  const mockGraph2 = { m: "2" } as unknown as GraphDescriptor;
  const mockGraph3 = { m: "3" } as unknown as GraphDescriptor;
  const history = new GraphEditHistory(new FakeController());
  history.add(mockGraph1, "test", { role: "user" }, Date.now());
  history.add(mockGraph2, "test", { role: "user" }, Date.now());
  history.add(mockGraph3, "test", { role: "user" }, Date.now());
  t.deepEqual(history.undo(), mockGraph2);
  t.deepEqual(history.undo(), mockGraph1);
  t.deepEqual(history.undo(), mockGraph1);
});

test("GraphEditHistory correctly goes redo", (t) => {
  const mockGraph1 = { m: "1" } as unknown as GraphDescriptor;
  const mockGraph2 = { m: "2" } as unknown as GraphDescriptor;
  const mockGraph3 = { m: "3" } as unknown as GraphDescriptor;
  const history = new GraphEditHistory(new FakeController());
  history.add(mockGraph1, "test", { role: "user" }, Date.now());
  history.add(mockGraph2, "test", { role: "user" }, Date.now());
  history.add(mockGraph3, "test", { role: "user" }, Date.now());
  t.deepEqual(history.undo(), mockGraph2);
  t.deepEqual(history.undo(), mockGraph1);
  t.deepEqual(history.undo(), mockGraph1);
  t.deepEqual(history.redo(), mockGraph2);
  t.deepEqual(history.redo(), mockGraph3);
  t.deepEqual(history.redo(), mockGraph3);
});

test("GraphEditHistory correctly combines add, undo, and redo", (t) => {
  const mockGraph1 = { m: "1" } as unknown as GraphDescriptor;
  const mockGraph2 = { m: "2" } as unknown as GraphDescriptor;
  const mockGraph3 = { m: "3" } as unknown as GraphDescriptor;
  const mockGraph4 = { m: "4" } as unknown as GraphDescriptor;
  const history = new GraphEditHistory(new FakeController());
  history.add(mockGraph1, "test", { role: "user" }, Date.now());
  history.add(mockGraph2, "test", { role: "user" }, Date.now());
  t.deepEqual(history.undo(), mockGraph1);
  history.add(mockGraph3, "test", { role: "user" }, Date.now());
  t.deepEqual(history.current(), mockGraph3);
  t.deepEqual(history.redo(), mockGraph3);
  t.deepEqual(history.undo(), mockGraph1);
  t.deepEqual(history.redo(), mockGraph3);
  history.add(mockGraph4, "test", { role: "user" }, Date.now());
  t.deepEqual(history.current(), mockGraph4);
  t.deepEqual(history.undo(), mockGraph3);
  t.deepEqual(history.undo(), mockGraph1);
});
