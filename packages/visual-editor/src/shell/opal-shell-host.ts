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
    glueCookieNotificationBarLoaded?: () => void;
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
// Cookie bar setup — must happen at module scope (synchronously) so we don't
// miss the glueCookieNotificationBarLoaded callback fired by the cookie bar
// script that loads before this module.
//
// Returns three promises:
//   consentGranted  — resolves when the user accepts cookies (or no bar).
//   required        — resolves with whether the "Manage cookies" control
//                     should be shown for the user's region.
//   isConsentRegion — resolves with whether the cookie bar is required at
//                     all (EEA, UK, etc.), including regions where the
//                     "Manage cookies" control is hidden.
// ---------------------------------------------------------------------------

type CookieBar = NonNullable<typeof window.glue>["CookieNotificationBar"];

const {
  consentGranted: cookieConsentGranted,
  required: cookieBarRequired,
  isConsentRegion: cookieConsentRegion,
} = setupCookieBar();

function setupCookieBar(): {
  consentGranted: Promise<void>;
  required: Promise<boolean>;
  isConsentRegion: Promise<boolean>;
} {
  const cookieBar = window.glue?.CookieNotificationBar;

  // Helper: watch a cookie bar instance for ACCEPTED status.
  const watchForConsent = (cnb: CookieBar): Promise<void> => {
    if (!cnb?.instance) return Promise.resolve();
    const ACCEPTED = cnb.status.ACCEPTED;

    // Already accepted (loaded event already fired for a returning user).
    if (cnb.instance.status === ACCEPTED) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      // Returning user: the loaded event carries the stored consent status.
      cnb.instance!.listen("loaded", (event: CustomEvent) => {
        if (event.detail.status === ACCEPTED) {
          resolve();
        }
      });
      // New consent: the statuschange event fires when the user interacts.
      cnb.instance!.listen("statuschange", (event: CustomEvent) => {
        if (event.detail.status === ACCEPTED) {
          resolve();
        }
      });
    });
  };

  // Helper: determine whether the "Manage cookies" control should be shown.
  // Two mechanisms run in parallel to handle a timing race: the cookie bar
  // script (regular <script>) executes before our module (deferred), so the
  // loaded event may have already fired by the time we listen.
  const shouldShowControl = (cnb: CookieBar): Promise<boolean> => {
    if (!cnb?.instance) return Promise.resolve(false);

    return new Promise<boolean>((resolve) => {
      let settled = false;
      const settle = (v: boolean) => {
        if (!settled) {
          settled = true;
          resolve(v);
        }
      };

      // Primary: catch the loaded event if it hasn't fired yet.
      cnb.instance!.listen("loaded", (event: CustomEvent) => {
        settle(event.detail.required === true && event.detail.eea !== true);
      });

      // Fallback: if loaded already fired, the library will have already
      // processed the control button. Check after a frame to see if
      // aria-hidden was removed (the library's signal that the control
      // should be visible).
      requestAnimationFrame(() => {
        if (settled) return;
        const control = document.querySelector(
          ".glue-cookie-notification-bar-control"
        );
        if (control && !control.hasAttribute("aria-hidden")) {
          settle(true);
        }
        // If aria-hidden is still present, don't settle — the loaded event
        // will fire and settle via the listener, or the bar isn't required
        // and not showing the button is the correct default.
      });
    });
  };

  // Helper: determine whether cookie consent is required for this region
  // (EEA, UK, etc.). Unlike shouldShowControl, this includes EEA countries
  // where the cookie bar is shown but the "Manage cookies" button is hidden.
  const checkConsentRegion = (cnb: CookieBar): Promise<boolean> => {
    if (!cnb?.instance) return Promise.resolve(false);

    return new Promise<boolean>((resolve) => {
      let settled = false;
      const settle = (v: boolean) => {
        if (!settled) {
          settled = true;
          resolve(v);
        }
      };

      cnb.instance!.listen("loaded", (event: CustomEvent) => {
        settle(event.detail.required === true);
      });

      // Fallback: if loaded already fired, check whether the bar element
      // exists and is visible (the library renders it for consent regions).
      requestAnimationFrame(() => {
        if (settled) return;
        const bar = document.querySelector(".glue-cookie-notification-bar");
        if (bar && !bar.hasAttribute("aria-hidden")) {
          settle(true);
        }
      });
    });
  };

  // Case 1: Cookie bar already has an instance (script loaded before us).
  if (cookieBar?.instance) {
    return {
      consentGranted: watchForConsent(cookieBar),
      required: shouldShowControl(cookieBar),
      isConsentRegion: checkConsentRegion(cookieBar),
    };
  }

  // Case 2: Cookie bar script is on the page but hasn't initialized yet.
  // Register the global callback synchronously so we catch it.
  if (document.querySelector('script[src*="cookienotificationbar"]')) {
    let resolveConsent!: () => void;
    let resolveRequired!: (value: boolean) => void;
    let resolveConsentRegion!: (value: boolean) => void;

    const consentGranted = new Promise<void>((r) => {
      resolveConsent = r;
    });
    const required = new Promise<boolean>((r) => {
      resolveRequired = r;
    });
    const isConsentRegion = new Promise<boolean>((r) => {
      resolveConsentRegion = r;
    });

    window.glueCookieNotificationBarLoaded = () => {
      const cnb = window.glue?.CookieNotificationBar;
      if (cnb) {
        watchForConsent(cnb).then(resolveConsent);
        shouldShowControl(cnb).then(resolveRequired);
        checkConsentRegion(cnb).then(resolveConsentRegion);
      } else {
        resolveConsent();
        resolveRequired(false);
        resolveConsentRegion(false);
      }
    };

    return { consentGranted, required, isConsentRegion };
  }

  // Case 3: No cookie bar present (e.g. local dev) — consent not required.
  return {
    consentGranted: Promise.resolve(),
    required: Promise.resolve(false),
    isConsentRegion: Promise.resolve(false),
  };
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

    // Tell the shell whether cookie settings management is needed for this region.
    oauthShell.cookieSettingsRequired = cookieBarRequired;
    oauthShell.cookieConsentRequired = cookieConsentRegion;
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
