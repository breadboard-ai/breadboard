/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { suite, test } from "node:test";
import { onGraphVersionChange } from "../../../../src/sca/actions/integration/triggers.js";
import type { AppController } from "../../../../src/sca/controller/controller.js";
import type { AppServices } from "../../../../src/sca/services/services.js";

suite("Integration Triggers", () => {
  suite("onGraphVersionChange", () => {
    test("returns false when no graph is loaded", () => {
      const bind = {
        controller: {
          editor: {
            graph: { graph: null, version: 0 },
          },
        } as unknown as AppController,
        services: {} as AppServices,
      };

      const trigger = onGraphVersionChange(bind);

      // The trigger's condition should return falsy.
      assert.strictEqual(trigger.condition(), false);
    });

    test("returns version + 1 when graph exists", () => {
      const bind = {
        controller: {
          editor: {
            graph: { graph: { nodes: [], edges: [] }, version: 0 },
          },
        } as unknown as AppController,
        services: {} as AppServices,
      };

      const trigger = onGraphVersionChange(bind);

      // version 0 => returns 1 (truthy)
      assert.strictEqual(trigger.condition(), 1);
    });

    test("returns different values for different versions", () => {
      const graphController = {
        graph: { nodes: [], edges: [] },
        version: 5,
      };

      const bind = {
        controller: {
          editor: { graph: graphController },
        } as unknown as AppController,
        services: {} as AppServices,
      };

      const trigger = onGraphVersionChange(bind);
      assert.strictEqual(trigger.condition(), 6);

      graphController.version = 10;
      assert.strictEqual(trigger.condition(), 11);
    });
  });
});
