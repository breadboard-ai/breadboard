/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { OpalShellProtocol } from "@breadboard-ai/types/opal-shell-protocol.js";
import { createContext } from "@lit/context";
import * as comlink from "comlink";
import { CLIENT_DEPLOYMENT_CONFIG } from "../config/client-deployment-configuration.js";
import { OAuthBasedOpalShell } from "./oauth-based-opal-shell.js";
import "./url-pattern-conditional-polyfill.js";

export const opalShellContext = createContext<OpalShellProtocol | undefined>(
  "OpalShell"
);

export async function connectToOpalShellHost(): Promise<OpalShellProtocol> {
  const hostOrigin = await discoverShellHostOrigin();
  if (hostOrigin) {
    console.log("[shell guest] Connecting to iframe host", hostOrigin);
    const host = comlink.wrap<OpalShellProtocol>(
      comlink.windowEndpoint(
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
      )
    );
    beginSyncronizingUrls(host);
    return host;
  } else {
    // TODO(aomarks) Remove once we are fully migrated to the iframe
    // arrangement.
    console.log("[shell guest] Connecting to legacy host");
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
  if (!document.referrer) {
    console.error("[shell guest] document.referrer was empty");
    return;
  }
  const referrerOrigin = new URL(document.referrer).origin;
  for (const pattern of allowedOriginPatterns) {
    if (
      pattern.includes("*")
        ? new URLPattern(pattern).test(referrerOrigin)
        : referrerOrigin === pattern
    ) {
      console.debug(
        `[shell guest] Referrer ${document.referrer} ` +
          `matched allowed origin ${pattern}`
      );
      return referrerOrigin;
    }
  }
  console.error(
    "[shell guest] Referrer origin was not in allowlist",
    referrerOrigin
  );
}

function beginSyncronizingUrls(host: OpalShellProtocol) {
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
      host.setUrl(window.location.href);
      return result;
    };
  }

  window.addEventListener("popstate", () => {
    host.setUrl(window.location.href);
  });

  host.setUrl(window.location.href);
}
