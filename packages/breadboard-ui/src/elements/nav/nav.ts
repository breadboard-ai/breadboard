/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css, HTMLTemplateResult, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { Board, BoardStorageSupported } from "../../types/types.js";
import {
  BlankBoardRequestEvent,
  FileStorageDisconnectEvent,
  FileStorageLoadRequestEvent,
  FileStorageRefreshEvent,
  FileStorageRenewAccessRequestEvent,
  FileStorageRequestEvent,
  StartEvent,
} from "../../events/events.js";
import { map } from "lit/directives/map.js";

@customElement("bb-nav")
export class Navigation extends LitElement {
  @property()
  storageSupported: BoardStorageSupported | null = null;

  @property()
  storageItems: Map<
    string,
    { permission: "prompt" | "granted"; items: Map<string, unknown> }
  > | null = null;

  @property({ reflect: true })
  visible = false;

  @property()
  exampleBoards: Board[] | null = null;

  @property()
  url: string | null = null;

  static styles = css`
    * {
      box-sizing: border-box;
    }

    :host {
      position: fixed;
      top: 0;
      left: 0;
      width: min(80vw, 300px);
      height: 100%;
      overflow: hidden;
      z-index: 1000;
      pointer-events: none;
      color: var(--bb-neutral-700);
      user-select: none;
    }

    #menu {
      transition: transform 0.3s cubic-bezier(0, 0, 0.3, 1);
      transform: translateX(-100%);
      will-change: transform;
      width: calc(100% - 10px);
      background: #fff;
      border-right: 1px solid var(--bb-neutral-300);
      pointer-events: auto;
      height: 100%;
      display: flex;
      flex-direction: column;
      overflow: auto;
    }

    button {
      transition: opacity 0.15s cubic-bezier(0, 0, 0.3, 1);
    }

    #blank-board,
    #sources {
      display: flex;
      padding: calc(var(--bb-grid-size) * 2);
      border-bottom: 1px solid var(--bb-neutral-300);
    }

    #blank-board h1,
    #sources h1 {
      flex: 1;
      font-size: var(--bb-label-medium);
    }

    #blank-board button,
    #sources button {
      background: none;
      width: 16px;
      height: 16px;
      background-position: center center;
      background-repeat: no-repeat;
      background-size: 16px 16px;
      border: none;
      font-size: 0;
      opacity: 0.5;
      cursor: pointer;
    }

    #blank-board button:hover,
    #sources button:hover {
      opacity: 1;
    }

    #sources button {
      background-image: var(--bb-icon-add-circle);
    }

    #blank-board button {
      background-image: var(--bb-icon-file-add);
    }

    .items {
      overflow-y: scroll;
      overflow-x: hidden;
      scrollbar-gutter: stable;
    }

    details {
      border-bottom: 1px solid var(--bb-neutral-300);
      padding: calc(var(--bb-grid-size) * 2);
    }

    details:last-of-type {
      border-bottom: none;
      margin-bottom: calc(var(--bb-grid-size) * 10);
    }

    summary {
      position: sticky;
      top: 0;
      font-size: var(--bb-label-large);
      background: #fff;
      padding: var(--bb-grid-size) 0;
      z-index: 1;
      list-style: none;
      display: flex;
    }

    summary::before {
      content: "";
      width: 16px;
      height: 12px;
      background: var(--bb-expand-arrow) 1px 2px no-repeat;
      display: inline-block;
    }

    details[open] > summary::before {
      background: var(--bb-collapse-arrow) 1px 2px no-repeat;
    }

    summary::-webkit-details-marker {
      display: none;
    }

    summary span {
      flex: 1;
    }

    .refresh,
    .disconnect {
      background: none;
      width: 16px;
      height: 16px;
      background-position: center center;
      background-repeat: no-repeat;
      background-size: 16px 16px;
      border: none;
      font-size: 0;
      opacity: 0.5;
      cursor: pointer;
    }

    .refresh:hover,
    .disconnect:hover {
      opacity: 1;
    }

    .disconnect {
      background-image: var(--bb-icon-eject);
    }

    .refresh {
      margin-right: var(--bb-grid-size);
      background-image: var(--bb-icon-refresh);
    }

    .renew-access {
      color: var(--bb-neutral-600);
      display: flex;
      align-items: center;
      font-size: var(--bb-label-small);
      font-style: italic;
    }

    .renew-access::before {
      content: "";
      display: block;
      width: 16px;
      height: 16px;
      background: var(--bb-icon-warning) center center no-repeat;
      background-size: 16px 16px;
      margin-right: var(--bb-grid-size);
    }

    .renew-access span {
      flex: 1;
    }

    .request-renewed-access {
      background: var(--bb-neutral-300);
      border-radius: calc(var(--bb-grid-size) * 3);
      border: none;
      font-size: var(--bb-label-small);
    }

    h1 {
      margin: 0;
    }

    ul {
      list-style: none;
      padding: calc(var(--bb-grid-size));
      margin: 0;
    }

    ul li button {
      font-size: var(--bb-label-medium);
      background: none;
      border: none;
      opacity: 0.5;
      cursor: pointer;
    }

    ul li button[active] {
      font-weight: bold;
      opacity: 1;
    }

    ul li button:hover {
      opacity: 1;
    }

    ul li {
      margin-bottom: var(--bb-grid-size);
    }

    :host([visible="true"]) #menu {
      transition: transform 0.15s cubic-bezier(0, 0, 0.3, 1);
      transform: none;
    }
  `;

