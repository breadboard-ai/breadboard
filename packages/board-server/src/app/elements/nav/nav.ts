/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import {
  BoardServerKeyRequestEvent,
  DismissMenuEvent,
  RunContextChangeEvent,
  ShareEvent,
} from "../../events/events.js";
import { InviteManager } from "../../utils/invite.js";
import { until } from "lit/directives/until.js";

@customElement("bb-app-nav")
export class AppNav extends LitElement {
  @property({ reflect: true, type: Boolean })
  popout = true;

  @property({ reflect: false })
  shareTitle: string | null = null;

  @property({ reflect: false })
  shareText: string | null = null;

  @property({ reflect: false })
  runOnBoardServer = false;

  @property({ reflect: false })
  boardKeyNeeded = false;

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
      min-height: 24px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      margin-bottom: var(--bb-grid-size-2);
      align-items: flex-start;
    }

    button,
    a,
    label {
      background: transparent;
      border: none;
      cursor: pointer;
      padding: 0 0 0 var(--bb-grid-size-6);
      color: var(--bb-neutral-800);
      opacity: 0.6;
      transition: opacity 0.3s cubic-bezier(0, 0, 0.3, 1);
      font: var(--bb-font-label-medium);
      text-decoration: none;
    }

    button:hover,
    button:focus,
    a:hover,
    a:focus,
    label:hover,
    label:focus {
      opacity: 1;
    }

    button#update-board-key {
      background: transparent var(--bb-icon-password) left center / 20px 20px
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

    #run-on-board-server {
      display: none;
    }

    label[for="run-on-board-server"] {
      padding-left: var(--bb-grid-size-6);
      background: transparent var(--bb-icon-toggle-off) left center / 20px 20px
        no-repeat;
    }

    #run-on-board-server:checked ~ label[for="run-on-board-server"] {
      background: transparent var(--bb-icon-toggle-on) left center / 20px 20px
        no-repeat;
    }

    #key-needed {
      margin: var(--bb-grid-size-2) 0;
    }

    #key-needed button {
      padding: var(--bb-grid-size-2) var(--bb-grid-size-3);
      background: var(--bb-boards-100);
      color: var(--bb-boards-700);
      text-align: center;
      border-radius: var(--bb-grid-size);
      border: none;
      font: var(--bb-font-label-medium);
      opacity: 0.85;
    }
  `;

  #invites: InviteManager = new InviteManager();

  // THIS IS THE BEST UI CODE YOU'VE EVER SEEN ✨
  async #createInviteLink(evt: Event) {
    evt.preventDefault();
    const a = evt.target as HTMLAnchorElement;
    const result = await this.#invites.getOrCreateInvite();
    if (!result.success) {
      // IMAGINE THIS IS A TOAST ✨
      console.error("TOAST: FAILED TO CREATE LINK", result.error);
      return;
    }
    const inviteLink = this.#invites.inviteUrl(result.invite) as string;
    await navigator.clipboard.writeText(inviteLink);
  }

  async #listInvites(evt: Event) {
    evt.preventDefault();
    const a = evt.target as HTMLAnchorElement;
    const invites = await this.#invites.listInvites();
    if (!invites.success) {
      // IMAGINE THIS IS A TOAST ✨
      console.error("FAILED TO LIST INVITES", invites.error);
      return;
    }
    // IMAGINE PRETTY UI FOR INVITES ✨
    console.log("INVITES", invites.invites);
  }

  render() {
    const boardUrl = window.location.href.replace(/app$/, "json");
    const visualEditorUrl = `https://breadboard-ai.web.app/?board=${boardUrl}`;
    const inviteLink = this.#invites.canCreateInvite().then((canCreate) => {
      if (!canCreate) {
        return nothing;
      }
      return html`<li>
          <a href="" @click=${this.#createInviteLink}>Create Invite</a>
        </li>
        <li>
          <a href="" @click=${this.#listInvites}>List invites (in console)</a>
        </li>`;
    });
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
            <input
              type="checkbox"
              id="run-on-board-server"
              .checked=${this.runOnBoardServer}
              @input=${(evt: InputEvent) => {
                if (!(evt.target instanceof HTMLInputElement)) {
                  return;
                }

                this.dispatchEvent(
                  new RunContextChangeEvent(
                    evt.target.checked ? "remote" : "local"
                  )
                );
              }}
            /><label for="run-on-board-server">Run on Board Server</label>
            ${this.boardKeyNeeded
              ? html`<div id="key-needed">
                  <button
                    @click=${() => {
                      this.dispatchEvent(new BoardServerKeyRequestEvent());
                    }}
                  >
                    Add Board Server API Key
                  </button>
                </div>`
              : nothing}
          </li>
          <li>
            <button
              @click=${() => {
                this.dispatchEvent(new BoardServerKeyRequestEvent());
              }}
              id="update-board-key"
            >
              Update Board Server API Key
            </button>
          </li>
          <li>
            <a id="visual-editor" .href=${visualEditorUrl}
              >Open in Visual Editor</a
            >
          </li>
          ${until(inviteLink)}
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
