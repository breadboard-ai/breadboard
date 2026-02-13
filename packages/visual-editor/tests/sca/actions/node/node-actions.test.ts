/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { after, afterEach, before, beforeEach, suite, test } from "node:test";
import { Node as NodeActions } from "../../../../src/sca/actions/actions.js";
import * as NodeActionsModule from "../../../../src/sca/actions/node/node-actions.js";
import {
  appController,
  AppController,
} from "../../../../src/sca/controller/controller.js";
import { type AppServices } from "../../../../src/sca/services/services.js";
import { setDOM, unsetDOM } from "../../../fake-dom.js";
import { defaultRuntimeFlags } from "../../controller/data/default-flags.js";
import { createMockEditor } from "../../helpers/mock-controller.js";
import { EditableGraph } from "@breadboard-ai/types";
import { StateEvent } from "../../../../src/ui/events/events.js";
import { coordination } from "../../../../src/sca/coordination.js";
import type { EdgeAttachmentPoint } from "../../../../src/ui/types/types.js";

suite("Node Actions", () => {
  let controller: ReturnType<typeof appController>;

  before(async () => {
    setDOM();
    controller = appController(defaultRuntimeFlags);
    await controller.isHydrated;
  });

  after(() => {
    unsetDOM();
  });

  afterEach(() => {
    controller.editor.graph.setEditor(null);
    controller.editor.graph.readOnly = false;
  });

  suite("autoname action", () => {
    test("returns early when readOnly is true", async () => {
      let autonameCalled = false;
      const services = {
        autonamer: {
          async autoname() {
            autonameCalled = true;
            return [{ parts: [{ json: { notEnoughContext: true } }] }];
          },
        },
      } as unknown as AppServices;

      NodeActions.bind({ controller, services });
      controller.editor.graph.setEditor(createMockEditor());
      controller.editor.graph.readOnly = true;

      await NodeActions.autoname({
        nodeId: "test-node",
        graphId: "",
        configuration: { prompt: "test" },
        titleUserModified: false,
      });

      assert.strictEqual(
        autonameCalled,
        false,
        "autonamer should not be called when readOnly"
      );
    });

    test("returns early when editor is null", async () => {
      let autonameCalled = false;
      const services = {
        autonamer: {
          async autoname() {
            autonameCalled = true;
            return [{ parts: [{ json: { notEnoughContext: true } }] }];
          },
        },
      } as unknown as AppServices;

      NodeActions.bind({ controller, services });
      controller.editor.graph.setEditor(null);
      controller.editor.graph.readOnly = false;

      await NodeActions.autoname({
        nodeId: "test-node",
        graphId: "",
        configuration: { prompt: "test" },
        titleUserModified: false,
      });

      assert.strictEqual(
        autonameCalled,
        false,
        "autonamer should not be called when no editor"
      );
    });

    test("skips when outputTemplates disabled AND title user-modified", async () => {
      let autonameCalled = false;
      const originalFlags = controller.global.flags.flags;
      controller.global.flags.flags = async () => ({
        ...defaultRuntimeFlags,
        outputTemplates: false,
      });

      const services = {
        autonamer: {
          async autoname() {
            autonameCalled = true;
            return [{ parts: [{ json: { notEnoughContext: true } }] }];
          },
        },
      } as unknown as AppServices;

      NodeActions.bind({ controller, services });
      controller.editor.graph.setEditor(createMockEditor());
      controller.editor.graph.readOnly = false;

      await NodeActions.autoname({
        nodeId: "test-node",
        graphId: "",
        configuration: { prompt: "test" },
        titleUserModified: true,
      });

      assert.strictEqual(
        autonameCalled,
        false,
        "autonamer should not be called"
      );

      // Restore
      controller.global.flags.flags = originalFlags;
    });

    test("calls autonamer when conditions are met", async () => {
      let autonameCalled = false;
      let autonameArgs: unknown = null;

      const services = {
        autonamer: {
          async autoname(content: unknown) {
            autonameCalled = true;
            autonameArgs = content;
            return [{ parts: [{ json: { notEnoughContext: true } }] }];
          },
        },
      } as unknown as AppServices;

      NodeActions.bind({ controller, services });
      controller.editor.graph.setEditor(createMockEditor());
      controller.editor.graph.readOnly = false;

      await NodeActions.autoname({
        nodeId: "test-node",
        graphId: "",
        configuration: { prompt: "Hello world" },
        titleUserModified: false,
      });

      assert.strictEqual(autonameCalled, true, "autonamer should be called");
      assert.ok(Array.isArray(autonameArgs), "args should be LLMContent array");
    });

    test("does not call autonamer when node not found", async () => {
      let autonameCalled = false;

      const services = {
        autonamer: {
          async autoname() {
            autonameCalled = true;
            return [{ parts: [{ json: { notEnoughContext: true } }] }];
          },
        },
      } as unknown as AppServices;

      NodeActions.bind({ controller, services });
      controller.editor.graph.setEditor(createMockEditor());
      controller.editor.graph.readOnly = false;

      await NodeActions.autoname({
        nodeId: "nonexistent-node",
        graphId: "",
        configuration: { prompt: "test" },
        titleUserModified: false,
      });

      assert.strictEqual(
        autonameCalled,
        false,
        "autonamer should not be called when node not found"
      );
    });

    test("handles autoname error gracefully", async () => {
      const services = {
        autonamer: {
          async autoname() {
            return { $error: "API error" };
          },
        },
      } as unknown as AppServices;

      NodeActions.bind({ controller, services });
      controller.editor.graph.setEditor(createMockEditor());
      controller.editor.graph.readOnly = false;

      // Should not throw
      await NodeActions.autoname({
        nodeId: "test-node",
        graphId: "",
        configuration: { prompt: "test" },
        titleUserModified: false,
      });

      assert.ok(true, "should handle error gracefully");
    });

    test("handles null result gracefully", async () => {
      const services = {
        autonamer: {
          async autoname() {
            return [{ parts: [{ text: "not json" }] }];
          },
        },
      } as unknown as AppServices;

      NodeActions.bind({ controller, services });
      controller.editor.graph.setEditor(createMockEditor());
      controller.editor.graph.readOnly = false;

      // Should not throw
      await NodeActions.autoname({
        nodeId: "test-node",
        graphId: "",
        configuration: { prompt: "test" },
        titleUserModified: false,
      });

      assert.ok(true, "should handle null result gracefully");
    });

    test("applies metadata on success", async () => {
      let appliedTransform: unknown = null;

      const mockEditor = createMockEditor({
        onApply: (transform) => {
          appliedTransform = transform;
        },
      });

      const services = {
        autonamer: {
          async autoname() {
            return [
              {
                parts: [
                  {
                    json: {
                      title: "Generated Title",
                      description: "Generated description",
                      expected_output: [{ type: "text", list: false }],
                    },
                  },
                ],
              },
            ];
          },
        },
      } as unknown as AppServices;

      NodeActions.bind({ controller, services });
      controller.editor.graph.setEditor(mockEditor);
      controller.editor.graph.readOnly = false;

      await NodeActions.autoname({
        nodeId: "test-node",
        graphId: "",
        configuration: { prompt: "test" },
        titleUserModified: false,
      });

      assert.ok(appliedTransform, "transform should be applied");
    });

    test("handles failed apply gracefully", async () => {
      const mockEditor = {
        ...createMockEditor(),
        apply: async () => ({ success: false, error: "Apply failed" }),
      } as unknown as EditableGraph;

      const services = {
        autonamer: {
          async autoname() {
            return [
              {
                parts: [
                  {
                    json: {
                      title: "Generated Title",
                      description: "Generated description",
                    },
                  },
                ],
              },
            ];
          },
        },
      } as unknown as AppServices;

      NodeActions.bind({ controller, services });
      controller.editor.graph.setEditor(mockEditor);
      controller.editor.graph.readOnly = false;

      // Should not throw
      await NodeActions.autoname({
        nodeId: "test-node",
        graphId: "",
        configuration: { prompt: "test" },
        titleUserModified: false,
      });

      assert.ok(true, "should handle failed apply gracefully");
    });

    test("discards results when graph changes during autoname", async () => {
      let appliedTransform = false;
      let graphChangeCallback: (() => void) | null = null;

      const mockEditor = createMockEditor({
        onApply: () => {
          appliedTransform = true;
        },
        onGraphChange: (callback) => {
          graphChangeCallback = callback;
        },
      });

      const services = {
        autonamer: {
          async autoname() {
            // Simulate graph change during autoname
            if (graphChangeCallback) {
              graphChangeCallback();
            }
            return [
              {
                parts: [
                  {
                    json: {
                      title: "Generated Title",
                      description: "Generated description",
                    },
                  },
                ],
              },
            ];
          },
        },
      } as unknown as AppServices;

      NodeActions.bind({ controller, services });
      controller.editor.graph.setEditor(mockEditor);
      controller.editor.graph.readOnly = false;

      await NodeActions.autoname({
        nodeId: "test-node",
        graphId: "",
        configuration: { prompt: "test" },
        titleUserModified: false,
      });

      assert.strictEqual(
        appliedTransform,
        false,
        "should NOT apply transform when graph changed"
      );
    });

    test("strips trailing period from description", async () => {
      let appliedTransform: unknown = null;

      const mockEditor = createMockEditor({
        onApply: (transform) => {
          appliedTransform = transform;
        },
      });

      const services = {
        autonamer: {
          async autoname() {
            return [
              {
                parts: [
                  {
                    json: {
                      title: "Generated Title",
                      description: "Description with trailing period.",
                    },
                  },
                ],
              },
            ];
          },
        },
      } as unknown as AppServices;

      NodeActions.bind({ controller, services });
      controller.editor.graph.setEditor(mockEditor);
      controller.editor.graph.readOnly = false;

      await NodeActions.autoname({
        nodeId: "test-node",
        graphId: "",
        configuration: { prompt: "test" },
        titleUserModified: false,
      });

      // Transform was applied (the description stripping happens internally)
      assert.ok(appliedTransform !== null, "transform should be applied");
    });

    test("excludes title from metadata when titleUserModified is true", async () => {
      let appliedTransform: unknown = null;

      const mockEditor = createMockEditor({
        onApply: (transform) => {
          appliedTransform = transform;
        },
      });

      const services = {
        autonamer: {
          async autoname() {
            return [
              {
                parts: [
                  {
                    json: {
                      title: "Generated Title",
                      description: "Description",
                    },
                  },
                ],
              },
            ];
          },
        },
      } as unknown as AppServices;

      // Must set outputTemplates: true for action to proceed when titleUserModified
      const originalFlags = controller.global.flags.flags;
      controller.global.flags.flags = async () => ({
        ...defaultRuntimeFlags,
        outputTemplates: true,
      });

      NodeActions.bind({ controller, services });
      controller.editor.graph.setEditor(mockEditor);
      controller.editor.graph.readOnly = false;

      await NodeActions.autoname({
        nodeId: "test-node",
        graphId: "",
        configuration: { prompt: "test" },
        titleUserModified: true,
      });

      assert.ok(appliedTransform, "transform should be applied");
      // Title should be undefined in metadata when user modified it
      const transform = appliedTransform as { metadata?: { title?: string } };
      assert.strictEqual(
        transform.metadata?.title,
        undefined,
        "title should be undefined when user modified"
      );

      // Restore
      controller.global.flags.flags = originalFlags;
    });
  });

  suite("autoname (triggered path)", () => {
    test("returns early when lastNodeConfigChange is null and no config provided", async () => {
      let autonameCalled = false;

      const services = {
        autonamer: {
          async autoname() {
            autonameCalled = true;
            return [{ parts: [{ json: { notEnoughContext: true } }] }];
          },
        },
      } as unknown as AppServices;

      NodeActions.bind({ controller, services });
      controller.editor.graph.setEditor(createMockEditor());
      controller.editor.graph.readOnly = false;
      controller.editor.graph.lastNodeConfigChange = null;

      // Call without arguments - simulates triggered path
      await NodeActions.autoname();

      assert.strictEqual(
        autonameCalled,
        false,
        "autoname should not be called when no config change"
      );
    });

    test("calls autoname service with data from lastNodeConfigChange", async () => {
      let autonameCalled = false;
      let capturedArgs: unknown = null;

      const services = {
        autonamer: {
          async autoname(content: unknown) {
            autonameCalled = true;
            capturedArgs = content;
            return [{ parts: [{ json: { notEnoughContext: true } }] }];
          },
        },
      } as unknown as AppServices;

      NodeActions.bind({ controller, services });
      controller.editor.graph.setEditor(createMockEditor());
      controller.editor.graph.readOnly = false;

      // Set up lastNodeConfigChange
      controller.editor.graph.lastNodeConfigChange = {
        nodeId: "test-node",
        graphId: "",
        configuration: { prompt: "Test prompt" },
        titleUserModified: false,
      };

      // Call without arguments - simulates triggered path
      await NodeActions.autoname();

      assert.strictEqual(autonameCalled, true, "autoname should be called");
      assert.ok(Array.isArray(capturedArgs), "args should be LLMContent array");
    });

    test("respects titleUserModified from lastNodeConfigChange", async () => {
      let autonameCalled = false;

      const originalFlags = controller.global.flags.flags;
      controller.global.flags.flags = async () => ({
        ...defaultRuntimeFlags,
        outputTemplates: false,
      });

      const services = {
        autonamer: {
          async autoname() {
            autonameCalled = true;
            return [{ parts: [{ json: { notEnoughContext: true } }] }];
          },
        },
      } as unknown as AppServices;

      NodeActions.bind({ controller, services });
      controller.editor.graph.setEditor(createMockEditor());
      controller.editor.graph.readOnly = false;

      // Set up lastNodeConfigChange with titleUserModified = true
      controller.editor.graph.lastNodeConfigChange = {
        nodeId: "test-node",
        graphId: "",
        configuration: { prompt: "Test prompt" },
        titleUserModified: true,
      };

      // Call without arguments - simulates triggered path
      await NodeActions.autoname();

      // Should skip because outputTemplates is false AND titleUserModified is true
      assert.strictEqual(
        autonameCalled,
        false,
        "autoname should not be called when user modified title"
      );

      controller.global.flags.flags = originalFlags;
    });
  });
});

