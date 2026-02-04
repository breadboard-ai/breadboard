/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { after, afterEach, before, suite, test } from "node:test";
import { AppActions } from "../../../src/sca/actions/actions.js";
import * as RunActions from "../../../src/sca/actions/run/run-actions.js";
import {
  triggers,
  clean,
  list,
  destroy,
} from "../../../src/sca/triggers/triggers.js";
import { makeTrigger } from "../../../src/sca/triggers/binder.js";
import { makeTestController, makeTestServices, flushEffects } from "./utils.js";
import { setDOM, unsetDOM } from "../../fake-dom.js";

suite("Triggers", () => {
  before(() => {
    setDOM();
  });

  after(() => {
    unsetDOM();
  });

  // Cleanup: must flush deferred microtasks before disposing triggers.
  // The reactive() helper defers initial execution, so effects may still
  // be pending when a test completes. flushEffects() ensures they run
  // before we call destroy().
  afterEach(async () => {
    await flushEffects();
    destroy();
  });

  test("Instantiates without error", () => {
    assert.doesNotThrow(() => {
      const { controller } = makeTestController();
      const { services } = makeTestServices();
      // Actions binder needed because triggers call actions (e.g., syncConsoleFromRunner)
      // during their deferred execution
      RunActions.bind({ controller, services });
      triggers(controller, services, {} as AppActions);
    });

    assert.throws(() => {
      const f = makeTrigger();
      String((f as unknown as { foo: number }).foo);
    }, new Error("Not set"));
  });

  test("cleans up", () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    // Actions binder needed because triggers call actions during deferred execution
    RunActions.bind({ controller, services });
    triggers(controller, services, {} as AppActions);
    assert.deepStrictEqual(list(), {
      agent: ["[effect] Graph Invalidate Trigger", "[effect] Graph URL Change Trigger"],
      board: ["[effect] Save Trigger", "[effect] Newer Version Trigger", "[bridge] Save Status Bridge"],
      node: ["[effect] Autoname Trigger"],
      run: ["[effect] Graph Synchronization Trigger"],
      shell: ["[effect] Page Title Trigger"],
      router: ["[effect] Router Init Trigger", "[bridge] Router URL Change"],
      screenSize: [],
      step: ["[effect] Step Auto Save Trigger"],
    });
    clean();

    // Cleaning removes the triggers and the instance.
    assert.deepStrictEqual(list(), {
      agent: [],
      board: [],
      node: [],
      run: [],
      shell: [],
      router: [],
      screenSize: [],
      step: [],
    });

    // Confirm that listing and cleaning do not throw in the absence of a
    // trigger instance.
    assert.doesNotThrow(() => {
      destroy();
      clean();
      list();
    });
  });
});
