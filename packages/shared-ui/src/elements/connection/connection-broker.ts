/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EmbedHandler, Handler } from "@breadboard-ai/embed";
import {
  oauthTokenBroadcastChannelName,
  type OAuthStateParameter,
} from "./connection-common.js";
import type { GrantResponse } from "@breadboard-ai/types/oauth.js";
import { getEmbedderRedirectUri } from "../../utils/embed-helpers.js";

export class ConnectionBroker extends HTMLElement {
  #embedHandler?: EmbedHandler;

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.#embedHandler = window.self !== window.top ? new Handler() : undefined;
  }

  async connectedCallback() {
    const shadow = this.shadowRoot!;
    const displayError = (message: string) => {
      const p = document.createElement("p");
      p.textContent = `Error: ${message} Please close this window and try to sign in again.`;
      shadow.appendChild(p);
      this.#embedHandler?.sendToEmbedder({
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
    const channelName = oauthTokenBroadcastChannelName(nonce);
    const channel = new BroadcastChannel(channelName);

    // Unpack the data needed to call the token grant API.
    const connectionId = state.connectionId;
    if (!connectionId) {
      displayError('"connection_id" parameter could be found in "state".');
      return;
    }
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
    const absoluteConnectionServerUrl = new URL(
      import.meta.env.VITE_CONNECTION_SERVER_URL,
      window.location.href
    );
    const grantUrl = new URL("grant", absoluteConnectionServerUrl);
    grantUrl.searchParams.set("connection_id", connectionId);
    grantUrl.searchParams.set("code", code);
    grantUrl.searchParams.set("redirect_path", redirect_uri);
    const response = await fetch(grantUrl, { credentials: "include" });
    let grantResponse: GrantResponse;
    try {
      grantResponse = await response.json();
    } catch (e) {
      grantResponse = {
        error: "Invalid response from connection server",
      };
    }
    // Send the grant response back to the originating tab and close up shop.
    channel.postMessage(grantResponse);
    this.#embedHandler?.sendToEmbedder({
      type: "oauth_redirect",
      success: true,
    });
    channel.close();
    window.close();
  }
}

customElements.define("bb-connection-broker", ConnectionBroker);
