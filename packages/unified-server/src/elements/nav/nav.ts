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
  InviteRequestEvent,
  RunContextChangeEvent,
  ShareEvent,
} from "../../events/events.js";
import { VisitorState } from "../../utils/types.js";

@customElement("bb-app-nav")
export class AppNav extends LitElement {
  @property({ reflect: true, type: Boolean })
  popout = true;

  @property({ reflect: false })
  visitorState: VisitorState = VisitorState.LOADING;

  @property({ reflect: false })
  showLinkToGraph = false;

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
      padding: 0 0 0 var(--bb-grid-size-8);
      color: var(--bb-neutral-800);
      font: var(--bb-font-label-medium);
      text-decoration: none;
    }

    button .text,
    a .text,
    label .text {
      opacity: 0.6;
      transition: opacity 0.3s cubic-bezier(0, 0, 0.3, 1);
    }

    button:hover .text,
    button:focus .text,
    a:hover .text,
    a:focus .text,
    label:hover .text,
    label:focus .text {
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

    button#create-invite {
      background: transparent var(--bb-icon-rsvp) left center / 20px 20px
        no-repeat;
    }

    button#list-invites {
      background: transparent var(--bb-icon-list) left center / 20px 20px
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
      padding-left: var(--bb-grid-size-8);
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

  render() {
    const boardUrl = window.location.href.replace(/app$/, "json");
    const visualEditorUrl = `https://breadboard-ai.web.app/?board=${boardUrl}`;

    const runOnBoardServer =
      this.visitorState === VisitorState.VISITOR
        ? nothing
        : html`<li>
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
            /><label for="run-on-board-server"
              ><span class="text">Run on Server</span></label
            >
          </li>`;

    const manageInvites =
      this.visitorState === VisitorState.OWNER
        ? html` <li>
            <button
              id="create-invite"
              @click=${() => {
                this.dispatchEvent(new InviteRequestEvent());
              }}
            >
              <span class="text">Manage Invites</span>
            </button>
          </li>`
        : nothing;

    const boardServerKeyText =
      this.visitorState >= VisitorState.USER
        ? "Update Board Server API Key"
        : "Sign in to Board Server";

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
          ${this.showLinkToGraph
            ? html` <li>
                <a id="visual-editor" .href=${visualEditorUrl}
                  ><span class="text">Open in Visual Editor</span></a
                >
              </li>`
            : nothing}
          ${this.visitorState === VisitorState.LOADING
            ? nothing
            : html` ${runOnBoardServer}
                <li>
                  <button
                    @click=${() => {
                      this.dispatchEvent(new BoardServerKeyRequestEvent());
                    }}
                    id="update-board-key"
                  >
                    <span class="text">${boardServerKeyText}</span>
                  </button>
                </li>
                ${manageInvites}`}
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
