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

    // Unpack the state parameter.
    const thisUrl = new URL(window.location.href);
    const stateStr = thisUrl.searchParams.get("state");
    if (!stateStr) {
      shadow.innerHTML = `
        <p>Error: No "state" parameter could be found in the URL.
        Please close this window and try to sign in again.</p>
      `;
      return;
    }
    let state: OAuthStateParameter;
    try {
      state = JSON.parse(stateStr);
    } catch (e) {
      shadow.innerHTML = `
        <p>Error: "state" contained invalid JSON.
        Please close this window and try to sign in again.</p>
      `;
      console.error(e);
      return;
    }

    // Figure out where we are going to send the response.
    const nonce = state.nonce;
    if (!nonce) {
      shadow.innerHTML = `
        <p>Error: No "nonce" parameter could be found in "state".
        Please close this window and try to sign in again.</p>
      `;
      return;
    }
    const channelName = oauthTokenBroadcastChannelName(nonce);
    const channel = new BroadcastChannel(channelName);

    // Unpack the data needed to call the token grant API.
    const connectionId = state.connectionId;
    if (!connectionId) {
      shadow.innerHTML = `
        <p>Error: No "connection_id" parameter could be found in "state".
        Please close this window and try to sign in again.</p>
      `;
      return;
    }
    const code = thisUrl.searchParams.get("code");
    if (!code) {
      shadow.innerHTML = `
        <p>Error: No "code" parameter could be found in the URL.
        Please close this window and try to sign in again.</p>
      `;
      return;
    }

    // Call the token grant API.
    if (!import.meta.env.VITE_CONNECTION_SERVER_URL) {
      shadow.innerHTML = `<p>Error: Could not find a grant URL for this origin.</p>`;
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
      const text = await response.text().catch((e) => `Text read error: ${e}`);
      shadow.innerHTML = `
<p>Error: Connection service returned HTTP ${response.status}.</p>
<pre>${text}</pre>`;
      return;
    }
    let grantResponse: GrantResponse;
    try {
      grantResponse = await response.json();
    } catch (e) {
      shadow.innerHTML =
        "<p>Error: Could not read JSON response from backend.</p>";
      console.error(e);
      return;
    }

    // Send the grant response back to the originating tab and close up shop.
    channel.postMessage(grantResponse);
    channel.close();
    window.close();
  }
}

customElements.define("bb-connection-broker", ConnectionBroker);
