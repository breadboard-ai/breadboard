/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { suite, test, before, after } from "node:test";
import { isFocusedOnGraphRenderer } from "../../../src/sca/actions/binder.js";
import { setDOM, unsetDOM } from "../../fake-dom.js";

suite("Binder — isFocusedOnGraphRenderer", () => {
  before(() => setDOM());
  after(() => unsetDOM());

  function makeKeyboardEvent(path: HTMLElement[]): KeyboardEvent {
    return {
      composedPath: () => path,
    } as unknown as KeyboardEvent;
  }

  test("returns true when composed path contains bb-renderer", () => {
    const renderer = document.createElement("bb-renderer");
    const evt = makeKeyboardEvent([renderer]);

    assert.strictEqual(isFocusedOnGraphRenderer(evt), true);
  });

  test("returns true when bb-renderer is nested in path", () => {
    const inner = document.createElement("div");
    const renderer = document.createElement("bb-renderer");
    const outer = document.createElement("div");
    const evt = makeKeyboardEvent([inner, renderer, outer]);

    assert.strictEqual(isFocusedOnGraphRenderer(evt), true);
  });

  test("returns false when composed path has no bb-renderer", () => {
    const div = document.createElement("div");
    const span = document.createElement("span");
    const evt = makeKeyboardEvent([div, span]);

    assert.strictEqual(isFocusedOnGraphRenderer(evt), false);
  });

  test("returns false for empty composed path", () => {
    const evt = makeKeyboardEvent([]);
    assert.strictEqual(isFocusedOnGraphRenderer(evt), false);
  });
});
