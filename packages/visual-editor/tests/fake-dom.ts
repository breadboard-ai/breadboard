/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { JSDOM } from "jsdom";
import { mock } from "node:test";

export function setDOM() {
  const dom = new JSDOM("<!DOCTYPE html>", {
    url: "http://localhost",
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const unsetGlobalThis = globalThis as any;
  unsetGlobalThis.window = dom.window;
  unsetGlobalThis.document = dom.window.document;
  unsetGlobalThis.HTMLElement = dom.window.HTMLElement;
  unsetGlobalThis.Node = dom.window.Node;
  unsetGlobalThis.Event = dom.window.Event;
  unsetGlobalThis.CustomEvent = dom.window.CustomEvent;
  unsetGlobalThis.Range = dom.window.Range;
  unsetGlobalThis.Selection = dom.window.Selection;
  unsetGlobalThis.location = dom.window.location;

  // Add a clipboard stub to the existing navigator object.
  // Uses mock.fn() so tests can spy on or override individual methods
  // via mock.method(navigator.clipboard, 'readText', ...).
  Object.defineProperty(globalThis.navigator, "clipboard", {
    value: {
      readText: mock.fn(async () => ""),
      read: mock.fn(async () => []),
      writeText: mock.fn(async () => {}),
    },
    writable: true,
    configurable: true,
  });

  if (!unsetGlobalThis.trustedTypes) {
    unsetGlobalThis.trustedTypes = {
      createPolicy(_name: unknown, rules: unknown) {
        return rules;
      },
    };
  }
}

export function unsetDOM() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const unsetGlobalThis = globalThis as any;
  unsetGlobalThis.window = undefined;
  unsetGlobalThis.document = undefined;
  unsetGlobalThis.HTMLElement = undefined;
  unsetGlobalThis.Node = undefined;
  unsetGlobalThis.Event = undefined;
  unsetGlobalThis.CustomEvent = undefined;
  unsetGlobalThis.Range = undefined;
  unsetGlobalThis.Selection = undefined;
  unsetGlobalThis.location = undefined;

  // Remove the clipboard stub from navigator.
  delete (globalThis.navigator as unknown as Record<string, unknown>).clipboard;
}
