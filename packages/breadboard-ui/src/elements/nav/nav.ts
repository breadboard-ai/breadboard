/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css, HTMLTemplateResult, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import {
  GraphProviderBlankBoardEvent,
  GraphProviderConnectRequestEvent,
  GraphProviderDeleteRequestEvent,
  GraphProviderDisconnectEvent,
  GraphProviderLoadRequestEvent,
  GraphProviderRefreshEvent,
  GraphProviderRenewAccessRequestEvent,
} from "../../events/events.js";
import { map } from "lit/directives/map.js";
import { GraphProvider, GraphProviderStore } from "@google-labs/breadboard";

@customElement("bb-nav")
export class Navigation extends LitElement {
  @property()
  providers: GraphProvider[] = [];

  @property({ reflect: true })
  visible = false;

  @property()
  url: string | null = null;

  @property()
  providerOps = 0;

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

    .blank-board,
    .refresh,
    .disconnect,
    .delete-board {
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
      margin-right: var(--bb-grid-size);
    }

    .blank-board:hover,
    .refresh:hover,
    .disconnect:hover,
    .delete-board:hover {
      opacity: 1;
    }

    .disconnect {
      background-image: var(--bb-icon-eject);
    }

    .refresh {
      background-image: var(--bb-icon-refresh);
    }

    .blank-board {
      background-image: var(--bb-icon-file-add);
    }

    .delete-board {
      margin-right: 0;
      background-image: var(--bb-icon-delete);
    }

    summary button:last-of-type {
      margin-right: 0;
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
      padding: calc(var(--bb-grid-size)) 0;
      margin: 0;
    }

    ul li {
      display: flex;
    }

    .file-selector {
      flex: 1;
    }

    ul li button {
      font-size: var(--bb-label-medium);
      background: none;
      border: none;
      opacity: 0.5;
      cursor: pointer;
      text-align: left;
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

  #createEntry(
    providerName: string,
    fileName: string,
    url: string,
    canDelete: boolean
  ) {
    const deleteButton = canDelete
      ? html`<button
          @click=${() => {
            this.dispatchEvent(
              new GraphProviderDeleteRequestEvent(
                providerName,
                url,
                url === this.url
              )
            );
          }}
          class="delete-board"
        >
          Delete
        </button>`
      : nothing;
    return html`<li>
      <button
        @click=${() => {
          this.dispatchEvent(
            new GraphProviderLoadRequestEvent(providerName, url)
          );
        }}
        class="file-selector"
        ?active=${url === this.url}
      >
        ${fileName}
      </button>
      ${deleteButton}
    </li>`;
  }

  #createStoreList(
    provider: GraphProvider,
    location: string,
    { permission, items, title }: GraphProviderStore
  ) {
    const providerName = provider.name;
    const createBlankBoard = html`<button
      @click=${() => {
        const fileName = prompt(
          "What would you like to name this file?",
          "new-board.json"
        );
        if (!fileName) {
          return;
        }

        this.dispatchEvent(
          new GraphProviderBlankBoardEvent(providerName, location, fileName)
        );
      }}
      ?disabled=${permission === "prompt"}
      class="blank-board"
      title="Create a new board"
    >
      Blank Board
    </button>`;

    const refreshProvider = html`<button
      @click=${() => {
        this.dispatchEvent(
          new GraphProviderRefreshEvent(providerName, location)
        );
      }}
      ?disabled=${permission === "prompt"}
      class="refresh"
      title="Refresh this storage"
    >
      Refresh
    </button>`;

    const disconnectLocation = html`<button
      @click=${() => {
        if (!confirm("Are you sure you want to disconnect from this source?")) {
          return;
        }
        this.dispatchEvent(
          new GraphProviderDisconnectEvent(providerName, location)
        );
      }}
      class="disconnect"
      title="Disconnect this storage"
    >
      Disconnect
    </button>`;

    const extendedCapabilities = provider.extendedCapabilities();
    return html` <details open>
      <summary>
        <span>${title}</span>
        ${extendedCapabilities.modify ? createBlankBoard : nothing}
        ${extendedCapabilities.refresh ? refreshProvider : nothing}
        ${extendedCapabilities.disconnect ? disconnectLocation : nothing}
      </summary>
      ${permission === "prompt"
        ? html` <div class="renew-access">
            <span>Access has expired for this source</span>
            <button
              class="request-renewed-access"
              @click=${() => {
                this.dispatchEvent(
                  new GraphProviderRenewAccessRequestEvent(
                    providerName,
                    location
                  )
                );
              }}
            >
              Renew
            </button>
          </div>`
        : html`<ul>
            ${map(items, ([fileName, { url }]) => {
              return this.#createEntry(
                providerName,
                fileName,
                url,
                extendedCapabilities.modify
              );
            })}
          </ul>`}
    </details>`;
  }

  render() {
    const storageItems = html`${map(this.providers, (provider) => {
      if (!("items" in provider)) {
        return nothing;
      }

      return html`${map(provider.items(), ([location, providerStore]) => {
        return this.#createStoreList(provider, location, providerStore);
      })}`;
    })}`;

    const supportsFileSystem =
      this.providers.find((provider) => {
        return (
          provider.name === "FileSystemGraphProvider" && provider.isSupported()
        );
      }) !== undefined;

    let sources: HTMLTemplateResult | symbol = nothing;
    if (supportsFileSystem) {
      sources = html` <section id="sources">
        <h1>Sources</h1>
        <button
          @click=${() => {
            this.dispatchEvent(
              new GraphProviderConnectRequestEvent("FileSystemGraphProvider")
            );
          }}
          title="Add file system storage"
        >
          +
        </button>
      </section>`;
    }

    return html`<nav id="menu">
      ${sources}
      <div class="items">${storageItems}</div>
    </nav>`;
  }
}
