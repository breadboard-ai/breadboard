/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { CLIENT_DEPLOYMENT_CONFIG } from "../ui/config/client-deployment-configuration.js";
import { addMessageEventListenerToAllowedEmbedderIfPresent } from "../ui/utils/embedder.js";
import "../ui/utils/install-opal-shell-comlink-transfer-handlers.js";
import { OAuthBasedOpalShell } from "../ui/utils/oauth-based-opal-shell.js";
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
  const pathname = CLIENT_DEPLOYMENT_CONFIG.SHELL_PREFIX
    ? hostUrl.pathname.startsWith(`${CLIENT_DEPLOYMENT_CONFIG.SHELL_PREFIX}/`)
      ? hostUrl.pathname.slice(CLIENT_DEPLOYMENT_CONFIG.SHELL_PREFIX.length)
      : hostUrl.pathname
    : hostUrl.pathname;
  const guestUrl = new URL(
    "_app" + pathname + hostUrl.search + hostUrl.hash,
    guestOrigin
  );
  guestUrl.searchParams.set(SHELL_ORIGIN_URL_PARAMETER, window.location.origin);
  iframe.src = guestUrl.href;

  const shellHost = new OAuthBasedOpalShell();

  const boxedState: {
    value?: {
      port: MessagePort;
      guest: comlink.Remote<OpalShellGuestProtocol>;
    };
  } = {};

  // Establish MessageChannel.
  window.addEventListener("message", (event) => {
    if (
      event.isTrusted &&
      event.source === iframe.contentWindow &&
      event.origin === guestOrigin &&
      typeof event.data === "object" &&
      event.data !== null &&
      event.data.type === SHELL_ESTABLISH_MESSAGE_CHANNEL_REQUEST
    ) {
      console.log(
        "[shell host] Received establish MessageChannel request from",
        event.origin
      );

      if (boxedState.value) {
        console.log(
          "[shell host] Discarding previous guest, iframe must have navigated"
        );
        boxedState.value.guest[comlink.releaseProxy]();
        boxedState.value.port.close();
      } else {
        // Start relaying embedder (i.e. AIFlow) messages to guest
        addMessageEventListenerToAllowedEmbedderIfPresent(
          (message: EmbedderMessage) =>
            // Note we box the guest so that this callback doesn't need to be
            // re-attached when the guest is replaced due to navigation.
            boxedState.value?.guest.receiveFromEmbedder(message)
        );
      }

      console.log("[shell host] Sending establish MessageChannel response");
      const port = event.ports[0];
      port.postMessage({ type: SHELL_ESTABLISH_MESSAGE_CHANNEL_RESPONSE });

      // Initialize bi-directional comlink APIs
      console.log("[shell host] Exposing host API");
      comlink.expose(shellHost satisfies OpalShellHostProtocol, port);
      console.log("[shell host] Connecting to guest API");
      const guest = comlink.wrap<OpalShellGuestProtocol>(port);
      boxedState.value = { port, guest };
    }
  });
}
