/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { CLIENT_DEPLOYMENT_CONFIG } from "@breadboard-ai/shared-ui/config/client-deployment-configuration.js";
import { addMessageEventListenerToAllowedEmbedderIfPresent } from "@breadboard-ai/shared-ui/utils/embedder.js";
import "@breadboard-ai/shared-ui/utils/install-opal-shell-comlink-transfer-handlers.js";
import { OAuthBasedOpalShell } from "@breadboard-ai/shared-ui/utils/oauth-based-opal-shell.js";
import type { EmbedderMessage } from "@breadboard-ai/types/embedder.js";
import {
  type OpalShellGuestProtocol,
  type OpalShellHostProtocol,
  SHELL_ESTABLISH_MESSAGE_CHANNEL_REQUEST,
  SHELL_ESTABLISH_MESSAGE_CHANNEL_RESPONSE,
  SHELL_ORIGIN_URL_PARAMETER,
} from "@breadboard-ai/types/opal-shell-protocol.js";
import * as comlink from "comlink";

initializeOpalShellGuest();

async function initializeOpalShellGuest() {
  const guestOrigin = CLIENT_DEPLOYMENT_CONFIG.SHELL_GUEST_ORIGIN;
  if (!guestOrigin || guestOrigin === "*") {
    return;
  }

  // Initialize iframe
  const iframe = document.querySelector("iframe#opal-app" as "iframe");
  if (!iframe?.contentWindow) {
    console.error(`Could not find #opal-app iframe`);
    return;
  }
  const hostUrl = new URL(window.location.href);
  const guestUrl = new URL(
    "_app" + hostUrl.pathname + hostUrl.search + hostUrl.hash,
    guestOrigin
  );
  guestUrl.searchParams.set(SHELL_ORIGIN_URL_PARAMETER, window.location.origin);
  iframe.src = guestUrl.href;

  // Establish MessageChannel
  const guestPort = await establishMessageChannelWithShellGuest(
    guestOrigin,
    iframe.contentWindow
  );

  // Initialize bi-directional comlink APIs
  console.log("[shell host] Exposing host API");
  comlink.expose(
    new OAuthBasedOpalShell() satisfies OpalShellHostProtocol,
    guestPort
  );
  console.log("[shell host] Connecting to guest API");
  const guest = comlink.wrap<OpalShellGuestProtocol>(guestPort);

  // Prevent garbage collection of the comlink proxy by shoving it onto the
  // window. If we don't do this, the proxy will get garbage collected,
  // triggering some FinalizationRegistry logic in comlink which will close the
  // port, severing the link bi-directionally.
  (window as typeof window & Record<symbol, unknown>)[Symbol()] = guest;

  // Start relaying embedder (i.e. AIFlow) messages to guest
  addMessageEventListenerToAllowedEmbedderIfPresent(
    (message: EmbedderMessage) => guest.receiveFromEmbedder(message)
  );
}

/**
 * See `establishMessageChannelWithShellHost` in `opal-shell-guest.ts` for
 * explanation.
 */
async function establishMessageChannelWithShellGuest(
  guestOrigin: string,
  iframeContentWindow: Window
): Promise<MessagePort> {
  const requestReceived = Promise.withResolvers<MessagePort>();
  const listenerAbortCtl = new AbortController();
  window.addEventListener(
    "message",
    (event) => {
      if (
        event.isTrusted &&
        event.source === iframeContentWindow &&
        event.origin === guestOrigin &&
        typeof event.data === "object" &&
        event.data !== null &&
        event.data.type === SHELL_ESTABLISH_MESSAGE_CHANNEL_REQUEST
      ) {
        console.log(
          "[shell host] Received establish MessageChannel request from",
          event.origin
        );
        requestReceived.resolve(event.ports[0]);
        listenerAbortCtl.abort();
      }
    },
    { signal: listenerAbortCtl.signal }
  );
  const guestPort = await requestReceived.promise;
  console.log("[shell host] Sending establish MessageChannel response");
  guestPort.postMessage({ type: SHELL_ESTABLISH_MESSAGE_CHANNEL_RESPONSE });
  return guestPort;
}
