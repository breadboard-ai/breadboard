/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppSandboxRequestOpenPopupMessage } from "./app-sandbox-protocol.js";
import { scriptifyFunction } from "./app-sandbox-scriptify.js";

// This script will be run in the AppCat-generated iframe, and will intercept
// any popups that are opened by the app to post back to Opal to request opening
// after gaining consent. The iframe is sandboxed and does not allow popups
// itself, so this is a best-effort to capture common ways the generated HTML
// may try to open a webpage.
export const INTERCEPT_POPUPS_SCRIPT = scriptifyFunction(() => {
  const requestPopup = (url: URL) =>
    window.parent.postMessage(
      {
        type: "app-sandbox-request-open-popup",
        url: url.toString(),
      } satisfies AppSandboxRequestOpenPopupMessage,
      "__PARENT_ORIGIN_TO_BE_REPLACED__"
    );
  // This script is guaranteed to be run before any generated scripts, and
  // we don't let the generated HTML overridea this
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
        evt.preventDefault();
        evt.stopImmediatePropagation();
        // Allow same-page hash links (e.g., href="#section") to navigate
        // without requiring popup consent
        const href = anchor.getAttribute("href");
        if (href?.startsWith("#")) {
          const targetId = href.substring(1);
          const targetElement = document.getElementById(targetId);

          if (targetElement) {
            targetElement.scrollIntoView({ behavior: "smooth" });
          }
        } else {
          requestPopup(new URL(anchor.href));
        }
      }
    },
    true
  );
}, [
  // These are raw string substitutions, so only pass trusted strings here.
  ["__PARENT_ORIGIN_TO_BE_REPLACED__", window.location.origin],
]);
