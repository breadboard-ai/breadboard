/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import {
  GraphProviderAddEvent,
  GraphProviderBlankBoardEvent,
  GraphProviderDeleteRequestEvent,
  GraphProviderDisconnectEvent,
  GraphProviderLoadRequestEvent,
  GraphProviderRefreshEvent,
  GraphProviderRenewAccessRequestEvent,
  GraphProviderSelectionChangeEvent,
} from "../../events/events.js";
import { map } from "lit/directives/map.js";
import { GraphProvider } from "@google-labs/breadboard";
import { classMap } from "lit/directives/class-map.js";

@customElement("bb-nav")
export class Navigation extends LitElement {
  @property()
  providers: GraphProvider[] = [];

  @property()
  providerOps = 0;

  @property({ reflect: true })
  visible = false;

  @property()
  url: string | null = null;

  @property()
  selectedProvider = "IDBGraphProvider";

  @property()
  selectedLocation = "default";

  @state()
  filter: string | null = null;

  @state()
  showProviderOverflowMenu = false;

  #hideProviderOverflowMenuBound = this.#hideProviderOverflowMenu.bind(this);

  static styles = css`
    * {
      box-sizing: border-box;
    }

    :host {
      position: fixed;
      top: 0;
      left: 0;
      width: min(80vw, 380px);
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

    :host([visible="true"]) {
      pointer-events: auto;
    }

    :host([visible="true"]) #menu {
      transition: transform 0.15s cubic-bezier(0, 0, 0.3, 1);
      transform: none;
    }

    #menu > header {
      padding: var(--bb-grid-size-3);
      display: grid;
      grid-template-columns: auto 102px;
      row-gap: var(--bb-grid-size-2);
      color: var(--bb-neutral-900);
      border-bottom: 1px solid var(--bb-neutral-300);
      flex: 0;
    }

    #menu > header > h1 {
      margin: 0;
      padding: 0;
      font: 400 var(--bb-title-medium) / var(--bb-title-line-height-medium)
        var(--bb-font-family);
    }

    #menu > header > #search {
      padding: var(--bb-grid-size-2);
      border-radius: var(--bb-grid-size);
      border: 1px solid var(--bb-neutral-300);
      grid-column: 1/3;
    }

    #menu > header > #search:placeholder-shown {
      background: var(--bb-icon-search) calc(100% - 8px) center / 20px 20px
        no-repeat;
    }

    #new-board {
      border-radius: 50px;
      background: var(--bb-ui-500);
      border: none;
      color: var(--bb-neutral-0);
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
      display: flex;
      align-items: center;
    }

    #new-board::before {
      content: "";
      background: var(--bb-icon-add-inverted) center center / 20px 20px
        no-repeat;
      width: 20px;
      height: 20px;
      margin-right: var(--bb-grid-size);
    }

    #provider {
      padding: var(--bb-grid-size-3);
      flex: 1;
      overflow: auto;
      display: flex;
      flex-direction: column;
    }

    #provider header {
      flex: 0;
    }

    #provider header h1 {
      font: 400 var(--bb-label-medium) / var(--bb-label-line-height-medium)
        var(--bb-font-family);
      color: var(--bb-neutral-500);
      margin: 0 0 var(--bb-grid-size) 0;
      grid-column: 1 / 3;
    }

    #provider #provider-chooser {
      width: 100%;
      display: flex;
      height: 32px;
    }

    #provider header select {
      border-radius: var(--bb-grid-size);
      background: var(--bb-ui-50);
      border: none;
      padding: 0 var(--bb-grid-size-2);
      flex: 1;
      width: 0;
      margin-right: var(--bb-grid-size-2);
    }

    #provider header #provider-settings {
      width: 32px;
      height: 32px;
      background: var(--bb-ui-100) var(--bb-icon-folder-managed) center center /
        20px 20px no-repeat;
      border-radius: var(--bb-grid-size);
      border: none;
      font-size: 0;
      flex: 0 0 auto;
    }

    #provider .boards {
      padding: 0;
      list-style: none;
      flex: 1;
      overflow: auto;
      margin: var(--bb-grid-size-4) 0;
    }

    #provider summary::-webkit-details-marker {
      display: none;
    }

    #provider summary {
      list-style: none;
    }

    #provider summary {
      color: var(--bb-neutral-600);
      font: 400 var(--bb-title-small) / var(--bb-title-line-height-small)
        var(--bb-font-family);
      margin-bottom: var(--bb-grid-size-2);
    }

    #provider summary::before {
      content: "";
      width: 20px;
      height: 20px;
      background: var(--bb-icon-arrow-right) -1px 6px / 20px 20px no-repeat;
      display: inline-block;
      margin: 0;
    }

    #provider details[open] > summary::before {
      background: var(--bb-icon-arrow-drop-down) -1px 6px / 20px 20px no-repeat;
    }

    #provider ul {
      padding: 0 var(--bb-grid-size-4);
      list-style: none;
      margin: 0 0 var(--bb-grid-size-3) 0;
    }

    #provider ul li {
      display: flex;
      min-height: var(--bb-grid-size-7);
      margin-bottom: var(--bb-grid-size);
    }

    #provider ul li .board {
      display: grid;
      background: transparent var(--bb-icon-draft) var(--bb-grid-size)
        var(--bb-grid-size) / 20px 20px no-repeat;
      border: none;
      color: var(--bb-neutral-900);
      font: 400 var(--bb-body-medium) / var(--bb-body-line-height-medium)
        var(--bb-font-family);
      cursor: pointer;
      padding: var(--bb-grid-size) 0 var(--bb-grid-size) var(--bb-grid-size-7);
      flex: 1;
      min-height: var(--bb-grid-size-7);
      text-align: left;
      align-items: center;
      width: 100%;
      white-space: nowrap;
      grid-template-columns: auto 1fr;
    }

    #provider ul li .board.tool {
      background: transparent var(--bb-icon-tool) var(--bb-grid-size)
        var(--bb-grid-size) / 20px 20px no-repeat;
    }

    #provider ul li .board.selected {
      color: var(--bb-neutral-900);
    }

    #provider ul li .board.selected .name {
      font-weight: 500;
    }

    #provider ul li .board .name {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    #provider ul li .board .username {
      color: var(--bb-neutral-600);
      white-space: no-wrap;
      padding-left: var(--bb-grid-size-3);
    }

    #provider ul li .board.mine.published::after {
      content: "";
      width: calc(20px + var(--bb-grid-size-2));
      height: 20px;
      background: var(--bb-icon-public) right center / 20px 20px no-repeat;
    }

    #provider ul li .delete {
      width: 24px;
      height: 24px;
      background: transparent var(--bb-icon-delete) center center / 20px 20px
        no-repeat;
      border: none;
      font-size: 0;
      flex: 0;
      margin-left: var(--bb-grid-size-2);
      opacity: 0.5;
      cursor: pointer;
    }

    #provider ul li .delete:hover,
    #provider ul li .delete:focus {
      opacity: 1;
    }

    #overflow-menu {
      z-index: 1000;
      display: grid;
      grid-template-rows: var(--bb-grid-size-11);
      top: 124px;
      left: 244px;
      position: fixed;
      box-shadow:
        0px 4px 8px 3px rgba(0, 0, 0, 0.05),
        0px 1px 3px rgba(0, 0, 0, 0.1);
      background: #ffffff;
      border: 1px solid var(--bb-neutral-300);
      border-radius: var(--bb-grid-size-2);
      overflow: auto;
      pointer-events: auto;
    }

    #overflow-menu button {
      display: flex;
      align-items: center;
      background: none;
      margin: 0;
      padding: var(--bb-grid-size-3) var(--bb-grid-size-6) var(--bb-grid-size-3)
        var(--bb-grid-size-3);
      border: none;
      border-bottom: 1px solid var(--bb-neutral-300);
      text-align: left;
      cursor: pointer;
    }

    #overflow-menu button:hover,
    #overflow-menu button:focus {
      background: var(--bb-neutral-50);
    }

    #overflow-menu button:last-of-type {
      border: none;
    }

    #overflow-menu button::before {
      content: "";
      width: 20px;
      height: 20px;
      margin-right: var(--bb-grid-size-3);
    }

    #overflow-menu #add-new-provider::before {
      background: var(--bb-icon-add) center center / 20px 20px no-repeat;
    }

    #overflow-menu #rename-provider::before {
      background: var(--bb-icon-edit) center center / 20px 20px no-repeat;
    }

    #overflow-menu #refresh-provider::before {
      background: var(--bb-icon-refresh) center center / 20px 20px no-repeat;
    }

    #overflow-menu #remove-provider::before {
      background: var(--bb-icon-delete) center center / 20px 20px no-repeat;
    }

    #empty-provider {
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
      margin-top: var(--bb-grid-size-2);
    }

    #renew-access {
      background: var(--bb-nodes-50);
      border-radius: var(--bb-grid-size-2);
      padding: var(--bb-grid-size-3);
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
      color: var(--bb-nodes-900);
      margin-top: var(--bb-grid-size-2);
    }

    #request-renewed-access {
      margin-top: var(--bb-grid-size);
      border-radius: 50px;
      background: var(--bb-nodes-500);
      border: none;
      color: var(--bb-nodes-900);
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
      display: flex;
      align-items: center;
      height: var(--bb-grid-size-7);
      padding-right: var(--bb-grid-size-4);
    }

    #request-renewed-access::before {
      content: "";
      background: var(--bb-icon-refresh) center center / 20px 20px no-repeat;
      width: 20px;
      height: 20px;
      margin-right: var(--bb-grid-size);
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();

    window.addEventListener("keydown", this.#hideProviderOverflowMenuBound);
    window.addEventListener("pointerdown", this.#hideProviderOverflowMenuBound);
    this.addEventListener("pointerdown", this.#hideProviderOverflowMenuBound);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();

    window.removeEventListener("keydown", this.#hideProviderOverflowMenuBound);
    window.removeEventListener(
      "pointerdown",
      this.#hideProviderOverflowMenuBound
    );
    this.removeEventListener(
      "pointerdown",
      this.#hideProviderOverflowMenuBound
    );
  }

  #createUrl(provider: string, location: string) {
    return `${provider}::${location}`;
  }

  #parseUrl(url: string) {
    return url.split("::");
  }

  #hideProviderOverflowMenu(evt: Event) {
    if (evt instanceof KeyboardEvent && evt.key !== "Escape") {
      return;
    }

    const [top] = evt.composedPath();
    if (
      top &&
      top instanceof HTMLButtonElement &&
      top.id === "provider-settings"
    ) {
      return;
    }

    this.showProviderOverflowMenu = false;
  }

  #returnToDefaultStore() {
    this.selectedProvider = "IDBGraphProvider";
    this.selectedLocation = "default";

    // In the event that the IDB provider is unavailable (like in the debugger),
    // we fall through to another provider if available.
    // TODO: Decide if the default store should be configurable from the
    // settings and passed through to the component.
    if (
      this.providers.length === 1 &&
      this.providers[0].name !== this.selectedProvider
    ) {
      const mainProvider = this.providers[0];
      this.selectedProvider = mainProvider.name;
      if (mainProvider.items().size === 1) {
        const providerNames = [...mainProvider.items().keys()];
        this.selectedLocation = providerNames[0] ?? "default";
      }
    }

    this.dispatchEvent(
      new GraphProviderSelectionChangeEvent(
        this.selectedProvider,
        this.selectedLocation
      )
    );
  }

  render() {
    const provider =
      this.providers.find(
        (provider) => provider.name === this.selectedProvider
      ) || this.providers[0];

    if (!provider) {
      this.#returnToDefaultStore();
      return html`<nav id="menu">Error loading provider</nav>`;
    }

    const store = provider.items().get(this.selectedLocation);
    if (!store) {
      this.#returnToDefaultStore();
      return html`<nav id="menu">Error loading store</nav>`;
    }

    const { permission } = store;
    const extendedCapabilities = provider.extendedCapabilities();
    const selected = this.#createUrl(
      this.selectedProvider,
      this.selectedLocation
    );

    // Divide the items into two buckets: those that belong to the user and
    // other published boards.
    const items = [...store.items].filter(([name]) => {
      if (!this.filter) {
        return true;
      }
      const filter = new RegExp(this.filter, "gim");
      return filter.test(name);
    });
    const myItems: typeof items = [];
    const otherItems: typeof items = [];
    for (const item of items) {
      const [, data] = item;
      if (data.mine) {
        myItems.push(item);
        continue;
      }

      otherItems.push(item);
    }

    type BoardInfo = (typeof items)[0];
    const renderBoards = ([
      name,
      { url, readonly, mine, tags, title, username },
    ]: BoardInfo) => {
      return html`<li>
        <button
          @click=${() => {
            this.dispatchEvent(
              new GraphProviderLoadRequestEvent(provider.name, url)
            );
          }}
          class=${classMap({
            mine,
            board: true,
            selected: url === this.url,
            tool: tags?.includes("tool") ?? false,
            published: tags?.includes("published") ?? false,
          })}
        >
          <span class="name">${title ?? name}</span>
          ${username && !mine
            ? html`<span class="username">@${username}</span>`
            : ""}
        </button>
        ${extendedCapabilities.modify && !readonly
          ? html`<button
              class="delete"
              @click=${() => {
                this.dispatchEvent(
                  new GraphProviderDeleteRequestEvent(
                    this.selectedProvider,
                    url,
                    url === this.url
                  )
                );
              }}
            >
              Delete
            </button>`
          : nothing}
      </li>`;
    };

    const myBoards = html`<ul class="mine">
      ${map(myItems, renderBoards)}
    </ul>`;

    const otherBoards = html`<ul class="other-boards">
      ${map(otherItems, renderBoards)}
    </ul>`;

    let boardListing;
    if (myItems.length > 0 && otherItems.length > 0) {
      boardListing = html`<div class="boards">
        <details open>
          <summary>Your boards</summary>
          ${myBoards}
        </details>
        <details open>
          <summary>Other people's boards</summary>
          ${otherBoards}
        </details>
      </div>`;
    } else if (myItems.length > 0 && otherItems.length === 0) {
      boardListing = html`<div class="boards">${myBoards}</div>`;
    } else if (myItems.length === 0 && otherItems.length > 0) {
      boardListing = html`<div class="boards">${otherBoards}</div>`;
    } else {
      boardListing = html`<div id="empty-provider">
        No boards in this provider
      </div>`;
    }

    return html`<nav id="menu">
        <header>
          <h1>Breadboard</h1>
          <button
            id="new-board"
            @click=${() => {
              this.dispatchEvent(new GraphProviderBlankBoardEvent());
            }}
          >
            New board
          </button>
          <input
            type="search"
            id="search"
            placeholder="Search boards"
            @input=${(evt: InputEvent) => {
              if (!(evt.target instanceof HTMLInputElement)) {
                return;
              }

              this.filter = evt.target.value;
            }}
          />
        </header>
        <section id="provider">
          <header>
            <h1>Provider</h1>
            <div id="provider-chooser">
              <select
                @input=${(evt: Event) => {
                  if (!(evt.target instanceof HTMLSelectElement)) {
                    return;
                  }

                  const [provider, location] = this.#parseUrl(evt.target.value);
                  this.selectedProvider = provider;
                  this.selectedLocation = location;

                  this.dispatchEvent(
                    new GraphProviderSelectionChangeEvent(provider, location)
                  );
                }}
              >
                ${map(this.providers, (provider) => {
                  return html`${map(provider.items(), ([location, store]) => {
                    const value = `${provider.name}::${location}`;
                    const isSelectedOption = value === selected;
                    return html`<option
                      ?selected=${isSelectedOption}
                      .value=${value}
                    >
                      ${store.title}
                    </option>`;
                  })}`;
                })}
              </select>
              <button
                id="provider-settings"
                @click=${() => {
                  this.showProviderOverflowMenu = true;
                }}
              >
                Provider Settings
              </button>
            </div>
          </header>
          ${permission === "granted"
            ? boardListing
            : html`<div id="renew-access">
                <span>Access has expired for this source</span>
                <button
                  id="request-renewed-access"
                  @click=${() => {
                    this.dispatchEvent(
                      new GraphProviderRenewAccessRequestEvent(
                        this.selectedProvider,
                        this.selectedLocation
                      )
                    );
                  }}
                >
                  Renew
                </button>
              </div>`}
        </section>
      </nav>

