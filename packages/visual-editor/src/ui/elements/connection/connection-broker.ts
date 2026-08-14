/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  OAUTH_POPUP_MESSAGE_TYPE,
  type OAuthPopupPayload,
} from "@breadboard-ai/types/oauth.js";
import { sendToAllowedEmbedderIfPresent } from "../../utils/embedder.js";
import { type OAuthStateParameter } from "./connection-common.js";

export class ConnectionBroker extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  async connectedCallback() {
    // **IMPORTANT**: If the window.opener is not available then it means
    // the popup was not opened during a legitimate sign in event, and we
    // should close the window immediately.
    if (!window.opener) {
      console.error(`window.opener is not available, closing early.`);
      window.close();
      return;
    }

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
    } catch {
      displayError('"state" contained invalid JSON.');
      return;
    }

    // Figure out where we are going to send the response.
    const nonce = state.nonce;
    if (!nonce) {
      displayError(
        'No "number used once" parameter could be found in "state".'
      );
      return;
    }

    function sendToOpener(msg: OAuthPopupPayload): void {
      window.opener.postMessage(
        { type: OAUTH_POPUP_MESSAGE_TYPE, ...msg },
        window.location.origin
      );
    }

    // Check for errors, most notably "access_denied" which will be set if the
    // user clicks "Cancel" during the OAuth flow.
    const error = thisUrl.searchParams.get("error");
    if (error) {
      sendToOpener({ nonce, error });
      window.close();
      return;
    }

    // Unpack the data needed to call the token grant API.
    const code = thisUrl.searchParams.get("code");
    if (!code) {
      displayError('No "code" parameter could be found in the URL.');
      return;
    }

    // Send the authorization code and nonce back to the originating tab so it can
    // verify the nonce before making the grant request.
    const scopes = thisUrl.searchParams.get("scope")?.trim().split(/ +/) ?? [];
    const authuser = thisUrl.searchParams.get("authuser") ?? undefined;
    const redirectPath = new URL(window.location.href).pathname;

    sendToOpener({ nonce, code, redirectPath, scopes, authuser });
    sendToAllowedEmbedderIfPresent({
      type: "oauth_redirect",
      success: true,
    });
    window.close();
  }
}

customElements.define("bb-connection-broker", ConnectionBroker);
