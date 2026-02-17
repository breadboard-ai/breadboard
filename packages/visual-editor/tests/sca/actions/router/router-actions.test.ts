/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { suite, test, beforeEach } from "node:test";
import assert from "node:assert";
import { coordination } from "../../../../src/sca/coordination.js";
import * as routerActions from "../../../../src/sca/actions/router/router-actions.js";

suite("Router Actions", () => {
  beforeEach(() => {
    coordination.reset();
  });

  suite("updateFromPopstate", () => {
    test("calls router.updateFromCurrentUrl when triggered", async () => {
      let updateCalled = false;

      routerActions.bind({
        services: {} as never,
        controller: {
          router: {
            updateFromCurrentUrl: () => {
              updateCalled = true;
            },
          },
        } as never,
      });

      await routerActions.updateFromPopstate();

      assert.strictEqual(
        updateCalled,
        true,
        "updateFromCurrentUrl should be called"
      );
    });
  });

  suite("init", () => {
    test("calls router.init when triggered", async () => {
      let initCalled = false;

      routerActions.bind({
        services: {} as never,
        controller: {
          router: {
            init: () => {
              initCalled = true;
            },
          },
        } as never,
      });

      await routerActions.init();

      assert.strictEqual(initCalled, true, "router.init should be called");
    });
  });
});
