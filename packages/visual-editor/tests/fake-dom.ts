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
  unsetGlobalThis.document = dom.window.document;
  unsetGlobalThis.HTMLElement = dom.window.HTMLElement;
  unsetGlobalThis.Node = dom.window.Node;
  unsetGlobalThis.Event = dom.window.Event;
  unsetGlobalThis.CustomEvent = dom.window.CustomEvent;
  unsetGlobalThis.Range = dom.window.Range;
  unsetGlobalThis.Selection = dom.window.Selection;
  unsetGlobalThis.location = dom.window.location;

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
}
