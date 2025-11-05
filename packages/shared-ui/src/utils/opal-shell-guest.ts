/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  SHELL_ORIGIN_URL_PARAMETER,
  type OpalShellProtocol,
} from "@breadboard-ai/types/opal-shell-protocol.js";
import { createContext } from "@lit/context";
import * as comlink from "comlink";
import { CLIENT_DEPLOYMENT_CONFIG } from "../config/client-deployment-configuration.js";
import "./install-opal-shell-comlink-transfer-handlers.js";
import { OAuthBasedOpalShell } from "./oauth-based-opal-shell.js";
import "./url-pattern-conditional-polyfill.js";
import { addMessageEventListenerToAllowedEmbedderIfPresent } from "./embedder.js";
import type { EmbedderMessage } from "@breadboard-ai/types/embedder.js";

export const opalShellContext = createContext<OpalShellProtocol | undefined>(
  "OpalShell"
);

const SHELL_ORIGIN_SESSION_STORAGE_KEY = "shellOrigin";

export async function connectToOpalShellHost(): Promise<OpalShellProtocol> {
  const hostOrigin = await discoverShellHostOrigin();
  if (hostOrigin) {
    console.log("[shell guest] Connecting to iframe host", hostOrigin);
    const hostEndpoint = comlink.windowEndpoint(
      // Where this guest sends messages.
      window.parent,
      // Where this guest receives messages from.
      window,
      // Constrain origins this guest can send messages to, at the postMessage
      // layer. It would otherwise default to all origins.
      //
      // https://github.com/GoogleChromeLabs/comlink?tab=readme-ov-file#comlinkwrapendpoint-and-comlinkexposevalue-endpoint-allowedorigins
      // https://github.com/GoogleChromeLabs/comlink/blob/114a4a6448a855a613f1cb9a7c89290606c003cf/src/comlink.ts#L594C26-L594C38
      // https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage#targetorigin
      hostOrigin
    );
    const host = comlink.wrap<OpalShellProtocol>(hostEndpoint);
    beginSyncronizingUrls(host);
    return host;
  } else {
    // TODO(aomarks) Remove once we are fully migrated to the iframe
    // arrangement.
    console.log("[shell guest] Connecting to legacy host");
    addMessageEventListenerToAllowedEmbedderIfPresent(
      (message: EmbedderMessage) => {
        console.log(`[shell guest] TODO message from embedder`, message);
      }
    );
    return new OAuthBasedOpalShell();
  }
}

async function discoverShellHostOrigin(): Promise<string | undefined> {
  const allowedOriginPatterns = CLIENT_DEPLOYMENT_CONFIG.SHELL_HOST_ORIGINS;
  if (
    !allowedOriginPatterns?.length ||
    /* not iframed */ window === window.parent
  ) {
    return;
  }

  // We need to discover the origin of the shell window which is iframing us, so
  // that we can verify it against our allowlist and use it to secure our
  // postMessage channel.
  //
  // To accomplish this, the shell simply passes its origin to this iframe via a
  // URL parameter. However if there is a subsequent navigation within the
  // iframe, then this URL parameter might get dropped, and we don't want the
  // burden of maintaining that URL parameter for all possible navigations
  // within the app. So we instead also persist any verified origin to session
  // storage, and use that as a fallback.
  //
  // Alternatives considered:
  //
  // - window.parent.origin is not readable cross-origin.
  //
  // - document.referrer works somewhat, but because it can change to a
  //   different origin when a subsequent navigation occurs within the iframe,
  //   we can only trust it on the very first load of an iframe. We _could_ use
  //   session storage in a similar way to above to effectively identify this
  //   first load, _except_ that because session storage is tied to the lifetime
  //   of the top-level browser tab/window instead of the iframe instance, then
  //   it would not be resilient against the following scenario:
  //
  //   1. User loads shell1.example, which is iframing app.example.
  //   2. In the same browser tab, user loads shell2.example, which is also
  //      iframing app.example.

  const thisUrl = new URL(window.location.href);
  const passedInShellOrigin = thisUrl.searchParams.get(
    SHELL_ORIGIN_URL_PARAMETER
  );
  if (passedInShellOrigin) {
    // Remove the parameter because it is only needed for this very early
    // initialization and may otherwise find its way back to the displayed shell
    // URL.
    thisUrl.searchParams.delete(SHELL_ORIGIN_URL_PARAMETER);
    history.replaceState(history.state, "", thisUrl);
  }
  const shellOrigin =
    passedInShellOrigin ||
    sessionStorage.getItem(SHELL_ORIGIN_SESSION_STORAGE_KEY);
  if (!shellOrigin) {
    console.error(
      `[shell guest] Could not find shell origin because shell did not set ` +
        `the ${JSON.stringify(SHELL_ORIGIN_URL_PARAMETER)} URL parameter.`
    );
    return;
  }

  for (const pattern of allowedOriginPatterns) {
    if (new URLPattern(pattern).test(shellOrigin)) {
      console.debug(
        `[shell guest] ${shellOrigin} matched allowed origin ${pattern}`
      );
      if (passedInShellOrigin) {
        sessionStorage.setItem(
          SHELL_ORIGIN_SESSION_STORAGE_KEY,
          passedInShellOrigin
        );
      }
      return shellOrigin;
    }
  }
  console.error("[shell guest] Shell origin was not in allowlist", shellOrigin);
}

function beginSyncronizingUrls(host: OpalShellProtocol) {
  const setUrl = () => {
    const url = new URL(window.location.href);
    url.pathname = url.pathname.replace(/^\/_app/, "");
    host.setUrl(url.href);
  };

  for (const name of [
    "pushState",
    "replaceState",
    "back",
    "forward",
    "go",
  ] satisfies Array<keyof typeof history>) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    const original: Function = history[name].bind(history);
    history[name] = (...args: unknown[]) => {
      const result = original(...args);
      setUrl();
      return result;
    };
  }

  window.addEventListener("popstate", setUrl);

  setUrl();
}