      ${this.showProviderOverflowMenu
        ? html` <div
            id="overflow-menu"
            @pointerdown=${(evt: Event) => {
              evt.preventDefault();
              evt.stopImmediatePropagation();
            }}
          >
            <button
              @click=${() => {
                this.dispatchEvent(new GraphProviderAddEvent());
                this.showProviderOverflowMenu = false;
              }}
              id="add-new-provider"
            >
              Add new provider
            </button>
            ${extendedCapabilities.refresh
              ? html`<button
                  @click=${() => {
                    this.showProviderOverflowMenu = false;
                    this.dispatchEvent(
                      new GraphProviderRefreshEvent(
                        this.selectedProvider,
                        this.selectedLocation
                      )
                    );
                  }}
                  id="refresh-provider"
                >
                  Refresh provider
                </button>`
              : nothing}
            ${extendedCapabilities.disconnect
              ? html`<button
                  @click=${() => {
                    if (
                      !confirm("Are you sure you want to remove this provider?")
                    ) {
                      return;
                    }
                    this.dispatchEvent(
                      new GraphProviderDisconnectEvent(
                        this.selectedProvider,
                        this.selectedLocation
                      )
                    );
                    this.showProviderOverflowMenu = false;
                    this.#returnToDefaultStore();
                  }}
                  id="remove-provider"
                >
                  Remove provider
                </button>`
              : nothing}
          </div>`
        : nothing}`;
  }
}
