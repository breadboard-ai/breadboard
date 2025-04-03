/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";
import { EditHistoryManager } from "../../src/editor/history.js";
import { GraphDescriptor } from "@breadboard-ai/types";

test("EditHistoryManager correctly adds new items", (t) => {
  const mockGraph1 = { m: "1" } as unknown as GraphDescriptor;
  const mockGraph2 = { m: "2" } as unknown as GraphDescriptor;
  const history = new EditHistoryManager();
  t.assert(history.current() === null);
  history.add(mockGraph1, "test");
  t.deepEqual(history.current(), mockGraph1);
  t.assert(history.history.length === 1);
  history.add(mockGraph2, "test");
  t.deepEqual(history.current(), mockGraph2);
  t.assert(history.history.length === 2);
});

test("EditHistoryManager correctly goes back", (t) => {
  const mockGraph1 = { m: "1" } as unknown as GraphDescriptor;
  const mockGraph2 = { m: "2" } as unknown as GraphDescriptor;
  const mockGraph3 = { m: "3" } as unknown as GraphDescriptor;
  const history = new EditHistoryManager();
  history.add(mockGraph1, "test");
  history.add(mockGraph2, "test");
  history.add(mockGraph3, "test");
  t.deepEqual(history.back(), mockGraph2);
  t.deepEqual(history.back(), mockGraph1);
  t.deepEqual(history.back(), mockGraph1);
});

test("EditHistoryManager correctly goes forth", (t) => {
  const mockGraph1 = { m: "1" } as unknown as GraphDescriptor;
  const mockGraph2 = { m: "2" } as unknown as GraphDescriptor;
  const mockGraph3 = { m: "3" } as unknown as GraphDescriptor;
  const history = new EditHistoryManager();
  history.add(mockGraph1, "test");
  history.add(mockGraph2, "test");
  history.add(mockGraph3, "test");
  t.deepEqual(history.back(), mockGraph2);
  t.deepEqual(history.back(), mockGraph1);
  t.deepEqual(history.back(), mockGraph1);
  t.deepEqual(history.forth(), mockGraph2);
  t.deepEqual(history.forth(), mockGraph3);
  t.deepEqual(history.forth(), mockGraph3);
});

test("EditHistoryManager correctly combines add, back, and forth", (t) => {
  const mockGraph1 = { m: "1" } as unknown as GraphDescriptor;
  const mockGraph2 = { m: "2" } as unknown as GraphDescriptor;
  const mockGraph3 = { m: "3" } as unknown as GraphDescriptor;
  const mockGraph4 = { m: "4" } as unknown as GraphDescriptor;
  const history = new EditHistoryManager();
  history.add(mockGraph1, "test");
  history.add(mockGraph2, "test");
  t.deepEqual(history.back(), mockGraph1);
  history.add(mockGraph3, "test");
  t.deepEqual(history.current(), mockGraph3);
  t.deepEqual(history.forth(), mockGraph3);
  t.deepEqual(history.back(), mockGraph1);
  t.deepEqual(history.forth(), mockGraph3);
  history.add(mockGraph4, "test");
  t.deepEqual(history.current(), mockGraph4);
  t.deepEqual(history.back(), mockGraph3);
  t.deepEqual(history.back(), mockGraph1);
});
