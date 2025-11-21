/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  EmbedderMessage,
  EmbedHandler,
} from "@breadboard-ai/types/embedder.js";
import {
  SHELL_ESTABLISH_MESSAGE_CHANNEL_REQUEST,
  SHELL_ESTABLISH_MESSAGE_CHANNEL_RESPONSE,
  SHELL_ORIGIN_URL_PARAMETER,
  type OpalShellGuestProtocol,
  type OpalShellHostProtocol,
} from "@breadboard-ai/types/opal-shell-protocol.js";
import { createContext } from "@lit/context";
import * as comlink from "comlink";
import { CLIENT_DEPLOYMENT_CONFIG } from "../config/client-deployment-configuration.js";
import { EmbedHandlerImpl } from "../embed/embed.js";
import { addMessageEventListenerToAllowedEmbedderIfPresent } from "./embedder.js";
import "./install-opal-shell-comlink-transfer-handlers.js";
import { OAuthBasedOpalShell } from "./oauth-based-opal-shell.js";
import "./url-pattern-conditional-polyfill.js";

export const opalShellContext = createContext<
  OpalShellHostProtocol | undefined
>("OpalShell");

const SHELL_ORIGIN_SESSION_STORAGE_KEY = "shellOrigin";

export async function connectToOpalShellHost(): Promise<{
  shellHost: OpalShellHostProtocol;
  embedHandler: EmbedHandler;
}> {
  const hostOrigin = await discoverShellHostOrigin();
  if (!hostOrigin) {
    // TODO(aomarks) Remove once we are fully migrated to the iframe
    // arrangement.
    console.log("[shell guest] Creating legacy host");
    const shellHost = new OAuthBasedOpalShell();
    const embedHandler = new EmbedHandlerImpl(shellHost);
    addMessageEventListenerToAllowedEmbedderIfPresent(
      (message: EmbedderMessage) =>
        embedHandler.dispatchEvent(new EmbedderMessageEventImpl(message))
    );
    return { shellHost, embedHandler };
  }

  // Establish MessageChannel
  const shellPort = await establishMessageChannelWithShellHost(hostOrigin);

  // Initialize bi-directional comlink APIs
  console.log("[shell guest] Connecting to host API");
  const shellHost = comlink.wrap<OpalShellHostProtocol>(shellPort);
  beginSyncronizingUrls(shellHost);
  console.log("[shell guest] Exposing guest API");
  const embedHandler = new EmbedHandlerImpl(shellHost);
  comlink.expose(
    new OpalShellGuest(embedHandler) satisfies OpalShellGuestProtocol,
    shellPort
  );

  return { shellHost, embedHandler };
}

/**
 * Establish a MessageChannel connection between the shell host and client.
 *
 * Background: Comlink supports using window postMessage directly, however we
 * found that password management extensions including 1Password and Bitwarden
 * break the ability to exchange _certain_ objects as tranferables (HTTP
 * responses break, but MessageChannel ports do not). The best theory we have is
 * that these extensions register their own window message event handlers, which
 * cause transferable objects to be transfered into the extension's "isolated
 * world", instead of our normal context, making them inaccessible to us.
 */
async function establishMessageChannelWithShellHost(
  hostOrigin: string
): Promise<MessagePort> {
  const { port1, port2 } = new MessageChannel();
  console.log(
    "[shell guest] Sending establish MessageChannel request to",
    hostOrigin
  );
  window.parent.postMessage(
    { type: SHELL_ESTABLISH_MESSAGE_CHANNEL_REQUEST },
    hostOrigin,
    [port2]
  );
  const responseReceived = Promise.withResolvers<void>();
  const listenerAbortCtl = new AbortController();
  port1.start();
  port1.addEventListener(
    "message",
    (event) => {
      if (
        event.isTrusted &&
        typeof event.data === "object" &&
        event.data !== null &&
        event.data.type === SHELL_ESTABLISH_MESSAGE_CHANNEL_RESPONSE
      ) {
        console.log("[shell guest] Received establish MessageChannel response");
        responseReceived.resolve();
        listenerAbortCtl.abort();
      }
    },
    { signal: listenerAbortCtl.signal }
  );
  await responseReceived.promise;
  return port1;
}

class OpalShellGuest implements OpalShellGuestProtocol {
  readonly #embedHandler: EmbedHandler;
  constructor(embedHandler: EmbedHandler) {
    this.#embedHandler = embedHandler;
  }
  receiveFromEmbedder = async (message: EmbedderMessage): Promise<void> => {
    this.#embedHandler.dispatchEvent(new EmbedderMessageEventImpl(message));
  };
}

class EmbedderMessageEventImpl<T extends EmbedderMessage> extends Event {
  readonly message: T;
  constructor(message: T) {
    super(message.type);
    this.message = message;
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

function beginSyncronizingUrls(host: OpalShellHostProtocol) {
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
