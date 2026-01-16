/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { suite, test } from "node:test";
import {
  isHydratedController,
  isHydrating,
} from "../../../src/controller/utils/hydration.js";
import { PENDING_HYDRATION } from "../../../src/controller/utils/sentinel.js";
import { RootController } from "../../../src/controller/subcontrollers/root-controller.js";
import { field } from "../../../src/controller/decorators/field.js";

suite("Hydration", () => {
  test("isHydrating", async () => {
    assert.ok(isHydrating(PENDING_HYDRATION));
    assert.ok(!isHydrating("foo"));
    assert.ok(!isHydrating(0));
    assert.ok(!isHydrating([]));
    assert.ok(!isHydrating(true));
    assert.ok(!isHydrating(false));
  });

  test("isHydratedController", async () => {
    assert.ok(
      isHydratedController({
        registerSignalHydration() {
          // No function body required.
        },
      })
    );

    assert.ok(!isHydratedController({}));
    assert.ok(!isHydratedController(null));
    assert.ok(!isHydratedController(3));
    assert.ok(!isHydratedController("foo"));
    assert.ok(!isHydratedController([]));
  });

  test("throws on unhydrated values", async () => {
    class HydratingController extends RootController {
      @field({ persist: "local" })
      accessor person = { name: "default" };
    }

    const h = new HydratingController("Controller");
    assert.throws(() => {
      // Accessing h.person.name before hydration should throw an Error.
      const name = h.person.name;
      assert.fail(name);
    }, new Error("Access attempted to unhydrated value"));
  });
});
