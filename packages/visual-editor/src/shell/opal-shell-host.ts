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
import { Utils } from "../sca/utils.js";

declare global {
  interface Window {
    glueCookieNotificationBarLoaded?: (event: CustomEvent) => void;
    glue?: {
      CookieNotificationBar?: {
        instance?: {
          status: string;
          listen: (
            event: string,
            callback: (event: CustomEvent) => void
          ) => void;
        };
        status: {
          ACCEPTED: string;
          REJECTED: string;
          UNKNOWN: string;
        };
      };
    };
  }
}

// ---------------------------------------------------------------------------
// Cookie consent detection — must happen at module scope (synchronously) so
// we don't miss the glueCookieNotificationBarLoaded callback fired by the
// cookie bar script that loads before this module.
// ---------------------------------------------------------------------------

/** Resolves when cookie consent is granted (or when no cookie bar is present). */
const cookieConsentGranted = createCookieConsentPromise();

function createCookieConsentPromise(): Promise<void> {
  const cookieBar = window.glue?.CookieNotificationBar;

  // Helper: watch a cookie bar for ACCEPTED status.
  const watchForConsent = (
    cnb: NonNullable<typeof window.glue>["CookieNotificationBar"]
  ): Promise<void> => {
    if (!cnb?.instance) return Promise.resolve();
    const ACCEPTED = cnb.status.ACCEPTED;

    // Already accepted — resolve immediately.
    if (cnb.instance.status === ACCEPTED) {
      return Promise.resolve();
    }

    // Wait for a status change to ACCEPTED.
    return new Promise<void>((resolve) => {
      cnb.instance!.listen("statuschange", (event: CustomEvent) => {
        if (event.detail.status === ACCEPTED) {
          resolve();
        }
      });
    });
  };

  // Case 1: Cookie bar already has an instance.
  if (cookieBar?.instance) {
    return watchForConsent(cookieBar);
  }

  // Case 2: Cookie bar script is on the page but hasn't initialized yet.
  // Register the global loaded callback synchronously so we catch it.
  if (document.querySelector('script[src*="cookienotificationbar"]')) {
    return new Promise<void>((resolve) => {
      window.glueCookieNotificationBarLoaded = () => {
        const cnb = window.glue?.CookieNotificationBar;
        if (cnb) {
          watchForConsent(cnb).then(resolve);
        } else {
          resolve();
        }
      };
    });
  }

  // Case 3: No cookie bar present (e.g. local dev) — consent not required.
  return Promise.resolve();
}

// ---------------------------------------------------------------------------
// Shell initialization
// ---------------------------------------------------------------------------

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
  const label = "Shell Host";
  const shellPrefix = CLIENT_DEPLOYMENT_CONFIG.SHELL_PREFIX;
  const hostUrl = new URL(window.location.href);
  const pathname = shellPrefix
    ? hostUrl.pathname === shellPrefix ||
      hostUrl.pathname.startsWith(`${shellPrefix}/`)
      ? hostUrl.pathname.slice(shellPrefix.length)
      : hostUrl.pathname
    : hostUrl.pathname;
  const guestUrl = new URL(
    "_app" + pathname + hostUrl.search + hostUrl.hash,
    guestOrigin
  );
  guestUrl.searchParams.set(SHELL_ORIGIN_URL_PARAMETER, window.location.origin);
  iframe.src = guestUrl.href;

  let shellHost: OpalShellHostProtocol;
  if (CLIENT_DEPLOYMENT_CONFIG.FAKE_MODE) {
    const { FakeModeOpalShell } =
      await import("../../fake/fake-mode-opal-shell.js");
    shellHost = new FakeModeOpalShell();
  } else {
    const oauthShell = new OAuthBasedOpalShell();
    shellHost = oauthShell;

    // Enable analytics once cookie consent is granted. The consent promise
    // was set up at module scope so it's already listening.
    cookieConsentGranted.then(() => oauthShell.enableAnalytics());
  }

  const boxedState: {
    value?: {
      port: MessagePort;
      guest: comlink.Remote<OpalShellGuestProtocol>;
    };
  } = {};

  const logger = Utils.Logging.getLogger();

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
      logger.log(
        Utils.Logging.Formatter.info(
          "Received establish MessageChannel request from",
          event.origin
        ),
        label
      );

      if (boxedState.value) {
        logger.log(
          Utils.Logging.Formatter.info(
            "Discarding previous guest, iframe must have navigated"
          ),
          label
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

      logger.log(
        Utils.Logging.Formatter.info(
          "Sending establish MessageChannel response"
        ),
        label
      );
      const port = event.ports[0];
      port.postMessage({ type: SHELL_ESTABLISH_MESSAGE_CHANNEL_RESPONSE });

      // Initialize bi-directional comlink APIs
      logger.log(Utils.Logging.Formatter.info("Exposing host API"), label);
      comlink.expose(shellHost satisfies OpalShellHostProtocol, port);
      logger.log(
        Utils.Logging.Formatter.info("Connecting to guest API"),
        label
      );

      const guest = comlink.wrap<OpalShellGuestProtocol>(port);
      boxedState.value = { port, guest };
    }
  });
}
