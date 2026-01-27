/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { after, afterEach, before, suite, test } from "node:test";
import { AppServices } from "../../../src/sca/services/services.js";
import { AppActions } from "../../../src/sca/actions/actions.js";
import {
  triggers,
  clean,
  list,
  destroy,
} from "../../../src/sca/triggers/triggers.js";
import { makeTrigger } from "../../../src/sca/triggers/binder.js";
import { makeTestController } from "./utils.js";
import { setDOM, unsetDOM } from "../../fake-dom.js";

suite("Triggers", () => {
  before(() => {
    setDOM();
  });

  after(() => {
    unsetDOM();
  });

  afterEach(() => {
    destroy();
  });

  test("Instantiates without error", () => {
    assert.doesNotThrow(() => {
      triggers(makeTestController(), {} as AppServices, {} as AppActions);
    });

    assert.throws(() => {
      const f = makeTrigger();
      String((f as unknown as { foo: number }).foo);
    }, new Error("Not set"));
  });

  test("cleans up", () => {
    triggers(makeTestController(), {} as AppServices, {} as AppActions);
    assert.deepStrictEqual(list(), {
      board: ["Save Trigger"],
      node: ["Autoname Trigger"],
    });
    clean();

    // Cleaning removes the triggers and the instance.
    assert.deepStrictEqual(list(), { board: [], node: [] });

    // Confirm that listing and cleaning do not throw in the absence of a
    // trigger instance.
    assert.doesNotThrow(() => {
      destroy();
      clean();
      list();
    });
  });
});
