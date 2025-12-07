/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppSandboxRequestOpenPopupMessage } from "./app-sandbox-protocol.js";

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
const toFunctionString = (fn: Function, bindings?: Record<string, unknown>) => {
  let str = fn.toString();
  if (bindings) {
    for (const [key, value] of Object.entries(bindings)) {
      str = str.replace(key, `(${JSON.stringify(value)})`);
    }
  }
  return str;
};

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
const scriptifyFunction = (fn: Function, bindings?: Record<string, unknown>) =>
  `<script>( ${toFunctionString(fn, bindings)} )();</script>`;

// Will be bound into the iframe script as the targetOrigin for postMessage
const PARENT_ORIGIN = window.location.origin;

// This script will be run in the AppCat-generated iframe, and will intercept
// any popups that are opened by the app to post back to Opal to request
// opening after gaining consent. The iframe is sandboxed and does not allow
// popups itself, so this is a best-effort to
export const INTERCEPT_POPUPS_SCRIPT = scriptifyFunction(
  () => {
    const requestPopup = (url: URL) =>
      window.parent.postMessage(
        {
          type: "app-sandbox-request-open-popup",
          url: url.toString(),
        } satisfies AppSandboxRequestOpenPopupMessage,
        PARENT_ORIGIN
      );
    // This script is guaranteed to be run before any generated scripts, and
    // we don't let the generated HTML override this
    Object.defineProperty(window, "open", {
      value: function (url?: string | URL) {
        if (url) {
          requestPopup(new URL(url));
        }
        return undefined;
      },
      writable: false,
      configurable: false,
      enumerable: false,
    });
    const findAncestorTag = <T extends keyof HTMLElementTagNameMap>(
      event: Event,
      tag: T
    ) => {
      const path = event.composedPath();
      return path.find((el) => (el as HTMLElement).localName === tag) as
        | HTMLElementTagNameMap[typeof tag]
        | undefined;
    };
    // This listener is capturing and guaranteed to be run before any
    // generated scripts, so we always get first crack at intercepting popups
    window.addEventListener(
      "click",
      (evt) => {
        const anchor = findAncestorTag(evt, "a");
        if (anchor) {
          requestPopup(new URL(anchor.href));
          evt.preventDefault();
          evt.stopImmediatePropagation();
        }
      },
      true
    );
  },
  { PARENT_ORIGIN }
);