  #createEntry(type: "file" | "example", location: string, fileName: string) {
    switch (type) {
      case "file": {
        return html`<li>
          <button
            @click=${() => {
              this.dispatchEvent(
                new FileStorageLoadRequestEvent(location, fileName)
              );
            }}
          >
            ${fileName}
          </button>
        </li>`;
      }

      case "example": {
        return html`<li>
          <button
            @click=${() => {
              this.dispatchEvent(new StartEvent(location));
            }}
            ?active=${location === this.url}
          >
            ${fileName}
          </button>
        </li>`;
      }
    }
  }

  render() {
    let sources: HTMLTemplateResult | symbol = nothing;
    if (this.storageSupported) {
      if (this.storageSupported.fileSystem) {
        sources = html` <section id="sources">
          <h1>Sources</h1>
          <button
            @click=${() => {
              this.dispatchEvent(new FileStorageRequestEvent());
            }}
            title="Add file system storage"
          >
            +
          </button>
        </section>`;
      }
    }

    let storageItems: symbol | HTMLTemplateResult = nothing;
    if (this.storageItems) {
      storageItems = html`${map(
        this.storageItems,
        ([location, { permission, items }]) => {
          return html` <details open>
            <summary>
              <span>${location}</span>
              <button
                @click=${() => {
                  this.dispatchEvent(new FileStorageRefreshEvent(location));
                }}
                class="refresh"
                title="Refresh this storage"
              >
                Refresh
              </button>
              <button
                @click=${() => {
                  if (
                    !confirm(
                      "Are you sure you want to disconnect from this source?"
                    )
                  ) {
                    return;
                  }

                  this.dispatchEvent(new FileStorageDisconnectEvent(location));
                }}
                class="disconnect"
                title="Disconnect this storage"
              >
                Disconnect
              </button>
            </summary>
            ${permission === "prompt"
              ? html` <div class="renew-access">
                  <span>Access has expired for this source</span>
                  <button
                    class="request-renewed-access"
                    @click=${() => {
                      this.dispatchEvent(
                        new FileStorageRenewAccessRequestEvent(location)
                      );
                    }}
                  >
                    Renew
                  </button>
                </div>`
              : html`<ul>
                  ${map(items, ([fileName]) => {
                    return this.#createEntry("file", location, fileName);
                  })}
                </ul>`}
          </details>`;
        }
      )}`;
    }

    let exampleItems: symbol | HTMLTemplateResult = nothing;
    if (this.exampleBoards) {
      exampleItems = html` <details>
        <summary>Example Boards</summary>
        <ul>
          ${map(this.exampleBoards, (board) =>
            this.#createEntry("example", board.url, board.title)
          )}
        </ul>
      </details>`;
    }

    return html`<nav id="menu">
      <section id="blank-board">
        <h1>Blank Board</h1>
        <button
          @click=${() => {
            this.dispatchEvent(new BlankBoardRequestEvent());
          }}
          title="Add file system storage"
        >
          +
        </button>
      </section>
      ${sources}
      <div class="items">${storageItems} ${exampleItems}</div>
    </nav>`;
  }
}
