/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { beforeEach, afterEach, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { setDOM, unsetDOM } from "../fake-dom.js";

describe("is-ctrl-command", () => {
  beforeEach(() => {
    setDOM();
  });

  afterEach(() => {
    unsetDOM();
    mock.restoreAll();
  });

  it("returns metaKey on Mac", async () => {
    Object.defineProperty(globalThis.navigator, "platform", {
      value: "MacIntel",
      configurable: true,
    });

    const { isCtrlCommand } =
      await import("../../src/ui/input/is-ctrl-command.js");
    const macEvt = { metaKey: true, ctrlKey: false } as KeyboardEvent;
    assert.equal(isCtrlCommand(macEvt), true);

    const macEvtNoMeta = { metaKey: false, ctrlKey: true } as KeyboardEvent;
    assert.equal(isCtrlCommand(macEvtNoMeta), false);
  });

  it("returns ctrlKey on non-Mac", async () => {
    Object.defineProperty(globalThis.navigator, "platform", {
      value: "Win32",
      configurable: true,
    });

    const { isCtrlCommand } =
      await import("../../src/ui/input/is-ctrl-command.js");
    const winEvt = { metaKey: false, ctrlKey: true } as KeyboardEvent;
    assert.equal(isCtrlCommand(winEvt), true);
  });

  it("isMacPlatform returns true for Mac", async () => {
    Object.defineProperty(globalThis.navigator, "platform", {
      value: "MacIntel",
      configurable: true,
    });

    const { isMacPlatform } =
      await import("../../src/ui/input/is-ctrl-command.js");
    assert.equal(isMacPlatform(), true);
  });

  it("isMacPlatform returns false for Windows", async () => {
    Object.defineProperty(globalThis.navigator, "platform", {
      value: "Win32",
      configurable: true,
    });

    const { isMacPlatform } =
      await import("../../src/ui/input/is-ctrl-command.js");
    assert.equal(isMacPlatform(), false);
  });
});
