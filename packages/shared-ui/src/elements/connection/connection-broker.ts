/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GrantResponse,
  oauthTokenBroadcastChannelName,
  type OAuthStateParameter,
} from "./connection-common.js";

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
    grantUrl.searchParams.set(
      "redirect_path",
      new URL(window.location.href).pathname
    );
    const response = await fetch(grantUrl, { credentials: "include" });
    if (!response.ok) {
      displayError("Connection service returned unexpected HTTP status.");
      return;
    }
    let grantResponse: GrantResponse;
    try {
      grantResponse = await response.json();
    } catch (e) {
      displayError("Could not read JSON response from backend.");
      return;
    }

    // Send the grant response back to the originating tab and close up shop.
    channel.postMessage(grantResponse);
    channel.close();
    window.close();
  }
}

customElements.define("bb-connection-broker", ConnectionBroker);
