/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { CLIENT_DEPLOYMENT_CONFIG } from "@breadboard-ai/shared-ui/config/client-deployment-configuration.js";
import "@breadboard-ai/shared-ui/utils/install-opal-shell-comlink-transfer-handlers.js";
import { OAuthBasedOpalShell } from "@breadboard-ai/shared-ui/utils/oauth-based-opal-shell.js";
import {
  isOpalShellHandshakeRequest,
  type OpalShellHandshakeResponse,
} from "@breadboard-ai/types/opal-shell-protocol.js";
import * as comlink from "comlink";

const guestOrigin = CLIENT_DEPLOYMENT_CONFIG.SHELL_GUEST_ORIGIN;
if (guestOrigin && guestOrigin !== "*") {
  const iframe = document.querySelector("iframe#opal-app" as "iframe");
  const contentWindow = iframe?.contentWindow;
  if (contentWindow) {
    const handshake = Promise.withResolvers<void>();
    const abort = new AbortController();
    window.addEventListener(
      "message",
      (event) => {
        if (
          event.origin === guestOrigin &&
          isOpalShellHandshakeRequest(event.data)
        ) {
          abort.abort();
          handshake.resolve();
        }
      },
      { signal: abort.signal }
    );

    const { pathname, search, hash } = window.location;
    const url = new URL(pathname + search + hash, guestOrigin);
    // TODO(aomarks) Change this replace after we invert the root vs subpath
    // relationship between host and guest.
    url.pathname = url.pathname.replace(/^\/shell\/?/, "");
    iframe.src = url.href;

    await handshake.promise;
    console.log(
      "[shell host] Received and responding to handshake request from",
      guestOrigin
    );
    contentWindow.postMessage(
      {
        type: "opal-shell-handshake-response",
      } satisfies OpalShellHandshakeResponse,
      guestOrigin
    );
    console.log(`[shell host] Exposing API to`, guestOrigin);
    comlink.expose(
      new OAuthBasedOpalShell(),
      comlink.windowEndpoint(
        // Where this host sends messages.
        iframe.contentWindow,
        // Where this host receives messages from.
        window,
        // Constrain origins this host can send messages to, at the postMessage
        // layer. It would otherwise default to all origins.
        //
        // https://github.com/GoogleChromeLabs/comlink?tab=readme-ov-file#comlinkwrapendpoint-and-comlinkexposevalue-endpoint-allowedorigins
        // https://github.com/GoogleChromeLabs/comlink/blob/114a4a6448a855a613f1cb9a7c89290606c003cf/src/comlink.ts#L594C26-L594C38
        // https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage#targetorigin
        guestOrigin
      ),
      // Constrain origins this host can receive messages from, at the comlink
      // layer. It would otherwise default to all origins.
      //
      // https://github.com/GoogleChromeLabs/comlink?tab=readme-ov-file#comlinkwrapendpoint-and-comlinkexposevalue-endpoint-allowedorigins
      // https://github.com/GoogleChromeLabs/comlink/blob/114a4a6448a855a613f1cb9a7c89290606c003cf/src/comlink.ts#L310
      [guestOrigin]
    );
  } else {
    console.error(`could not find #opal-app iframe`);
  }
}