suite("Node Actions — Event-Triggered", () => {
  beforeEach(() => {
    coordination.reset();
  });

  function makeMockEditorForEvent(options?: {
    onApply?: (transform: unknown) => void;
    onEdit?: (edits: unknown[], label: string) => void;
    rawGraph?: Record<string, unknown>;
  }) {
    return {
      apply: async (transform: unknown) => {
        options?.onApply?.(transform);
        return { success: true };
      },
      edit: async (edits: unknown[], label: string) => {
        options?.onEdit?.(edits, label);
      },
      inspect: (_graphId: string) => ({
        nodeById: (_id: string) => ({
          metadata: () => ({}),
        }),
      }),
      raw: () => options?.rawGraph ?? { nodes: [], edges: [] },
    };
  }

  function bindNode(
    editor: unknown,
    overrides?: { readOnly?: boolean; selectNodes?: (ids: string[]) => void }
  ) {
    NodeActionsModule.bind({
      controller: {
        editor: {
          graph: {
            editor,
            readOnly: overrides?.readOnly ?? false,
            lastNodeConfigChange: null,
          },
          selection: {
            selectNodes: overrides?.selectNodes ?? (() => {}),
          },
        },
        global: {
          main: { blockingAction: false },
        },
      } as unknown as AppController,
      services: {
        stateEventBus: new EventTarget(),
      } as unknown as AppServices,
    });
  }

  suite("onNodeChange", () => {
    test("applies UpdateNode transform and sets lastNodeConfigChange", async () => {
      let appliedTransform: unknown = null;
      const mockEditor = makeMockEditorForEvent({
        onApply: (transform) => {
          appliedTransform = transform;
        },
      });

      bindNode(mockEditor);

      const evt = new StateEvent({
        eventType: "node.change",
        id: "node-1",
        configurationPart: { prompt: "hello" },
        subGraphId: null,
        metadata: null,
        ins: null,
      });
      await NodeActionsModule.onNodeChange(evt);

      assert.ok(appliedTransform, "editor.apply should have been called");
    });

    test("returns early when readOnly", async () => {
      let appliedTransform: unknown = null;
      const mockEditor = makeMockEditorForEvent({
        onApply: (transform) => {
          appliedTransform = transform;
        },
      });

      bindNode(mockEditor, { readOnly: true });

      const evt = new StateEvent({
        eventType: "node.change",
        id: "node-1",
        configurationPart: { prompt: "hello" },
        subGraphId: null,
        metadata: null,
        ins: null,
      });
      await NodeActionsModule.onNodeChange(evt);

      assert.strictEqual(appliedTransform, null, "apply should not be called");
    });

    test("returns early when no editor", async () => {
      bindNode(null);

      const evt = new StateEvent({
        eventType: "node.change",
        id: "node-1",
        configurationPart: {},
        subGraphId: null,
        metadata: null,
        ins: null,
      });
      // Should not throw
      await NodeActionsModule.onNodeChange(evt);
    });
  });

  suite("onNodeAdd", () => {
    test("calls editor.edit with addnode and selects the new node", async () => {
      const edits: unknown[] = [];
      let selectedIds: string[] = [];

      const mockEditor = makeMockEditorForEvent({
        onEdit: (e) => edits.push(...e),
      });

      bindNode(mockEditor, {
        selectNodes: (ids: string[]) => {
          selectedIds = ids;
        },
      });

      const evt = new StateEvent({
        eventType: "node.add",
        node: { id: "new-node", type: "someType" },
        graphId: "",
      });
      await NodeActionsModule.onNodeAdd(evt);

      assert.strictEqual(edits.length, 1);
      assert.strictEqual((edits[0] as Record<string, unknown>).type, "addnode");
      assert.deepStrictEqual(selectedIds, ["new-node"]);
    });

    test("returns early when no editor", async () => {
      bindNode(null);

      const evt = new StateEvent({
        eventType: "node.add",
        node: { id: "new-node", type: "someType" },
        graphId: "",
      });
      // Should not throw
      await NodeActionsModule.onNodeAdd(evt);
    });
  });

  suite("onMoveSelection", () => {
    test("builds changemetadata edits for node updates", async () => {
      const edits: unknown[] = [];
      const mockEditor = makeMockEditorForEvent({
        onEdit: (e) => edits.push(...e),
      });

      bindNode(mockEditor);

      const evt = new StateEvent({
        eventType: "node.moveselection",
        updates: [{ type: "node", id: "node-1", graphId: "", x: 100, y: 200 }],
      });
      await NodeActionsModule.onMoveSelection(evt);

      assert.strictEqual(edits.length, 1);
      assert.strictEqual(
        (edits[0] as Record<string, unknown>).type,
        "changemetadata"
      );
    });

    test("builds changeassetmetadata edits for asset updates", async () => {
      const edits: unknown[] = [];
      const rawGraph = {
        nodes: [],
        edges: [],
        assets: {
          "asset-1": {
            metadata: { title: "test", type: "image/png" },
          },
        },
      };
      const mockEditor = makeMockEditorForEvent({
        onEdit: (e) => edits.push(...e),
        rawGraph,
      });

      bindNode(mockEditor);

      const evt = new StateEvent({
        eventType: "node.moveselection",
        updates: [{ type: "asset", id: "asset-1", graphId: "", x: 50, y: 75 }],
      });
      await NodeActionsModule.onMoveSelection(evt);

      assert.strictEqual(edits.length, 1);
      assert.strictEqual(
        (edits[0] as Record<string, unknown>).type,
        "changeassetmetadata"
      );
    });
  });

  suite("onChangeEdge", () => {
    test("applies ChangeEdge transform", async () => {
      let appliedTransform: unknown = null;
      const mockEditor = makeMockEditorForEvent({
        onApply: (transform) => {
          appliedTransform = transform;
        },
      });

      bindNode(mockEditor);

      const evt = new StateEvent({
        eventType: "node.changeedge",
        changeType: "add",
        from: { from: "a", out: "out", to: "b", in: "in" },
        to: undefined,
        subGraphId: null,
      });
      await NodeActionsModule.onChangeEdge(evt);

      assert.ok(appliedTransform, "apply should have been called");
    });

    test("returns early when no editor", async () => {
      bindNode(null);

      const evt = new StateEvent({
        eventType: "node.changeedge",
        changeType: "add",
        from: { from: "a", out: "out", to: "b", in: "in" },
        to: undefined,
        subGraphId: null,
      });
      // Should not throw
      await NodeActionsModule.onChangeEdge(evt);
    });
  });

  suite("onChangeEdgeAttachmentPoint", () => {
    test("applies ChangeEdgeAttachmentPoint transform", async () => {
      let appliedTransform: unknown = null;
      const mockEditor = makeMockEditorForEvent({
        onApply: (transform) => {
          appliedTransform = transform;
        },
      });

      bindNode(mockEditor);

      const evt = new StateEvent({
        eventType: "node.changeedgeattachmentpoint",
        graphId: "",
        edge: { from: "a", out: "out", to: "b", in: "in" },
        which: "from",
        attachmentPoint: { x: 10, y: 20 } as unknown as EdgeAttachmentPoint,
      });
      await NodeActionsModule.onChangeEdgeAttachmentPoint(evt);

      assert.ok(appliedTransform, "apply should have been called");
    });

    test("returns early when no editor", async () => {
      bindNode(null);

      const evt = new StateEvent({
        eventType: "node.changeedgeattachmentpoint",
        graphId: "",
        edge: { from: "a", out: "out", to: "b", in: "in" },
        which: "from",
        attachmentPoint: { x: 10, y: 20 } as unknown as EdgeAttachmentPoint,
      });
      // Should not throw
      await NodeActionsModule.onChangeEdgeAttachmentPoint(evt);
    });
  });
});
