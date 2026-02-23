/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { suite, test, beforeEach } from "node:test";
import assert from "node:assert";
import { coordination } from "../../../../src/sca/coordination.js";
import * as agentActions from "../../../../src/sca/actions/agent/agent-actions.js";
import { createMockEnvironment } from "../../helpers/mock-environment.js";
import { defaultRuntimeFlags } from "../../controller/data/default-flags.js";

suite("Agent Actions", () => {
  beforeEach(() => {
    coordination.reset();
  });

  suite("invalidateResumableRuns", () => {
    test("calls agentContext.invalidateResumableRuns when triggered", async () => {
      let invalidateCalled = false;

      agentActions.bind({
        services: {
          agentContext: {
            invalidateResumableRuns: () => {
              invalidateCalled = true;
            },
          },
        } as never,
        controller: {} as never,
        env: createMockEnvironment(defaultRuntimeFlags),
      });

      await agentActions.invalidateResumableRuns();

      assert.strictEqual(
        invalidateCalled,
        true,
        "invalidateResumableRuns should be called"
      );
    });
  });

  suite("clearRunsOnGraphChange", () => {
    test("calls agentContext.clearAllRuns when triggered", async () => {
      let clearCalled = false;

      agentActions.bind({
        services: {
          agentContext: {
            clearAllRuns: () => {
              clearCalled = true;
            },
          },
        } as never,
        controller: {} as never,
        env: createMockEnvironment(defaultRuntimeFlags),
      });

      await agentActions.clearRunsOnGraphChange();

      assert.strictEqual(clearCalled, true, "clearAllRuns should be called");
    });
  });
});
