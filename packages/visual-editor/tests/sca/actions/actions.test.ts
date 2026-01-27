/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { suite, test } from "node:test";
import { actions } from "../../../src/sca/actions/actions.js";
import { AppServices } from "../../../src/sca/services/services.js";
import { AppController } from "../../../src/sca/controller/controller.js";
import { makeAction } from "../../../src/sca/actions/binder.js";

suite("Actions", () => {
  test("Instantiates without error", async () => {
    assert.doesNotThrow(() => {
      actions({} as AppController, {} as AppServices);
    });

    assert.throws(() => {
      const f = makeAction();
      String((f as unknown as { foo: number }).foo);
    }, new Error("Not set"));
  });
});
