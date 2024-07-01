/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { consume } from "@lit/context";
import { LitElement, css, html, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import {
  environmentContext,
  type Environment,
} from "../../contexts/environment.js";
import { settingsHelperContext } from "../../contexts/settings-helper.js";
import { SETTINGS_TYPE, type SettingsHelper } from "../../types/types.js";
import {
  oauthTokenBroadcastChannelName,
  type GrantResponse,
  type GrantSettingsValue,
  type OAuthStateParameter,
} from "./connection-common.js";
import type { Connection } from "./connection-server.js";

/**
 * Widget for signing in and out of a connection to a third party app/service.
 */
@customElement("bb-connection-signin")
export class ConnectionSignin extends LitElement {
  @property({ attribute: false })
  connection?: Connection;

  @consume({ context: environmentContext })
  environment?: Environment;

  @consume({ context: settingsHelperContext })
  settingsHelper?: SettingsHelper;

  @state()
  private _nonce = crypto.randomUUID();

  @state()
  private _state: "signedout" | "pending" | "signedin" = "signedout";

  static styles = css`
    :host {
      display: grid;
      grid-template-columns: max-content 1fr max-content;
      column-gap: 10px;
    }

    .icon {
      width: 20px;
      height: 20px;
    }
    .icon.missing {
      background: var(--bb-icon-lan) center center / 20px 20px no-repeat;
    }

    .title {
      font-size: var(--bb-body-medium);
      font-weight: normal;
      margin: 0;
    }
    .description {
      font-size: var(--bb-body-x-small);
      line-height: var(--bb-body-line-height-x-small);
      margin: 0;
    }

    .signin,
    .pending,
    .signout {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 19px;
      font-size: 13px;
      border-radius: 9px;
      padding: 1px 8px;
    }

    .signin {
      background: var(--bb-ui-100);
      color: var(--bb-ui-700);
      text-decoration: none;
    }
    .signin:hover {
      background: var(--bb-ui-200);
      color: var(--bb-ui-800);
    }

    .pending {
      background: var(--bb-ui-100);
      color: var(--bb-ui-700);
      opacity: 50%;
      pointer-events: none;
    }

    .signout {
      background: var(--bb-neutral-200);
      color: var(--bb-neutral-600);
      cursor: pointer;
      border: none;
      height: 21px;
    }
    .signout:hover {
      background: var(--bb-neutral-300);
      color: var(--bb-neutral-700);
    }
  `;

  override updated(changes: PropertyValues<this>) {
    if (
      (changes.has("connection") || changes.has("settingsHelper")) &&
      this.connection &&
      this.settingsHelper &&
      this._state !== "pending"
    ) {
      const setting = this.settingsHelper.get(
        SETTINGS_TYPE.CONNECTIONS,
        this.connection.id
      );
      this._state = setting === undefined ? "signedout" : "signedin";
    }
  }

  override render() {
    if (!this.connection) {
      return "";
    }

    const icon = this.connection.icon
      ? html`<img
          class="icon"
          width="20px"
          height="20px"
          src=${this.connection.icon}
        />`
      : html`<span class="icon missing"></span>`;

    const metadata = html`<div>
      <h3 class="title">${this.connection.title}</h3>
      <p class="description">${this.connection.description}</p>
    </div>`;

    return html`${icon} ${metadata} ${this.#renderButton()}`;
  }

  #renderButton() {
    if (!this.connection || !this.settingsHelper) {
      return "";
    }

    switch (this._state) {
      case "signedout": {
        return html`<a
          class="signin"
          .href=${this.#updatedAuthUrl()}
          .title="Sign in to ${this.connection.title}"
          target="_blank"
          @click=${this.#onClickSignin}
          >Sign in</a
        >`;
      }
      case "pending": {
        return html`<span
          class="signin pending"
          .title="Sign in to ${this.connection.title}"
          @click=${this.#onClickSignin}
          >Sign in</span
        >`;
      }
      case "signedin": {
        return html`<button
          class="signout"
          .title="Sign out of ${this.connection.title}"
          @click=${this.#onClickSignout}
        >
          Sign out
        </button>`;
      }
    }
    this._state satisfies never;
  }

  #updatedAuthUrl(): string {
    if (!this.connection) {
      return "";
    }
    let redirectUri = this.environment?.connectionRedirectUrl;
    if (!redirectUri) {
      return "";
    }
    // Resolve it since environment.connectionRedirectUrl is likely relative
    // (but resolve it using the origin, not the full current url, because it's
    // a global setting).
    redirectUri = new URL(redirectUri, new URL(window.location.href).origin)
      .href;
    const authUrl = new URL(this.connection.authUrl);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set(
      "state",
      JSON.stringify({
        connectionId: this.connection.id,
        nonce: this._nonce,
      } satisfies OAuthStateParameter)
    );
    return authUrl.href;
  }

  async #onClickSignin() {
    const now = Date.now();
    if (!this.connection || !this.settingsHelper) {
      return;
    }
    this._state = "pending";
    const nonce = this._nonce;
    // Reset the nonce in case the user signs out and signs back in again, since
    // we don't want to ever mix up different requests.
    setTimeout(
      // TODO(aomarks) This shouldn't be necessary, what's up?
      () => (this._nonce = crypto.randomUUID()),
      500
    );
    // The OAuth broker page will know to broadcast the token on this unique
    // channel because it also knows the nonce (since we pack that in the OAuth
    // "state" parameter).
    const channelName = oauthTokenBroadcastChannelName(nonce);
    const channel = new BroadcastChannel(channelName);
    const grantResponse = await new Promise<GrantResponse>((resolve) => {
      channel.addEventListener("message", (m) => resolve(m.data), {
        once: true,
      });
    });
    channel.close();
    if (grantResponse.error !== undefined) {
      // TODO(aomarks) Show error info in the UI.
      console.error(grantResponse.error);
      this._state = "signedout";
      return;
    }
    const settingsValue: GrantSettingsValue = {
      access_token: grantResponse.access_token,
      expires_in: grantResponse.expires_in,
      refresh_token: grantResponse.refresh_token,
      issue_time: now,
    };
    this.settingsHelper.set(SETTINGS_TYPE.CONNECTIONS, this.connection.id, {
      name: this.connection.id,
      value: JSON.stringify(settingsValue),
    });
    this.dispatchEvent(new TokenGrantedEvent(grantResponse.access_token));
    this._state = "signedin";
  }

  #onClickSignout() {
    if (!this.settingsHelper || !this.connection) {
      return;
    }
    this.settingsHelper.delete(SETTINGS_TYPE.CONNECTIONS, this.connection.id);
    this._state = "signedout";
  }
}

class TokenGrantedEvent extends Event {
  static eventName = "bbtokengranted" as const;
  readonly token: string;
  constructor(token: string) {
    super(TokenGrantedEvent.eventName);
    this.token = token;
  }
}

declare global {
  interface HTMLElementEventMap {
    [TokenGrantedEvent.eventName]: TokenGrantedEvent;
  }
}
