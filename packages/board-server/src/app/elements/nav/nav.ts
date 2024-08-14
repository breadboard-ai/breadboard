/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { DismissMenuEvent, ShareEvent } from "../../events/events.js";

@customElement("bb-app-nav")
export class AppNav extends LitElement {
  @property({ reflect: true, type: Boolean })
  popout = true;

  @property({ reflect: false })
  shareTitle: string | null = null;

  @property({ reflect: false })
  shareText: string | null = null;

  static styles = css`
    * {
      box-sizing: border-box;
    }

    :host {
      display: block;
    }

    :host([popout]) #container {
      transition: transform 0.3s cubic-bezier(0, 0, 0.3, 1);
      transform: translateX(-100%) translateX(-10px);
      height: 100%;
      border-right: 1px solid var(--bb-neutral-300);
      padding: var(--bb-grid-size-2);
    }

    :host([visible]) #container {
      pointer-events: auto;
      transform: translateX(0);
    }

    :host([popout]) {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      width: 100%;
      height: 100%;
      overflow: hidden;
      z-index: 100;
    }

    :host(:not([popout])) {
      margin-top: 30px;
      padding-top: 30px;
      border-top: 1px solid var(--bb-neutral-300);
    }

    :host([popout]) #container {
      width: 80%;
      background: var(--bb-neutral-0);
    }

    #background {
      background: transparent;
      width: 100%;
      height: 100%;
      position: absolute;
      top: 0;
      left: 0;
      pointer-events: none;
    }

    :host(:not([popout])) #background {
      display: none;
    }

    :host([visible]) #background {
      pointer-events: auto;
    }

    #container h1 {
      margin: 0;
      padding: var(--bb-grid-size-2) 0;
      font: var(--bb-font-title-medium);
    }

    #container ul {
      margin: 0;
      list-style: none;
      padding: 0;
    }

    :host(:not([popout])) #container ul {
      padding-left: var(--bb-grid-size-4);
    }

    #container li {
      height: 24px;
      display: flex;
      align-items: center;
      margin-bottom: var(--bb-grid-size-3);
    }

    button,
    a {
      background: transparent;
      border: none;
      cursor: pointer;
      padding: 0 0 0 var(--bb-grid-size-6);
      color: var(--bb-neutral-800);
      opacity: 0.6;
      transition: opacity 0.3s cubic-bezier(0, 0, 0.3, 1);
    }

    button:hover,
    button:focus {
      opacity: 1;
    }

    button#recent {
      background: transparent var(--bb-icon-recent) left center / 20px 20px
        no-repeat;
    }

    button#share {
      background: transparent var(--bb-icon-share) left center / 20px 20px
        no-repeat;
    }

    a#visual-editor {
      background: transparent var(--bb-icon-open-new) left center / 20px 20px
        no-repeat;
    }
  `;

  async #createInviteLink(evt: Event) {
    evt.preventDefault();
    const a = evt.target as HTMLAnchorElement;
    try {
      const result = await fetch(a.href, { method: "POST" });
      const json = await result.json();
      const invite = json.invite;
      const inviteLink = new URL(window.location.href);
      inviteLink.searchParams.set("invite", invite);
      await navigator.clipboard.writeText(inviteLink.href);
    } catch (e) {
      console.error("FAILED TO CREATE LINK", e);
    }
  }

  async #listInvites(evt: Event) {
    evt.preventDefault();
    const a = evt.target as HTMLAnchorElement;
    try {
      const result = await fetch(a.href);
      const json = await result.json();
      console.log("INVITES YAY", json.invites);
    } catch (e) {
      console.error("FAILED TO LIST INVITES", e);
    }
  }

  render() {
    const boardUrl = window.location.href.replace(/app$/, "json");
    const visualEditorUrl = `https://breadboard-ai.web.app/?board=${boardUrl}`;
    const boardServerKey = localStorage.getItem("board-server-key");
    let inviteLink;
    if (!boardServerKey) {
      inviteLink = nothing;
    } else {
      const inviteURL = new URL(window.location.href.replace(/app$/, "invite"));
      inviteURL.searchParams.set("API_KEY", boardServerKey);
      inviteLink = html`<li>
          <a href=${inviteURL.href} @click=${this.#createInviteLink}
            >Create Invite</a
          >
        </li>
        <li>
          <a href=${inviteURL.href} @click=${this.#listInvites}
            >List invites (in console)</a
          >
        </li>`;
    }
    const showShare = "share" in navigator;
    return html` <div
        id="background"
        @click=${() => {
          this.dispatchEvent(new DismissMenuEvent());
        }}
      ></div>
      <div
        id="container"
        @click=${(evt: Event) => {
          evt.stopImmediatePropagation();
        }}
      >
        ${this.popout ? html`<h1>Menu</h1>` : nothing}
        <ul>
          <li>
            <a id="visual-editor" .href=${visualEditorUrl}
              >Open in Visual Editor</a
            >
          </li>
          ${inviteLink}
          <!-- <li><button id="recent">Recent Activity</button></li> -->
          ${showShare
            ? html`<li>
                <button
                  id="share"
                  @click=${() => {
                    this.dispatchEvent(new ShareEvent());
                  }}
                >
                  Share
                </button>
              </li>`
            : nothing}
        </ul>
      </div>`;
  }
}
