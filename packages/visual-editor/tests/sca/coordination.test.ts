/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { suite, it, beforeEach, mock } from "node:test";
import assert from "node:assert";

import {
  coordination,
  ActionMode,
  normalizeKeyCombo,
  keyboardTrigger,
} from "../../src/sca/coordination.js";

/** Helper to yield to the microtask queue */
const microtask = () => new Promise<void>((resolve) => queueMicrotask(resolve));

suite("CoordinationRegistry", () => {
  beforeEach(() => {
    coordination.reset();
  });

  // =========================================================================
  // Trigger Lifecycle
  // =========================================================================

  suite("Trigger Lifecycle", () => {
    it("enterTrigger adds to active list", () => {
      const done = coordination.enterTrigger("Test Trigger");
      assert.deepStrictEqual(coordination.listActiveTriggers(), [
        "Test Trigger",
      ]);
      done();
    });

    it("done() removes from active list", () => {
      const done = coordination.enterTrigger("Test Trigger");
      assert.strictEqual(coordination.listActiveTriggers().length, 1);
      done();
      assert.strictEqual(coordination.listActiveTriggers().length, 0);
    });

    it("multiple concurrent triggers tracked independently", () => {
      const done1 = coordination.enterTrigger("Trigger A");
      const done2 = coordination.enterTrigger("Trigger B");
      const done3 = coordination.enterTrigger("Trigger C");

      assert.deepStrictEqual(
        coordination.listActiveTriggers().sort(),
        ["Trigger A", "Trigger B", "Trigger C"].sort()
      );

      done2();
      assert.deepStrictEqual(
        coordination.listActiveTriggers().sort(),
        ["Trigger A", "Trigger C"].sort()
      );

      done1();
      done3();
      assert.deepStrictEqual(coordination.listActiveTriggers(), []);
    });

    it("trigger completion allows actions to run", async () => {
      // Create action
      const action = coordination.registerAction(
        "Test.action",
        ActionMode.Awaits,
        async () => {
          return "completed";
        }
      );

      // Start trigger
      const done = coordination.enterTrigger("Async Trigger");

      // Start the action - it will wait for the trigger
      const actionPromise = action();

      // Complete the trigger after a brief delay
      await microtask();
      done();

      // Now action should complete
      const result = await actionPromise;
      assert.strictEqual(result, "completed");
    });
  });

  // =========================================================================
  // Action Registration
  // =========================================================================

  suite("Action Registration", () => {
    it("register returns callable function", async () => {
      const mockFn = mock.fn(async () => "result");
      const action = coordination.registerAction(
        "Test.action",
        ActionMode.Immediate,
        mockFn
      );

      const result = await action();
      assert.strictEqual(result, "result");
      assert.strictEqual(mockFn.mock.callCount(), 1);
    });

    it("registered actions appear in list()", () => {
      coordination.registerAction(
        "Action.one",
        ActionMode.Immediate,
        async () => {}
      );
      coordination.registerAction(
        "Action.two",
        ActionMode.Awaits,
        async () => {}
      );
      coordination.registerAction(
        "Action.three",
        ActionMode.Exclusive,
        async () => {}
      );

      const actions = coordination.listRegisteredActions();
      assert.strictEqual(actions.length, 3);
      assert.deepStrictEqual(actions.map((a) => a.name).sort(), [
        "Action.one",
        "Action.three",
        "Action.two",
      ]);
    });

    it("immediate mode executes without waiting", async () => {
      // Start a trigger that does async work
      const triggerWork = async () => {
        const done = coordination.enterTrigger("Blocking Trigger");
        await microtask();
        // Don't complete - stays active
        return done;
      };

      const doneFn = await triggerWork();

      // Immediate action runs even with active trigger
      const mockFn = mock.fn(async () => "immediate-result");
      const action = coordination.registerAction(
        "Test.immediate",
        ActionMode.Immediate,
        mockFn
      );

      const result = await action();
      assert.strictEqual(result, "immediate-result");
      assert.strictEqual(mockFn.mock.callCount(), 1);

      // Trigger is still active but action completed
      assert.deepStrictEqual(coordination.listActiveTriggers(), [
        "Blocking Trigger",
      ]);

      // Cleanup
      doneFn();
    });

    it("awaits mode waits when triggers are active", async () => {
      // Create an awaits action
      const action = coordination.registerAction(
        "Test.awaits",
        ActionMode.Awaits,
        async () => {
          return "awaits-result";
        }
      );

      // Start trigger
      const done = coordination.enterTrigger("Save Trigger");

      // Start the action - it will wait for the trigger
      const actionPromise = action();

      // Complete the trigger after a brief delay
      await microtask();
      done();

      // Action should complete after trigger
      const result = await actionPromise;
      assert.strictEqual(result, "awaits-result");
    });

    it("exclusive mode blocks concurrent exclusive actions", async () => {
      const executionOrder: string[] = [];

      const exclusiveAction1 = coordination.registerAction(
        "Exclusive.one",
        ActionMode.Exclusive,
        async () => {
          executionOrder.push("action1-start");
          await new Promise((r) => setTimeout(r, 30));
          executionOrder.push("action1-end");
        }
      );

      const exclusiveAction2 = coordination.registerAction(
        "Exclusive.two",
        ActionMode.Exclusive,
        async () => {
          executionOrder.push("action2-start");
          await new Promise((r) => setTimeout(r, 10));
          executionOrder.push("action2-end");
        }
      );

      // Start both actions concurrently
      await Promise.all([exclusiveAction1(), exclusiveAction2()]);

      // Action2 should start only after action1 completes
      assert.deepStrictEqual(executionOrder, [
        "action1-start",
        "action1-end",
        "action2-start",
        "action2-end",
      ]);
    });
  });

  // =========================================================================
  // Trigger-Action Coordination
  // =========================================================================

  suite("Trigger-Action Coordination", () => {
    it("awaits action waits when trigger is pre-existing", async () => {
      const action = coordination.registerAction(
        "Test.action",
        ActionMode.Awaits,
        async () => {
          return "done";
        }
      );

      // Start trigger
      const done = coordination.enterTrigger("Pre-existing Trigger");

      // Start the action - it will wait for the trigger
      const actionPromise = action();

      // Complete trigger after a brief delay
      await microtask();
      done();

      // Action should complete after trigger
      const result = await actionPromise;
      assert.strictEqual(result, "done");
    });

    it("awaits action does NOT wait for trigger started after it", async () => {
      // Create action first
      const action = coordination.registerAction(
        "Test.action",
        ActionMode.Awaits,
        async () => {
          // Start a trigger during action execution
          const done = coordination.enterTrigger("Later Trigger");
          await new Promise((r) => setTimeout(r, 10));
          done();
          return "done";
        }
      );

      // No triggers active when action starts
      const result = await action();
      assert.strictEqual(result, "done");
    });

    it("awaits action waits for all active triggers", async () => {
      const action = coordination.registerAction(
        "Test.action",
        ActionMode.Awaits,
        async () => {
          return "done";
        }
      );

      // Start multiple triggers
      const done1 = coordination.enterTrigger("Trigger 1");
      const done2 = coordination.enterTrigger("Trigger 2");
      const done3 = coordination.enterTrigger("Trigger 3");

      // Start the action - it will wait for all triggers
      const actionPromise = action();

      // Complete all triggers
      await microtask();
      done1();
      done2();
      done3();

      // Action should complete after all triggers
      const result = await actionPromise;
      assert.strictEqual(result, "done");
    });

    it("immediate action proceeds while triggers active", async () => {
      const triggerWork = async () => {
        const done = coordination.enterTrigger("Active Trigger");
        await microtask();
        return done;
      };

      const doneFn = await triggerWork();

      const action = coordination.registerAction(
        "Test.immediate",
        ActionMode.Immediate,
        async () => {
          // Should run even with active trigger
          return "immediate-done";
        }
      );

      const result = await action();
      assert.strictEqual(result, "immediate-done");
      assert.deepStrictEqual(coordination.listActiveTriggers(), [
        "Active Trigger",
      ]);

      doneFn();
    });
  });

  // =========================================================================
  // Exclusive Mode
  // =========================================================================

  suite("Exclusive Mode", () => {
    it("only one exclusive action runs at a time", async () => {
      let concurrentCount = 0;
      let maxConcurrent = 0;

      const exclusiveAction = coordination.registerAction(
        "Exclusive.action",
        ActionMode.Exclusive,
        async () => {
          concurrentCount++;
          maxConcurrent = Math.max(maxConcurrent, concurrentCount);
          await new Promise((r) => setTimeout(r, 10));
          concurrentCount--;
        }
      );

      // Run 5 concurrent calls
      await Promise.all([
        exclusiveAction(),
        exclusiveAction(),
        exclusiveAction(),
        exclusiveAction(),
        exclusiveAction(),
      ]);

      assert.strictEqual(maxConcurrent, 1);
    });

    it("queued exclusive actions run in order", async () => {
      const order: number[] = [];

      const action1 = coordination.registerAction(
        "Exclusive.1",
        ActionMode.Exclusive,
        async () => {
          await new Promise((r) => setTimeout(r, 30));
          order.push(1);
        }
      );

      const action2 = coordination.registerAction(
        "Exclusive.2",
        ActionMode.Exclusive,
        async () => {
          await new Promise((r) => setTimeout(r, 10));
          order.push(2);
        }
      );

      const action3 = coordination.registerAction(
        "Exclusive.3",
        ActionMode.Exclusive,
        async () => {
          await new Promise((r) => setTimeout(r, 5));
          order.push(3);
        }
      );

      // Start all at once - they should run in sequence
      await Promise.all([action1(), action2(), action3()]);

      assert.deepStrictEqual(order, [1, 2, 3]);
    });

    it("non-exclusive actions can run during exclusive", async () => {
      const events: string[] = [];

      const exclusiveAction = coordination.registerAction(
        "Exclusive.action",
        ActionMode.Exclusive,
        async () => {
          events.push("exclusive-start");
          await new Promise((r) => setTimeout(r, 50));
          events.push("exclusive-end");
        }
      );

      const immediateAction = coordination.registerAction(
        "Immediate.action",
        ActionMode.Immediate,
        async () => {
          events.push(ActionMode.Immediate);
        }
      );

      // Start exclusive, then immediate after a small delay
      const exclusivePromise = exclusiveAction();
      await new Promise((r) => setTimeout(r, 10));
      await immediateAction();
      await exclusivePromise;

      // Immediate should have run during exclusive
      assert.deepStrictEqual(events, [
        "exclusive-start",
        ActionMode.Immediate,
        "exclusive-end",
      ]);
    });

    it("exclusive action does not wait for in-progress immediate action", async () => {
      const events: string[] = [];

      // Register a slow Immediate action (simulates a network call like
      // Step.lookupMemorySheet that triggered the original deadlock).
      const slowImmediate = coordination.registerAction(
        "Slow.immediate",
        ActionMode.Immediate,
        async () => {
          events.push("immediate-start");
          await new Promise((r) => setTimeout(r, 100));
          events.push("immediate-end");
        }
      );

      const exclusiveAction = coordination.registerAction(
        "Fast.exclusive",
        ActionMode.Exclusive,
        async () => {
          events.push("exclusive-start");
          events.push("exclusive-end");
        }
      );

      // Start the slow Immediate action first
      const immediatePromise = slowImmediate();

      // Give it a tick to register as in-progress
      await microtask();

      // Now start the Exclusive action — it should NOT wait for the Immediate
      await exclusiveAction();

      // Wait for the slow Immediate to complete so we can check full ordering
      await immediatePromise;

      // Exclusive should have completed before the slow Immediate finishes
      assert.ok(
        events.indexOf("exclusive-end") < events.indexOf("immediate-end"),
        `Exclusive should finish before Immediate, but got: ${events.join(", ")}`
      );
    });
  });

  // =========================================================================
  // Call Stack Tracking
  // =========================================================================

  suite("Call Stack Tracking", () => {
    it("getCallStack() tracks actions only, not triggers", () => {
      // Triggers are NOT on the call stack (scope enforcement uses runInTriggerScope)
      const done = coordination.enterTrigger("Test Trigger");
      assert.deepStrictEqual(coordination.getCallStack(), []);
      done();
      assert.deepStrictEqual(coordination.getCallStack(), []);
    });

    it("call stack updates on action entry/exit", async () => {
      const stacks: string[][] = [];

      const action = coordination.registerAction(
        "Test.action",
        ActionMode.Immediate,
        async () => {
          stacks.push([...coordination.getCallStack()]);
        }
      );

      await action();
      stacks.push([...coordination.getCallStack()]);

      // During action, it's in the stack; after, it's not
      assert.deepStrictEqual(stacks, [["Test.action"], []]);
    });

    it("nested actions tracked correctly", async () => {
      const stacks: string[][] = [];

      const innerAction = coordination.registerAction(
        "Inner.action",
        ActionMode.Immediate,
        async () => {
          stacks.push(["inner-action", ...coordination.getCallStack()]);
        }
      );

      const outerAction = coordination.registerAction(
        "Outer.action",
        ActionMode.Immediate,
        async () => {
          stacks.push(["outer-start", ...coordination.getCallStack()]);
          await innerAction();
          stacks.push(["outer-end", ...coordination.getCallStack()]);
        }
      );

      await outerAction();
      stacks.push(["after-all", ...coordination.getCallStack()]);

      assert.deepStrictEqual(stacks, [
        ["outer-start", "Outer.action"],
        ["inner-action", "Outer.action", "Inner.action"],
        ["outer-end", "Outer.action"],
        ["after-all"],
      ]);
    });
  });

  // =========================================================================
  // Trigger-Action Conflict Detection
  // =========================================================================

  suite("Trigger-Action Conflict Detection", () => {
    it("triggers are NOT on call stack", () => {
      // Triggers don't add to call stack - only actions do
      const done = coordination.enterTrigger("Test Trigger");
      assert.deepStrictEqual(coordination.getCallStack(), []);
      done();
    });

    it("awaits action waits while trigger is active", async () => {
      const action = coordination.registerAction(
        "Conflict.action",
        ActionMode.Awaits,
        async () => {
          return "waited successfully";
        }
      );

      const done = coordination.enterTrigger("Active Trigger");

      // Start the action - it will wait
      const actionPromise = action();

      // Complete trigger
      await microtask();
      done();

      // Action should complete
      const result = await actionPromise;
      assert.strictEqual(result, "waited successfully");
    });

    it("exclusive action waits while trigger is active", async () => {
      const action = coordination.registerAction(
        "Exclusive.conflict",
        ActionMode.Exclusive,
        async () => {
          return "waited";
        }
      );

      const done = coordination.enterTrigger("Background Trigger");

      // Start the action - it will wait
      const actionPromise = action();

      // Complete trigger
      await microtask();
      done();

      // Action should complete
      const result = await actionPromise;
      assert.strictEqual(result, "waited");
    });

    it("cycle detection throws when same action re-enters", async () => {
      let callCount = 0;
      const action = coordination.registerAction(
        "Cyclic.action",
        ActionMode.Awaits,
        async () => {
          callCount++;
          if (callCount === 1) {
            // First call tries to call itself again
            await action();
          }
          return "done";
        }
      );

      // Should throw with cycle detection error
      await assert.rejects(
        () => action(),
        (err: unknown) => {
          assert.ok(err instanceof Error);
          assert.ok(err.message.includes("Cycle"));
          assert.ok(err.message.includes("Cyclic.action"));
          return true;
        }
      );
    });

    it("awaits action works when no triggers are active", async () => {
      const action = coordination.registerAction(
        "NoConflict.action",
        ActionMode.Awaits,
        async () => {
          return "success";
        }
      );

      // No triggers active
      const result = await action();
      assert.strictEqual(result, "success");
    });

    it("awaits action works after trigger completes", async () => {
      const action = coordination.registerAction(
        "AfterTrigger.action",
        ActionMode.Awaits,
        async () => {
          return "success";
        }
      );

      // Start and complete trigger
      const done = coordination.enterTrigger("Quick Trigger");
      done();

      // Now action can run
      const result = await action();
      assert.strictEqual(result, "success");
    });

    it("immediate mode works while trigger is active", async () => {
      const action = coordination.registerAction(
        "Immediate.ok",
        ActionMode.Immediate,
        async () => {
          return "immediate success";
        }
      );

      const done = coordination.enterTrigger("Active Trigger");

      // Immediate actions don't check for active triggers
      const result = await action();
      assert.strictEqual(result, "immediate success");

      done();
    });

    it("immediate mode works when no triggers active", async () => {
      const action = coordination.registerAction(
        "Immediate.noTrigger",
        ActionMode.Immediate,
        async () => {
          return "immediate result";
        }
      );

      const result = await action();
      assert.strictEqual(result, "immediate result");
    });
  });

  // =========================================================================
  // Edge Cases
  // =========================================================================

  suite("Edge Cases", () => {
    it("action called with no active triggers proceeds immediately", async () => {
      const action = coordination.registerAction(
        "Test.action",
        ActionMode.Awaits,
        async () => {
          return ActionMode.Immediate;
        }
      );

      const result = await action();
      assert.strictEqual(result, ActionMode.Immediate);
    });

    it("trigger that throws still removed from active list", async () => {
      const done = coordination.enterTrigger("Throwing Trigger");

      // Simulate an error being caught
      try {
        throw new Error("Trigger error");
      } catch {
        // Error caught
      } finally {
        done();
      }

      assert.deepStrictEqual(coordination.listActiveTriggers(), []);
    });

    it("action that throws still removed from call stack", async () => {
      const action = coordination.registerAction(
        "Throwing.action",
        ActionMode.Immediate,
        async () => {
          throw new Error("Action error");
        }
      );

      await assert.rejects(() => action(), { message: "Action error" });

      // Call stack should be clean after error
      assert.deepStrictEqual(coordination.getCallStack(), []);
    });

    it("cleanup after exclusive action failure", async () => {
      const action1 = coordination.registerAction(
        "Failing.exclusive",
        ActionMode.Exclusive,
        async () => {
          throw new Error("Exclusive failed");
        }
      );

      const action2 = coordination.registerAction(
        "Next.exclusive",
        ActionMode.Exclusive,
        async () => {
          return "success";
        }
      );

      // First action fails
      await assert.rejects(() => action1());

      // Second action should still be able to run
      const result = await action2();
      assert.strictEqual(result, "success");
    });

    it("reset() clears all state", async () => {
      coordination.enterTrigger("Trigger 1");
      coordination.enterTrigger("Trigger 2");
      coordination.registerAction(
        "Action 1",
        ActionMode.Immediate,
        async () => {}
      );

      coordination.reset();

      assert.deepStrictEqual(coordination.listActiveTriggers(), []);
      assert.deepStrictEqual(coordination.listRegisteredActions(), []);
      assert.deepStrictEqual(coordination.getCallStack(), []);
    });
  });

  // =========================================================================
  // Keyboard Trigger
  // =========================================================================

  suite("Keyboard Trigger", () => {
    function makeKeyEvent(
      key: string,
      opts: { meta?: boolean; ctrl?: boolean; shift?: boolean } = {}
    ): KeyboardEvent {
      return {
        key,
        metaKey: opts.meta ?? false,
        ctrlKey: opts.ctrl ?? false,
        shiftKey: opts.shift ?? false,
        composedPath: () => [],
        preventDefault: mock.fn(),
        stopImmediatePropagation: mock.fn(),
      } as unknown as KeyboardEvent;
    }

    suite("normalizeKeyCombo", () => {
      it("returns plain key for no modifiers", () => {
        assert.strictEqual(normalizeKeyCombo(makeKeyEvent("s")), "s");
      });

      it("returns Cmd+key for meta", () => {
        assert.strictEqual(
          normalizeKeyCombo(makeKeyEvent("s", { meta: true })),
          "Cmd+s"
        );
      });

      it("returns Ctrl+key for ctrl", () => {
        assert.strictEqual(
          normalizeKeyCombo(makeKeyEvent("s", { ctrl: true })),
          "Ctrl+s"
        );
      });

      it("returns Shift+key for shift", () => {
        assert.strictEqual(
          normalizeKeyCombo(makeKeyEvent("z", { shift: true })),
          "Shift+z"
        );
      });

      it("returns Cmd+Shift+key for meta+shift", () => {
        assert.strictEqual(
          normalizeKeyCombo(makeKeyEvent("z", { meta: true, shift: true })),
          "Cmd+Shift+z"
        );
      });

      it("returns Ctrl+Shift+key for ctrl+shift", () => {
        assert.strictEqual(
          normalizeKeyCombo(makeKeyEvent("z", { ctrl: true, shift: true })),
          "Ctrl+Shift+z"
        );
      });

      it("returns empty for bare Meta key", () => {
        assert.strictEqual(normalizeKeyCombo(makeKeyEvent("Meta")), "");
      });

      it("returns empty for bare Ctrl key", () => {
        assert.strictEqual(normalizeKeyCombo(makeKeyEvent("Ctrl")), "");
      });

      it("returns empty for bare Shift key", () => {
        assert.strictEqual(normalizeKeyCombo(makeKeyEvent("Shift")), "");
      });

      it("handles special keys like Delete and Backspace", () => {
        assert.strictEqual(normalizeKeyCombo(makeKeyEvent("Delete")), "Delete");
        assert.strictEqual(
          normalizeKeyCombo(makeKeyEvent("Backspace")),
          "Backspace"
        );
      });
    });

    suite("keyboardTrigger factory", () => {
      it("creates a KeyboardTrigger", () => {
        const trigger = keyboardTrigger("Save", ["Cmd+s", "Ctrl+s"]);
        assert.strictEqual(trigger.type, "keyboard");
        assert.strictEqual(trigger.name, "Save");
        assert.deepStrictEqual(trigger.keys, ["Cmd+s", "Ctrl+s"]);
        assert.strictEqual(trigger.guard, undefined);
        assert.strictEqual(trigger.target, undefined);
      });

      it("accepts a guard function", () => {
        const guard = () => true;
        const trigger = keyboardTrigger("Delete", ["Delete"], guard);
        assert.strictEqual(trigger.guard, guard);
      });
    });

    suite("activateTriggers with keyboard trigger", () => {
      it("fires action when matching key is pressed", async () => {
        const actionCalls: KeyboardEvent[] = [];
        const target = new EventTarget();

        const trigger = keyboardTrigger(
          "Save",
          ["Cmd+s", "Ctrl+s"],
          undefined,
          target
        );

        const action = mock.fn(async (evt?: KeyboardEvent) => {
          if (evt) actionCalls.push(evt);
        });

        const dispose = coordination.activateTriggers(
          "Test.save",
          [trigger],
          action as (...args: never[]) => Promise<unknown>
        );

        // Fire matching event
        target.dispatchEvent(
          Object.assign(new Event("keydown"), {
            key: "s",
            metaKey: true,
            ctrlKey: false,
            shiftKey: false,
            composedPath: () => [],
            preventDefault: mock.fn(),
            stopImmediatePropagation: mock.fn(),
          })
        );

        await microtask();

        assert.strictEqual(action.mock.callCount(), 1);

        dispose();
      });

      it("does not fire action for non-matching key", async () => {
        const target = new EventTarget();

        const trigger = keyboardTrigger("Save", ["Cmd+s"], undefined, target);

        const action = mock.fn(async () => {});

        const dispose = coordination.activateTriggers(
          "Test.save",
          [trigger],
          action as (...args: never[]) => Promise<unknown>
        );

        // Fire non-matching event (Cmd+x)
        target.dispatchEvent(
          Object.assign(new Event("keydown"), {
            key: "x",
            metaKey: true,
            ctrlKey: false,
            shiftKey: false,
            composedPath: () => [],
          })
        );

        await microtask();

        assert.strictEqual(action.mock.callCount(), 0);

        dispose();
      });

      it("respects guard function", async () => {
        const target = new EventTarget();

        const trigger = keyboardTrigger(
          "Delete",
          ["Delete"],
          () => false, // Guard always rejects
          target
        );

        const action = mock.fn(async () => {});

        const dispose = coordination.activateTriggers(
          "Test.delete",
          [trigger],
          action as (...args: never[]) => Promise<unknown>
        );

        // Fire matching key, but guard rejects
        target.dispatchEvent(
          Object.assign(new Event("keydown"), {
            key: "Delete",
            metaKey: false,
            ctrlKey: false,
            shiftKey: false,
            composedPath: () => [],
          })
        );

        await microtask();

        assert.strictEqual(action.mock.callCount(), 0);

        dispose();
      });

      it("dispose removes keyboard listener", async () => {
        const target = new EventTarget();

        const trigger = keyboardTrigger("Save", ["Cmd+s"], undefined, target);

        const action = mock.fn(async () => {});

        const dispose = coordination.activateTriggers(
          "Test.save",
          [trigger],
          action as (...args: never[]) => Promise<unknown>
        );

        dispose();

        // Fire matching event - should not trigger
        target.dispatchEvent(
          Object.assign(new Event("keydown"), {
            key: "s",
            metaKey: true,
            ctrlKey: false,
            shiftKey: false,
            composedPath: () => [],
          })
        );

        await microtask();

        assert.strictEqual(action.mock.callCount(), 0);
      });
    });
  });
});
