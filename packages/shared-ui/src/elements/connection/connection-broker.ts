/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  OAUTH_POPUP_MESSAGE_TYPE,
  type GrantResponse,
  type OAuthPopupMessage,
} from "@breadboard-ai/types/oauth.js";
import { getEmbedderRedirectUri } from "../../utils/embed-helpers.js";
import { sendToAllowedEmbedderIfPresent } from "../../utils/embedder.js";
import { type OAuthStateParameter } from "./connection-common.js";

export class ConnectionBroker extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  async connectedCallback() {
    const shadow = this.shadowRoot!;
    const displayError = (message: string) => {
      const p = document.createElement("p");
      p.textContent = `Error: ${message} Please close this window and try to sign in again.`;
      shadow.appendChild(p);
      sendToAllowedEmbedderIfPresent({
        type: "oauth_redirect",
        success: false,
      });
    };

    // Unpack the state parameter.
    const thisUrl = new URL(window.location.href);
    const stateStr = thisUrl.searchParams.get("state");
    if (!stateStr) {
      displayError('No "state" parameter could be found in the URL.');
      return;
    }
    let state: OAuthStateParameter;
    try {
      state = JSON.parse(stateStr);
    } catch (e) {
      displayError('"state" contained invalid JSON.');
      return;
    }

    // Figure out where we are going to send the response.
    const nonce = state.nonce;
    if (!nonce) {
      displayError('No "nonce" parameter could be found in "state".');
      return;
    }

    // Check for errors, most notably "access_denied" which will be set if the
    // user clicks "Cancel" during the OAuth flow.
    const error = thisUrl.searchParams.get("error");
    if (error) {
      window.opener.postMessage({
        type: OAUTH_POPUP_MESSAGE_TYPE,
        nonce,
        grantResponse: { error },
      } satisfies OAuthPopupMessage);
      window.close();
      return;
    }

    // Unpack the data needed to call the token grant API.
    const code = thisUrl.searchParams.get("code");
    if (!code) {
      displayError('No "code" parameter could be found in the URL.');
      return;
    }

    // If embedder has passed in a valid oauth redirect, use that instead.
    const redirect_uri =
      getEmbedderRedirectUri() ?? new URL(window.location.href).pathname;

    // Call the token grant API.
    if (!import.meta.env.VITE_CONNECTION_SERVER_URL) {
      displayError("Could not find a grant URL for this origin.");
      return;
    }
    // TODO(aomarks) Would it be better to send the code directly back to the
    // opener, so that it can check the nonce, and only then do this grant RPC
    // itself?
    const grantUrl = new URL("/connection/grant/", window.location.origin);
    grantUrl.searchParams.set("code", code);
    grantUrl.searchParams.set("redirect_path", redirect_uri);
    const response = await fetch(grantUrl, { credentials: "include" });
    let grantResponse: GrantResponse;
    try {
      grantResponse = await response.json();
    } catch {
      grantResponse = {
        error: "Invalid response from connection server",
      };
    }

    // Add the actual scopes the user selected.
    if (grantResponse.error === undefined) {
      grantResponse.scopes =
        thisUrl.searchParams.get("scope")?.trim().split(/ +/) ?? [];
    }

    // Send the grant response back to the originating tab and close up shop.
    window.opener.postMessage({
      type: OAUTH_POPUP_MESSAGE_TYPE,
      nonce,
      grantResponse: grantResponse,
    } satisfies OAuthPopupMessage);
    sendToAllowedEmbedderIfPresent({
      type: "oauth_redirect",
      success: true,
    });
    window.close();
  }
}

customElements.define("bb-connection-broker", ConnectionBroker);
