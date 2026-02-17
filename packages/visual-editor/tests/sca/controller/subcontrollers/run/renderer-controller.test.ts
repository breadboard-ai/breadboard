/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { afterEach, beforeEach, suite, test } from "node:test";
import { RendererController } from "../../../../../src/sca/controller/subcontrollers/run/renderer-controller.js";
import { setDOM, unsetDOM } from "../../../../fake-dom.js";

/**
 * Tests for the RendererController.
 *
 * The RendererController owns graph visualization state during a run,
 * tracking node and edge visual states for the graph renderer.
 */
suite("RendererController node state", () => {
  beforeEach(() => {
    setDOM();
  });

  afterEach(() => {
    unsetDOM();
  });

  test("nodes defaults to empty Map", async () => {
    const controller = new RendererController(
      "RendererTest_1",
      "RendererController"
    );
    await controller.isHydrated;

    assert.strictEqual(controller.nodes.size, 0);
  });

  test("setNodeState adds node state", async () => {
    const controller = new RendererController(
      "RendererTest_2",
      "RendererController"
    );
    await controller.isHydrated;

    controller.setNodeState("node-1", { status: "working" });
    await controller.isSettled;

    assert.strictEqual(controller.nodes.size, 1);
    assert.deepStrictEqual(controller.nodes.get("node-1"), {
      status: "working",
    });
  });

  test("setNodeState overwrites existing state", async () => {
    const controller = new RendererController(
      "RendererTest_3",
      "RendererController"
    );
    await controller.isHydrated;

    controller.setNodeState("node-1", { status: "working" });
    await controller.isSettled;

    controller.setNodeState("node-1", { status: "succeeded" });
    await controller.isSettled;

    assert.deepStrictEqual(controller.nodes.get("node-1"), {
      status: "succeeded",
    });
  });

  test("setNodeState with error message", async () => {
    const controller = new RendererController(
      "RendererTest_4",
      "RendererController"
    );
    await controller.isHydrated;

    controller.setNodeState("node-1", {
      status: "failed",
      errorMessage: "Something went wrong",
    });
    await controller.isSettled;

    const state = controller.nodes.get("node-1");
    assert.strictEqual(state?.status, "failed");
    assert.strictEqual(state?.errorMessage, "Something went wrong");
  });

  test("clearNodes removes all node states", async () => {
    const controller = new RendererController(
      "RendererTest_5",
      "RendererController"
    );
    await controller.isHydrated;

    controller.setNodeState("node-1", { status: "working" });
    controller.setNodeState("node-2", { status: "succeeded" });
    await controller.isSettled;

    controller.clearNodes();
    await controller.isSettled;

    assert.strictEqual(controller.nodes.size, 0);
  });
});

suite("RendererController edge state", () => {
  beforeEach(() => {
    setDOM();
  });

  afterEach(() => {
    unsetDOM();
  });

  test("edges defaults to empty Map", async () => {
    const controller = new RendererController(
      "RendererTest_edge_1",
      "RendererController"
    );
    await controller.isHydrated;

    assert.strictEqual(controller.edges.size, 0);
  });

  test("setEdgeState adds edge state", async () => {
    const controller = new RendererController(
      "RendererTest_edge_2",
      "RendererController"
    );
    await controller.isHydrated;

    controller.setEdgeState("a-out->b-in", { status: "consumed" });
    await controller.isSettled;

    assert.strictEqual(controller.edges.size, 1);
    assert.deepStrictEqual(controller.edges.get("a-out->b-in"), {
      status: "consumed",
    });
  });

  test("clearEdges removes all edge states", async () => {
    const controller = new RendererController(
      "RendererTest_edge_3",
      "RendererController"
    );
    await controller.isHydrated;

    controller.setEdgeState("a-out->b-in", { status: "consumed" });
    controller.setEdgeState("b-out->c-in", { status: "stored" });
    await controller.isSettled;

    controller.clearEdges();
    await controller.isSettled;

    assert.strictEqual(controller.edges.size, 0);
  });
});

suite("RendererController reset", () => {
  beforeEach(() => {
    setDOM();
  });

  afterEach(() => {
    unsetDOM();
  });

  test("reset clears both nodes and edges", async () => {
    const controller = new RendererController(
      "RendererTest_reset_1",
      "RendererController"
    );
    await controller.isHydrated;

    controller.setNodeState("node-1", { status: "working" });
    controller.setEdgeState("a-out->b-in", { status: "consumed" });
    await controller.isSettled;

    controller.reset();
    await controller.isSettled;

    assert.strictEqual(controller.nodes.size, 0);
    assert.strictEqual(controller.edges.size, 0);
  });
});
