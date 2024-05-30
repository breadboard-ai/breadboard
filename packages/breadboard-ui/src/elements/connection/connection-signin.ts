/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { Connection } from "./connection-server.js";

/**
 * Widget for signing in and out of a connection to a third party app/service.
 */
@customElement("bb-connection-signin")
export class ConnectionSignin extends LitElement {
  @property({ attribute: false })
  connection?: Connection;

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
    .signin {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 19px;
      font-size: 13px;
      text-decoration: none;
      border-radius: 9px;
      padding: 1px 8px;
      margin-left: 12px;
    }
    .signin {
      background: var(--bb-ui-100);
      color: var(--bb-ui-700);
    }
    .signin:hover {
      background: var(--bb-ui-200);
      color: var(--bb-ui-800);
    }
  `;

  render() {
    if (!this.connection) {
      return "";
    }
    return html`${this.connection.icon
        ? html`<img
            class="icon"
            width="20px"
            height="20px"
            src=${this.connection.icon}
          />`
        : html`<span class="icon missing"></span>`}
      <div>
        <h3 class="title">${this.connection.title}</h3>
        <p class="description">${this.connection.description}</p>
      </div>
      <a
        class="signin"
        .href=${this.connection.authUrl}
        .title="Sign in to ${this.connection.title}"
        target="_blank"
        >Sign in</a
      >`;
  }
}
