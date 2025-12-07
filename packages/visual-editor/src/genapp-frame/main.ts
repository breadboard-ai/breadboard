/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  type GenAppFrameReadyMessage,
  isGenAppFrameSrcDocMessage,
  isRequestOpenPopupMessage,
} from "./protocol.js";

const iframe = document.body.querySelector("iframe#genapp" as "iframe");
if (!iframe) {
  throw new Error("Could not find iframe#genapp");
}

window.addEventListener("message", (event) => {
  if (isFromSameOriginParent(event) && isGenAppFrameSrcDocMessage(event.data)) {
    const { srcdoc } = event.data;
    console.debug(
      `[genapp-frame-child] Received srcdoc (length ${srcdoc.length})`
    );
    iframe.srcdoc = srcdoc;
  } else if (isFromIframe(event) && isRequestOpenPopupMessage(event.data)) {
    console.debug(
      `[genapp-frame-child] Forwarding "${event.data.type}" message`
    );
    window.parent.postMessage(event.data, window.location.origin);
  }
});

console.debug("[genapp-frame-child] Sending ready message", window);
window.parent.postMessage(
  { type: "genapp-frame-ready" } satisfies GenAppFrameReadyMessage,
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
