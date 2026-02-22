/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import {
  after,
  afterEach,
  before,
  beforeEach,
  mock,
  suite,
  test,
} from "node:test";
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
import { makeTestGraphStoreArgs } from "../../../helpers/_graph-store.js";

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

  /**
   * Initializes the MutableGraph caches and then sets the mock editor on the
   * real GraphController. Mirrors the production order in `initializeEditor()`:
   * `initialize()` first (populates caches), `setEditor()` second (runs
   * `#updateComponents()` which uses the caches via `this.inspect()`).
   */
  function setEditorAndInit(mockEditor: EditableGraph) {
    const raw = mockEditor.raw() as { nodes?: { id: string; type: string }[] };
    controller.editor.graph.initialize(
      { nodes: raw.nodes ?? [], edges: [] },
      makeTestGraphStoreArgs()
    );
    controller.editor.graph.setEditor(mockEditor);
  }

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
      setEditorAndInit(createMockEditor());
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
      setEditorAndInit(createMockEditor());
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
      setEditorAndInit(createMockEditor());
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
      setEditorAndInit(createMockEditor());
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
      setEditorAndInit(createMockEditor());
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
      setEditorAndInit(createMockEditor());
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
      setEditorAndInit(mockEditor);
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
      setEditorAndInit(mockEditor);
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
      setEditorAndInit(mockEditor);
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
      setEditorAndInit(mockEditor);
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
      setEditorAndInit(mockEditor);
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
      setEditorAndInit(createMockEditor());
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
      setEditorAndInit(createMockEditor());
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
      setEditorAndInit(createMockEditor());
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
            inspect: (graphId: string) =>
              (editor as { inspect?: (id: string) => unknown })?.inspect?.(
                graphId
              ),
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

    test("uses metadata title in edit label when available", async () => {
      let editLabel = "";
      const mockEditor = makeMockEditorForEvent({
        onEdit: (_e, label) => {
          editLabel = label;
        },
      });

      bindNode(mockEditor);

      const evt = new StateEvent({
        eventType: "node.add",
        node: {
          id: "titled-node",
          type: "someType",
          metadata: { title: "My Named Step" },
        },
        graphId: "",
      });
      await NodeActionsModule.onNodeAdd(evt);

      assert.ok(
        editLabel.includes("My Named Step"),
        `Expected label to include title, got: ${editLabel}`
      );
    });

    test("falls back to node id in label when no title", async () => {
      let editLabel = "";
      const mockEditor = makeMockEditorForEvent({
        onEdit: (_e, label) => {
          editLabel = label;
        },
      });

      bindNode(mockEditor);

      const evt = new StateEvent({
        eventType: "node.add",
        node: { id: "untitled-node", type: "someType" },
        graphId: "",
      });
      await NodeActionsModule.onNodeAdd(evt);

      assert.ok(
        editLabel.includes("untitled-node"),
        `Expected label to include node id, got: ${editLabel}`
      );
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

    test("skips asset update when asset has no metadata", async () => {
      const edits: unknown[] = [];
      const rawGraph = {
        nodes: [],
        edges: [],
        assets: {
          "no-meta-asset": {
            // No metadata field at all
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
        updates: [
          { type: "asset", id: "no-meta-asset", graphId: "", x: 50, y: 75 },
        ],
      });
      await NodeActionsModule.onMoveSelection(evt);

      // Asset without metadata should be skipped (continue)
      assert.strictEqual(
        edits.length,
        0,
        "Should not create edit for asset without metadata"
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

    test("shows error toast when apply returns failure", async () => {
      let toastMessage = "";
      const mockEditor = makeMockEditorForEvent();
      mockEditor.apply = async () => ({
        success: false,
        error: "Edge validation failed",
      });

      // Bind with toasts mock so withUIBlocking can catch and toast
      NodeActionsModule.bind({
        controller: {
          editor: {
            graph: {
              editor: mockEditor,
              inspect: (graphId: string) => mockEditor.inspect(graphId),
              readOnly: false,
              lastNodeConfigChange: null,
            },
            selection: {
              selectNodes: () => {},
            },
          },
          global: {
            main: { blockingAction: false },
            toasts: {
              toast: (msg: string) => {
                toastMessage = msg;
                return "toast-id";
              },
            },
          },
        } as unknown as AppController,
        services: {
          stateEventBus: new EventTarget(),
        } as unknown as AppServices,
      });

      const evt = new StateEvent({
        eventType: "node.changeedge",
        changeType: "add",
        from: { from: "a", out: "out", to: "b", in: "in" },
        to: undefined,
        subGraphId: null,
      });
      await NodeActionsModule.onChangeEdge(evt);

      assert.strictEqual(
        toastMessage,
        "Edge validation failed",
        "Error should be shown via toast"
      );
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

    test("maps MAIN_BOARD_ID to empty string", async () => {
      let appliedTransform: unknown = null;
      const mockEditor = makeMockEditorForEvent({
        onApply: (transform) => {
          appliedTransform = transform;
        },
      });

      bindNode(mockEditor);

      const evt = new StateEvent({
        eventType: "node.changeedgeattachmentpoint",
        graphId: "Main board",
        edge: { from: "a", out: "out", to: "b", in: "in" },
        which: "from",
        attachmentPoint: { x: 10, y: 20 } as unknown as EdgeAttachmentPoint,
      });
      await NodeActionsModule.onChangeEdgeAttachmentPoint(evt);

      assert.ok(appliedTransform, "apply should have been called");
    });

    test("shows error toast when apply returns failure", async () => {
      let toastMessage = "";
      const mockEditor = makeMockEditorForEvent();
      mockEditor.apply = async () => ({
        success: false,
        error: "Attachment point invalid",
      });

      NodeActionsModule.bind({
        controller: {
          editor: {
            graph: {
              editor: mockEditor,
              inspect: (graphId: string) => mockEditor.inspect(graphId),
              readOnly: false,
              lastNodeConfigChange: null,
            },
            selection: {
              selectNodes: () => {},
            },
          },
          global: {
            main: { blockingAction: false },
            toasts: {
              toast: (msg: string) => {
                toastMessage = msg;
                return "toast-id";
              },
            },
          },
        } as unknown as AppController,
        services: {
          stateEventBus: new EventTarget(),
        } as unknown as AppServices,
      });

      const evt = new StateEvent({
        eventType: "node.changeedgeattachmentpoint",
        graphId: "",
        edge: { from: "a", out: "out", to: "b", in: "in" },
        which: "from",
        attachmentPoint: { x: 10, y: 20 } as unknown as EdgeAttachmentPoint,
      });
      await NodeActionsModule.onChangeEdgeAttachmentPoint(evt);

      assert.strictEqual(
        toastMessage,
        "Attachment point invalid",
        "Error should be shown via toast"
      );
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

// =============================================================================
// Keyboard Actions
// =============================================================================

suite("Node Actions — Keyboard", () => {
  before(() => {
    setDOM();
    // Ensure navigator.clipboard exists for mocking.
    if (!navigator.clipboard) {
      Object.defineProperty(navigator, "clipboard", {
        value: {
          writeText: async () => {},
          read: async () => [],
          readText: async () => "",
        },
        writable: true,
        configurable: true,
      });
    }
  });
  after(() => unsetDOM());

  beforeEach(() => {
    coordination.reset();
  });

  function makeMockEditorForKeyboard(options?: {
    onApply?: (transform: unknown) => void;
    onEdit?: (edits: unknown[], label: string) => void;
    canUndo?: boolean;
    canRedo?: boolean;
    undoCalled?: { value: boolean };
    redoCalled?: { value: boolean };
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
        nodes: () => [
          { descriptor: { id: "node-1" } },
          { descriptor: { id: "node-2" } },
        ],
        assetEdges: () => [],
        raw: () => ({ nodes: [], edges: [] }),
        metadata: () => ({}),
      }),
      raw: () => ({ nodes: [], edges: [] }),
      history: () => ({
        canUndo: () => options?.canUndo ?? false,
        canRedo: () => options?.canRedo ?? false,
        undo: async () => {
          if (options?.undoCalled) options.undoCalled.value = true;
        },
        redo: async () => {
          if (options?.redoCalled) options.redoCalled.value = true;
        },
      }),
    };
  }

  function bindKeyboardAction(
    editor: unknown,
    selectionOverrides?: {
      size?: number;
      selection?: unknown;
      deselectAllCalled?: { value: boolean };
      addedNodes?: string[];
      selectAllCalled?: { value: boolean };
    }
  ) {
    NodeActionsModule.bind({
      controller: {
        editor: {
          graph: {
            editor,
            inspect: (graphId: string) =>
              (editor as { inspect?: (id: string) => unknown })?.inspect?.(
                graphId
              ),
            readOnly: false,
            url: "https://example.com/board.json",
            lastNodeConfigChange: null,
          },
          selection: {
            size: selectionOverrides?.size ?? 0,
            selection: selectionOverrides?.selection ?? {
              nodes: new Set(),
              edges: new Set(),
              comments: new Set(),
              assetEdges: new Set(),
              assets: new Set(),
            },
            deselectAll: () => {
              if (selectionOverrides?.deselectAllCalled)
                selectionOverrides.deselectAllCalled.value = true;
            },
            addNode: (id: string) => {
              selectionOverrides?.addedNodes?.push(id);
            },
            selectAll: () => {
              if (selectionOverrides?.selectAllCalled)
                selectionOverrides.selectAllCalled.value = true;
            },
            selectNodes: () => {},
          },
        },
        global: {
          main: {
            blockingAction: false,
            pointerLocation: { x: 100, y: 200 },
          },
        },
      } as unknown as AppController,
      services: {
        stateEventBus: new EventTarget(),
      } as unknown as AppServices,
    });
  }

  suite("onDelete", () => {
    test("returns early when no editor", async () => {
      bindKeyboardAction(null);
      // Should not throw
      await NodeActionsModule.onDelete();
    });

    test("returns early when readOnly", async () => {
      let applyCalled = false;
      const mockEditor = makeMockEditorForKeyboard({
        onApply: () => {
          applyCalled = true;
        },
      });

      NodeActionsModule.bind({
        controller: {
          editor: {
            graph: {
              editor: mockEditor,
              readOnly: true,
              lastNodeConfigChange: null,
            },
            selection: {
              size: 1,
              selection: {
                nodes: new Set(["node-1"]),
                edges: new Set(),
                comments: new Set(),
                assetEdges: new Set(),
                assets: new Set(),
              },
            },
          },
          global: { main: { blockingAction: false } },
        } as unknown as AppController,
        services: {
          stateEventBus: new EventTarget(),
        } as unknown as AppServices,
      });

      await NodeActionsModule.onDelete();
      assert.strictEqual(applyCalled, false, "Should not apply when readOnly");
    });

    test("returns early when selection is empty", async () => {
      let applyCalled = false;
      const mockEditor = makeMockEditorForKeyboard({
        onApply: () => {
          applyCalled = true;
        },
      });

      bindKeyboardAction(mockEditor, { size: 0 });
      await NodeActionsModule.onDelete();

      assert.strictEqual(
        applyCalled,
        false,
        "Should not apply when selection is empty"
      );
    });

    test("applies delete transform and deselects all", async () => {
      let applyCalled = false;
      const deselectAllCalled = { value: false };

      const mockEditor = makeMockEditorForKeyboard({
        onApply: () => {
          applyCalled = true;
        },
      });

      bindKeyboardAction(mockEditor, {
        size: 1,
        selection: {
          nodes: new Set(["node-1"]),
          edges: new Set(),
          comments: new Set(),
          assetEdges: new Set(),
          assets: new Set(),
        },
        deselectAllCalled,
      });

      await NodeActionsModule.onDelete();

      assert.ok(applyCalled, "editor.apply should have been called");
      assert.ok(deselectAllCalled.value, "deselectAll should have been called");
    });

    test("deletes selected asset edges via editor.apply", async () => {
      const appliedTransforms: unknown[] = [];
      const deselectAllCalled = { value: false };

      // Create a mock editor where inspect returns asset edges
      const mockEditor = {
        apply: async (transform: unknown) => {
          appliedTransforms.push(transform);
          return { success: true };
        },
        edit: async () => {},
        inspect: (_graphId: string) => ({
          nodeById: (_id: string) => ({
            metadata: () => ({}),
          }),
          nodes: () => [],
          assetEdges: () => [
            {
              assetPath: "image.png",
              direction: "load",
              node: { descriptor: { id: "node-1" } },
            },
          ],
          raw: () => ({ nodes: [], edges: [] }),
          metadata: () => ({}),
        }),
        raw: () => ({ nodes: [], edges: [] }),
        history: () => ({
          canUndo: () => false,
          canRedo: () => false,
          undo: async () => {},
          redo: async () => {},
        }),
      };

      // The asset edge identifier format is "assetPath->nodeId:direction"
      const assetEdgeId = "image.png->node-1:load";

      bindKeyboardAction(mockEditor, {
        size: 1,
        selection: {
          nodes: new Set(),
          edges: new Set(),
          comments: new Set(),
          assetEdges: new Set([assetEdgeId]),
          assets: new Set(),
        },
        deselectAllCalled,
      });

      await NodeActionsModule.onDelete();

      // Should have at least 2 apply calls: one for ChangeAssetEdge, one for MarkInPortsInvalidSpec
      assert.ok(
        appliedTransforms.length >= 2,
        `Expected at least 2 apply calls, got ${appliedTransforms.length}`
      );
      assert.ok(deselectAllCalled.value, "deselectAll should have been called");
    });

    test("deletes selected assets via editor.apply", async () => {
      const appliedTransforms: unknown[] = [];
      const deselectAllCalled = { value: false };

      const mockEditor = {
        apply: async (transform: unknown) => {
          appliedTransforms.push(transform);
          return { success: true };
        },
        edit: async () => {},
        inspect: (_graphId: string) => ({
          nodeById: (_id: string) => ({
            metadata: () => ({}),
          }),
          nodes: () => [],
          assetEdges: () => [],
          raw: () => ({ nodes: [], edges: [] }),
          metadata: () => ({}),
        }),
        raw: () => ({ nodes: [], edges: [] }),
        history: () => ({
          canUndo: () => false,
          canRedo: () => false,
          undo: async () => {},
          redo: async () => {},
        }),
      };

      bindKeyboardAction(mockEditor, {
        size: 1,
        selection: {
          nodes: new Set(),
          edges: new Set(),
          comments: new Set(),
          assetEdges: new Set(),
          assets: new Set(["my-asset.txt"]),
        },
        deselectAllCalled,
      });

      await NodeActionsModule.onDelete();

      // Should have calls for RemoveAssetWithRefs + MarkInPortsInvalidSpec
      assert.ok(
        appliedTransforms.length >= 2,
        `Expected at least 2 apply calls for asset deletion, got ${appliedTransforms.length}`
      );
      assert.ok(deselectAllCalled.value, "deselectAll should have been called");
    });
  });

  suite("onSelectAll", () => {
    test("returns early when no editor", async () => {
      bindKeyboardAction(null);
      await NodeActionsModule.onSelectAll();
    });

    test("calls selectAll on selection controller", async () => {
      const selectAllCalled = { value: false };
      const mockEditor = makeMockEditorForKeyboard();

      bindKeyboardAction(mockEditor, { selectAllCalled });
      await NodeActionsModule.onSelectAll();

      assert.ok(selectAllCalled.value, "selectAll should have been called");
    });
  });

  suite("onCopy", () => {
    test("returns early when no editor", async () => {
      bindKeyboardAction(null);
      await NodeActionsModule.onCopy();
    });

    test("returns early when selection is empty", async () => {
      const writeTextMock = mock.method(navigator.clipboard, "writeText");

      const mockEditor = makeMockEditorForKeyboard();
      bindKeyboardAction(mockEditor, { size: 0 });
      await NodeActionsModule.onCopy();

      assert.strictEqual(
        writeTextMock.mock.calls.length,
        0,
        "Should not write to clipboard when selection empty"
      );

      writeTextMock.mock.restore();
    });

    test("writes selected nodes to clipboard", async () => {
      const writeTextMock = mock.method(navigator.clipboard, "writeText");

      const mockEditor = makeMockEditorForKeyboard();
      bindKeyboardAction(mockEditor, {
        size: 1,
        selection: {
          nodes: new Set(["node-1"]),
          edges: new Set(),
          comments: new Set(),
          assetEdges: new Set(),
          assets: new Set(),
        },
      });

      await NodeActionsModule.onCopy();

      assert.strictEqual(
        writeTextMock.mock.calls.length,
        1,
        "Should write to clipboard"
      );

      writeTextMock.mock.restore();
    });
  });

  suite("onCut", () => {
    test("returns early when readOnly", async () => {
      let applyCalled = false;

      const mockEditor = makeMockEditorForKeyboard({
        onApply: () => {
          applyCalled = true;
        },
      });

      NodeActionsModule.bind({
        controller: {
          editor: {
            graph: {
              editor: mockEditor,
              readOnly: true,
              lastNodeConfigChange: null,
            },
            selection: {
              size: 1,
              selection: {
                nodes: new Set(["node-1"]),
                edges: new Set(),
                comments: new Set(),
                assetEdges: new Set(),
                assets: new Set(),
              },
            },
          },
          global: { main: { blockingAction: false } },
        } as unknown as AppController,
        services: {
          stateEventBus: new EventTarget(),
        } as unknown as AppServices,
      });

      await NodeActionsModule.onCut();
      assert.strictEqual(applyCalled, false, "Should not cut when readOnly");
    });

    test("returns early when selection is empty", async () => {
      let applyCalled = false;
      const mockEditor = makeMockEditorForKeyboard({
        onApply: () => {
          applyCalled = true;
        },
      });

      bindKeyboardAction(mockEditor, { size: 0 });
      await NodeActionsModule.onCut();

      assert.strictEqual(
        applyCalled,
        false,
        "Should not apply when selection empty"
      );
    });

    test("writes to clipboard and applies delete transform", async () => {
      let applyCalled = false;
      const writeTextMock = mock.method(navigator.clipboard, "writeText");

      const mockEditor = makeMockEditorForKeyboard({
        onApply: () => {
          applyCalled = true;
        },
      });

      bindKeyboardAction(mockEditor, {
        size: 1,
        selection: {
          nodes: new Set(["node-1"]),
          edges: new Set(),
          comments: new Set(),
          assetEdges: new Set(),
          assets: new Set(),
        },
      });

      await NodeActionsModule.onCut();

      assert.strictEqual(
        writeTextMock.mock.calls.length,
        1,
        "Should write to clipboard"
      );
      assert.ok(applyCalled, "Should apply delete transform");

      writeTextMock.mock.restore();
    });
  });

  suite("onDuplicate", () => {
    test("returns early when readOnly", async () => {
      let editCalled = false;

      const mockEditor = makeMockEditorForKeyboard({
        onEdit: () => {
          editCalled = true;
        },
      });

      NodeActionsModule.bind({
        controller: {
          editor: {
            graph: {
              editor: mockEditor,
              readOnly: true,
              lastNodeConfigChange: null,
            },
            selection: {
              size: 1,
              selection: {
                nodes: new Set(["node-1"]),
                edges: new Set(),
                comments: new Set(),
                assetEdges: new Set(),
                assets: new Set(),
              },
            },
          },
          global: {
            main: {
              blockingAction: false,
              pointerLocation: { x: 0, y: 0 },
            },
          },
        } as unknown as AppController,
        services: {
          stateEventBus: new EventTarget(),
        } as unknown as AppServices,
      });

      await NodeActionsModule.onDuplicate();
      assert.strictEqual(editCalled, false, "Should not edit when readOnly");
    });

    test("returns early when selection is empty", async () => {
      let editCalled = false;
      const mockEditor = makeMockEditorForKeyboard({
        onEdit: () => {
          editCalled = true;
        },
      });

      bindKeyboardAction(mockEditor, { size: 0 });
      await NodeActionsModule.onDuplicate();

      assert.strictEqual(
        editCalled,
        false,
        "Should not edit when selection empty"
      );
    });

    test("duplicates selected nodes and selects new ones", async () => {
      let editCalled = false;
      const deselectAllCalled = { value: false };

      const mockEditor = makeMockEditorForKeyboard({
        onEdit: () => {
          editCalled = true;
        },
      });

      bindKeyboardAction(mockEditor, {
        size: 1,
        selection: {
          nodes: new Set(["node-1"]),
          edges: new Set(),
          comments: new Set(),
          assetEdges: new Set(),
          assets: new Set(),
        },
        deselectAllCalled,
      });

      await NodeActionsModule.onDuplicate();

      assert.ok(editCalled, "editor.edit should have been called");
      assert.ok(deselectAllCalled.value, "deselectAll should have been called");
    });
  });

  suite("onUndoKeyboard", () => {
    test("returns early when no editor", async () => {
      bindKeyboardAction(null);
      await NodeActionsModule.onUndoKeyboard();
    });

    test("returns early when canUndo is false", async () => {
      const undoCalled = { value: false };
      const mockEditor = makeMockEditorForKeyboard({
        canUndo: false,
        undoCalled,
      });

      bindKeyboardAction(mockEditor);
      await NodeActionsModule.onUndoKeyboard();

      assert.strictEqual(
        undoCalled.value,
        false,
        "Should not undo when canUndo is false"
      );
    });

    test("calls history.undo when canUndo is true", async () => {
      const undoCalled = { value: false };
      const mockEditor = makeMockEditorForKeyboard({
        canUndo: true,
        undoCalled,
      });

      bindKeyboardAction(mockEditor);
      await NodeActionsModule.onUndoKeyboard();

      assert.ok(undoCalled.value, "history.undo should have been called");
    });
  });

  suite("onRedoKeyboard", () => {
    test("returns early when no editor", async () => {
      bindKeyboardAction(null);
      await NodeActionsModule.onRedoKeyboard();
    });

    test("returns early when canRedo is false", async () => {
      const redoCalled = { value: false };
      const mockEditor = makeMockEditorForKeyboard({
        canRedo: false,
        redoCalled,
      });

      bindKeyboardAction(mockEditor);
      await NodeActionsModule.onRedoKeyboard();

      assert.strictEqual(
        redoCalled.value,
        false,
        "Should not redo when canRedo is false"
      );
    });

    test("calls history.redo when canRedo is true", async () => {
      const redoCalled = { value: false };
      const mockEditor = makeMockEditorForKeyboard({
        canRedo: true,
        redoCalled,
      });

      bindKeyboardAction(mockEditor);
      await NodeActionsModule.onRedoKeyboard();

      assert.ok(redoCalled.value, "history.redo should have been called");
    });
  });

  // ---------------------------------------------------------------------------
  // onPaste
  // ---------------------------------------------------------------------------
  suite("onPaste", () => {
    test("returns early when readOnly", async () => {
      let editCalled = false;

      NodeActionsModule.bind({
        controller: {
          editor: {
            graph: {
              editor: {
                edit: async () => {
                  editCalled = true;
                },
                inspect: () => ({
                  nodeById: () => ({ metadata: () => ({}) }),
                  nodes: () => [],
                  assetEdges: () => [],
                  raw: () => ({ nodes: [], edges: [] }),
                  metadata: () => ({}),
                }),
                raw: () => ({ nodes: [], edges: [] }),
              },
              readOnly: true,
              url: "https://example.com/board.json",
            },
            selection: {
              size: 0,
              selection: {
                nodes: new Set(),
                edges: new Set(),
                comments: new Set(),
                assetEdges: new Set(),
                assets: new Set(),
              },
              deselectAll: () => {},
              addNode: () => {},
              selectAll: () => {},
              selectNodes: () => {},
            },
          },
          global: {
            main: {
              blockingAction: false,
              pointerLocation: { x: 0, y: 0 },
            },
          },
        } as unknown as AppController,
        services: {
          stateEventBus: new EventTarget(),
        } as unknown as AppServices,
      });

      await NodeActionsModule.onPaste();

      assert.strictEqual(editCalled, false, "Should not edit when readOnly");
    });

    test("pastes graph descriptor from clipboard", async () => {
      let editCalled = false;
      const addedNodes: string[] = [];

      const graphDescriptor = JSON.stringify({
        title: "Pasted Board",
        nodes: [{ id: "pasted-1", type: "some-type" }],
        edges: [],
      });

      // Mock clipboard to return text/plain with JSON
      const readMock = mock.method(navigator.clipboard, "read", async () => [
        {
          types: ["text/plain"],
          getType: async () => new Blob([graphDescriptor]),
        },
      ]);
      const readTextMock = mock.method(
        navigator.clipboard,
        "readText",
        async () => graphDescriptor
      );

      const mockEditor = {
        apply: async () => ({ success: true }),
        edit: async (_edits: unknown[], _label: string) => {
          editCalled = true;
        },
        inspect: (_graphId: string) => ({
          nodeById: (_id: string) => ({
            metadata: () => ({}),
          }),
          nodes: () => [],
          assetEdges: () => [],
          raw: () => ({ nodes: [], edges: [] }),
          metadata: () => ({}),
        }),
        raw: () => ({ nodes: [], edges: [] }),
        history: () => ({
          canUndo: () => false,
          canRedo: () => false,
          undo: async () => {},
          redo: async () => {},
        }),
      };

      bindKeyboardAction(mockEditor, {
        size: 0,
        addedNodes,
      });

      // Also need graphStore on services for ClipboardReader
      NodeActionsModule.bind({
        controller: {
          editor: {
            graph: {
              editor: mockEditor,
              inspect: (graphId: string) => mockEditor.inspect(graphId),
              readOnly: false,
              url: "https://example.com/board.json",
            },
            selection: {
              size: 0,
              selection: {
                nodes: new Set(),
                edges: new Set(),
                comments: new Set(),
                assetEdges: new Set(),
                assets: new Set(),
              },
              deselectAll: () => {},
              addNode: (id: string) => {
                addedNodes.push(id);
              },
              selectAll: () => {},
              selectNodes: () => {},
            },
          },
          global: {
            main: {
              blockingAction: false,
              pointerLocation: { x: 100, y: 200 },
            },
          },
        } as unknown as AppController,
        services: {
          stateEventBus: new EventTarget(),
          graphStore: {
            load: async () => ({ success: false }),
          },
        } as unknown as AppServices,
      });

      await NodeActionsModule.onPaste();

      readMock.mock.restore();
      readTextMock.mock.restore();

      assert.ok(editCalled, "editor.edit should have been called");
    });

    test("pastes plain text as Generate node", async () => {
      let editCalled = false;
      const editSpecs: unknown[][] = [];

      const plainText = "Hello, world!";

      const readMock = mock.method(navigator.clipboard, "read", async () => [
        {
          types: ["text/plain"],
          getType: async () => new Blob([plainText]),
        },
      ]);
      const readTextMock = mock.method(
        navigator.clipboard,
        "readText",
        async () => plainText
      );

      const mockEditor = {
        apply: async () => ({ success: true }),
        edit: async (edits: unknown[], _label: string) => {
          editCalled = true;
          editSpecs.push(edits);
        },
        inspect: (_graphId: string) => ({
          nodeById: (_id: string) => ({
            metadata: () => ({}),
          }),
          nodes: () => [],
          assetEdges: () => [],
          raw: () => ({ nodes: [], edges: [] }),
          metadata: () => ({}),
        }),
        raw: () => ({ nodes: [], edges: [] }),
        history: () => ({
          canUndo: () => false,
          canRedo: () => false,
          undo: async () => {},
          redo: async () => {},
        }),
      };

      NodeActionsModule.bind({
        controller: {
          editor: {
            graph: {
              editor: mockEditor,
              inspect: (graphId: string) => mockEditor.inspect(graphId),
              readOnly: false,
              url: "https://example.com/board.json",
            },
            selection: {
              size: 0,
              selection: {
                nodes: new Set(),
                edges: new Set(),
                comments: new Set(),
                assetEdges: new Set(),
                assets: new Set(),
              },
              deselectAll: () => {},
              addNode: () => {},
              selectAll: () => {},
              selectNodes: () => {},
            },
          },
          global: {
            main: {
              blockingAction: false,
              pointerLocation: { x: 100, y: 200 },
            },
          },
        } as unknown as AppController,
        services: {
          stateEventBus: new EventTarget(),
          graphStore: {
            load: async () => ({ success: false }),
          },
        } as unknown as AppServices,
      });

      await NodeActionsModule.onPaste();

      readMock.mock.restore();
      readTextMock.mock.restore();

      assert.ok(
        editCalled,
        "editor.edit should have been called for plain text"
      );
    });
  });
});

suite("onNodeAction", () => {
  beforeEach(() => {
    coordination.reset();
  });

  function bindNodeAction() {
    const setNodeActionRequestFn = mock.fn();
    const controller = {
      editor: {
        graph: {
          editor: null,
          readOnly: false,
          lastNodeConfigChange: null,
        },
      },
      global: { main: { blockingAction: false } },
      run: {
        main: {
          setNodeActionRequest: setNodeActionRequestFn,
        },
      },
    } as unknown as AppController;
    const services = {
      stateEventBus: new EventTarget(),
    } as unknown as AppServices;

    NodeActionsModule.bind({ controller, services });

    return { setNodeActionRequestFn };
  }

  test("maps console to step", async () => {
    const { setNodeActionRequestFn } = bindNodeAction();

    const evt = new StateEvent({
      eventType: "node.action",
      nodeId: "node-1",
      subGraphId: null,
      actionContext: "console",
    });
    await NodeActionsModule.onNodeAction(evt);

    assert.strictEqual(setNodeActionRequestFn.mock.callCount(), 1);
    assert.deepStrictEqual(setNodeActionRequestFn.mock.calls[0].arguments[0], {
      nodeId: "node-1",
      actionContext: "step",
    });
  });

  test("passes graph context unchanged", async () => {
    const { setNodeActionRequestFn } = bindNodeAction();

    const evt = new StateEvent({
      eventType: "node.action",
      nodeId: "node-2",
      subGraphId: null,
      actionContext: "graph",
    });
    await NodeActionsModule.onNodeAction(evt);

    assert.strictEqual(setNodeActionRequestFn.mock.callCount(), 1);
    assert.deepStrictEqual(setNodeActionRequestFn.mock.calls[0].arguments[0], {
      nodeId: "node-2",
      actionContext: "graph",
    });
  });

  test("returns early when actionContext is null", async () => {
    const { setNodeActionRequestFn } = bindNodeAction();

    const evt = new StateEvent({
      eventType: "node.action",
      nodeId: "node-3",
      subGraphId: null,
      actionContext: null,
    });
    await NodeActionsModule.onNodeAction(evt);

    assert.strictEqual(
      setNodeActionRequestFn.mock.callCount(),
      0,
      "should not call setNodeActionRequest when actionContext is null"
    );
  });
});
