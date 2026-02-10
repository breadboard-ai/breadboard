/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  type AppSandboxReadyMessage,
  isAppSandboxOnDemandCallbackMessage,
  isAppSandboxRequestOpenPopupMessage,
  isAppSandboxSrcDocMessage,
} from "./app-sandbox-protocol.js";

if (window === window.parent) {
  throw new Error("[app-sandbox-bootstrap] Not iframed");
}

const iframe = document.body.querySelector(
  "#app-sandbox-inner-iframe" as "iframe"
);
if (!iframe) {
  throw new Error(
    "[app-sandbox-bootstrap] Could not find #app-sandbox-inner-iframe"
  );
}

window.addEventListener("message", (event) => {
  if (isFromSameOriginParent(event) && isAppSandboxSrcDocMessage(event.data)) {
    const { srcdoc } = event.data;
    console.debug(
      `[app-sandbox-bootstrap] Received srcdoc (length ${srcdoc.length})`
    );
    iframe.srcdoc = srcdoc;
  } else if (
    isFromIframe(event) &&
    (isAppSandboxRequestOpenPopupMessage(event.data) ||
      isAppSandboxOnDemandCallbackMessage(event.data))
  ) {
    console.debug(
      `[app-sandbox-bootstrap] Forwarding "${event.data.type}" message`
    );
    window.parent.postMessage(event.data, window.location.origin);
  }
});

console.debug("[app-sandbox-bootstrap] Sending ready message", window);
window.parent.postMessage(
  { type: "app-sandbox-ready" } satisfies AppSandboxReadyMessage,
  window.location.origin
);

function isFromSameOriginParent(event: MessageEvent): boolean {
  return (
    event.isTrusted &&
    event.source === window.parent &&
    event.origin === window.location.origin
  );
}

function isFromIframe(event: MessageEvent): boolean {
  return (
    event.isTrusted &&
    event.source != null &&
    event.source === iframe?.contentWindow
  );
}
