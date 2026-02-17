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
  PendingHydrationError,
} from "../../../../src/sca/utils/helpers/helpers.js";
import { PENDING_HYDRATION } from "../../../../src/sca/utils/sentinel.js";
import { RootController } from "../../../../src/sca/controller/subcontrollers/root-controller.js";
import { field } from "../../../../src/sca/controller/decorators/field.js";

suite("Hydration", () => {
  test("isHydrating", async () => {
    assert.ok(isHydrating(() => PENDING_HYDRATION));
    assert.ok(!isHydrating(() => "foo"));
    assert.ok(!isHydrating(() => 0));
    assert.ok(!isHydrating(() => []));
    assert.ok(!isHydrating(() => true));
    assert.ok(!isHydrating(() => false));
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

  test("throws on unhydrated objects", async () => {
    class HydratingController extends RootController {
      @field({ persist: "local" })
      accessor person = { name: "default" };
    }

    const h = new HydratingController("Controller", "HydratingController");
    assert.throws(() => {
      // Accessing h.person.name before hydration should throw an Error.
      const name = h.person.name;
      assert.fail(name);
    }, new PendingHydrationError("person"));
  });

  test("throws on unhydrated values", async () => {
    class HydratingController extends RootController {
      @field({ persist: "local" })
      accessor item = "foo";
    }

    const h = new HydratingController("Controller", "HydratingController");
    assert.throws(() => {
      // Accessing h.person.name before hydration should throw an Error.
      const name = h.item;
      assert.fail(name);
    }, new PendingHydrationError("item"));
  });

  test("hydration propagates errors", async () => {
    assert.throws(() => {
      isHydrating(() => {
        throw new Error("propagated error");
      });
    }, new Error("propagated error"));
  });

  test("hydration throws for async callbacks", async () => {
    assert.throws(() => {
      isHydrating(async () => {
        // No body.
      });
    }, new Error("isHydrating accessors must be synchronous"));
  });
});
