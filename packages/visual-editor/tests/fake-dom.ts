/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { JSDOM } from "jsdom";

export function setDOM() {
  const dom = new JSDOM("<!DOCTYPE html>", {
    url: "http://localhost",
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const unsetGlobalThis = globalThis as any;
  unsetGlobalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  globalThis.Event = dom.window.Event;
  globalThis.CustomEvent = dom.window.CustomEvent;

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
}
