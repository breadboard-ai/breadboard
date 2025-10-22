/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { CLIENT_DEPLOYMENT_CONFIG } from "@breadboard-ai/shared-ui/config/client-deployment-configuration.js";
import { OAuthBasedOpalShell } from "@breadboard-ai/shared-ui/utils/oauth-based-opal-shell.js";
import * as comlink from "comlink";

import "@breadboard-ai/shared-ui/utils/install-opal-shell-comlink-transfer-handlers.js";

const guestOrigin = CLIENT_DEPLOYMENT_CONFIG.SHELL_GUEST_ORIGIN;
if (guestOrigin && guestOrigin !== "*") {
  const iframe = document.querySelector("iframe#opal-app" as "iframe");
  if (iframe?.contentWindow) {
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
