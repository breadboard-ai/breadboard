/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  LitElement,
  html,
  css,
  nothing,
  TemplateResult,
  PropertyValueMap,
} from "lit";
import { customElement, property, state } from "lit/decorators.js";
import {
  GraphBoardServerAddEvent,
  GraphBoardServerBlankBoardEvent,
  GraphBoardServerDeleteRequestEvent,
  GraphBoardServerDisconnectEvent,
  GraphBoardServerLoadRequestEvent,
  GraphBoardServerRefreshEvent,
  GraphBoardServerRenewAccessRequestEvent,
  GraphBoardServerSelectionChangeEvent,
  ResetEvent,
} from "../../events/events.js";
import { map } from "lit/directives/map.js";
import { BoardServer } from "@google-labs/breadboard";
import { classMap } from "lit/directives/class-map.js";
import { until } from "lit/directives/until.js";
import { createRef, Ref, ref } from "lit/directives/ref.js";

@customElement("bb-nav")
export class Navigation extends LitElement {
  @property()
  boardServers: BoardServer[] = [];

  @property()
  boardServerNavState: string | null = null;

  @property({ reflect: true })
  visible = false;

  @property()
  url: string | null = null;

  @property()
  selectedBoardServer = "Example Boards";

  @property()
  selectedLocation = "example://example-boards";

  @state()
  filter: string | null = null;

  @state()
  showBoardServerOverflowMenu = false;

  #boardServerRef: Ref<HTMLElement> = createRef();
  #hideBoardServerOverflowMenuBound =
    this.#hideBoardServerOverflowMenu.bind(this);

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
    }

    #menu > header > h1 > button {
      margin: 0;
      padding: 0;
      font: 400 var(--bb-title-medium) / var(--bb-title-line-height-medium)
        var(--bb-font-family);
      background: none;
      border: none;
      cursor: pointer;
      color: var(--bb-neutral-600);
    }

    #menu > header > h1 > button:hover,
    #menu > header > h1 > button:focus {
      color: var(--bb-neutral-900);
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

    #board-server {
      padding: var(--bb-grid-size-3);
      flex: 1;
      overflow: auto;
      display: flex;
      flex-direction: column;
    }

    #board-server header {
      flex: 0;
    }

    #board-server header h1 {
      font: 400 var(--bb-label-medium) / var(--bb-label-line-height-medium)
        var(--bb-font-family);
      color: var(--bb-neutral-500);
      margin: 0 0 var(--bb-grid-size) 0;
      grid-column: 1 / 3;
    }

    #board-server #board-server-chooser {
      width: 100%;
      display: flex;
      height: 32px;
    }

    #board-server header select {
      border-radius: var(--bb-grid-size);
      background: var(--bb-ui-50);
      border: none;
      padding: 0 var(--bb-grid-size-2);
      flex: 1;
      width: 0;
      margin-right: var(--bb-grid-size-2);
    }

    #board-server header #board-server-settings {
      width: 32px;
      height: 32px;
      background: var(--bb-ui-100) var(--bb-icon-folder-managed) center center /
        20px 20px no-repeat;
      border-radius: var(--bb-grid-size);
      border: none;
      font-size: 0;
      flex: 0 0 auto;
    }

    #board-server .boards {
      padding: 0;
      list-style: none;
      flex: 1;
      overflow: auto;
      margin: var(--bb-grid-size-4) 0;
    }

    #board-server summary::-webkit-details-marker {
      display: none;
    }

    #board-server summary {
      list-style: none;
    }

    #board-server summary {
      color: var(--bb-neutral-600);
      font: 400 var(--bb-title-small) / var(--bb-title-line-height-small)
        var(--bb-font-family);
      margin-bottom: var(--bb-grid-size-2);
    }

    #board-server summary::before {
      content: "";
      width: 20px;
      height: 20px;
      background: var(--bb-icon-arrow-right) -1px 6px / 20px 20px no-repeat;
      display: inline-block;
      margin: 0;
    }

    #board-server details[open] > summary::before {
      background: var(--bb-icon-arrow-drop-down) -1px 6px / 20px 20px no-repeat;
    }

    #board-server ul {
      padding: 0 var(--bb-grid-size-4);
      list-style: none;
      margin: 0 0 var(--bb-grid-size-3) 0;
    }

    #board-server ul li {
      display: flex;
      min-height: var(--bb-grid-size-7);
      margin-bottom: var(--bb-grid-size);
    }

    #board-server ul li .board {
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

    #board-server ul li .board.tool {
      background: transparent var(--bb-icon-tool) var(--bb-grid-size)
        var(--bb-grid-size) / 20px 20px no-repeat;
    }

    #board-server ul li .board.selected {
      color: var(--bb-neutral-900);
    }

    #board-server ul li .board.selected .name {
      font-weight: 500;
    }

    #board-serverrverrver ul li .board .name {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    #board-server ul li .board .username {
      color: var(--bb-neutral-600);
      white-space: no-wrap;
      padding-left: var(--bb-grid-size-3);
    }

    #board-server ul li .board.mine.published::after {
      content: "";
      width: calc(20px + var(--bb-grid-size-2));
      height: 20px;
      background: var(--bb-icon-public) right center / 20px 20px no-repeat;
    }

    #board-server ul li .delete {
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

    #board-server ul li .delete:hover,
    #board-server ul li .delete:focus {
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

    #overflow-menu #add-new-board-server::before {
      background: var(--bb-icon-add) center center / 20px 20px no-repeat;
    }

    #overflow-menu #rename-board-server::before {
      background: var(--bb-icon-edit) center center / 20px 20px no-repeat;
    }

    #overflow-menu #refresh-board-server::before {
      background: var(--bb-icon-refresh) center center / 20px 20px no-repeat;
    }

    #overflow-menu #remove-board-server::before {
      background: var(--bb-icon-delete) center center / 20px 20px no-repeat;
    }

    #empty-board-server {
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

    #loading-message {
      margin: var(--bb-grid-size-2) 0;
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();

    window.addEventListener("keydown", this.#hideBoardServerOverflowMenuBound);
    window.addEventListener(
      "pointerdown",
      this.#hideBoardServerOverflowMenuBound
    );
    this.addEventListener(
      "pointerdown",
      this.#hideBoardServerOverflowMenuBound
    );
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();

    window.removeEventListener(
      "keydown",
      this.#hideBoardServerOverflowMenuBound
    );
    window.removeEventListener(
      "pointerdown",
      this.#hideBoardServerOverflowMenuBound
    );
    this.removeEventListener(
      "pointerdown",
      this.#hideBoardServerOverflowMenuBound
    );
  }

  protected willUpdate(
    changedProperties:
      | PropertyValueMap<{
          boardServerNavState: string | null;
          boardServers: BoardServer[];
          selectedBoardServer: string;
          selectedLocation: string;
          url: string | null;
          filter: string | null;
        }>
      | Map<PropertyKey, unknown>
  ): void {
    if (
      changedProperties.has("boardServerNavState") ||
      changedProperties.has("boardServers") ||
      changedProperties.has("selectedLocation") ||
      changedProperties.has("selectedBoardServer") ||
      changedProperties.has("filter") ||
      changedProperties.has("url")
    ) {
      this.#boardServerContents = this.#loadBoardServerContents();
    }
  }

  protected updated(): void {
    requestAnimationFrame(() => {
      if (!this.#boardServerRef.value) {
        return;
      }

      for (const item of this.#boardServerRef.value.querySelectorAll<HTMLElement>(
        "button.board"
      )) {
        item.classList.toggle("selected", item.dataset.url === this.url);
      }
    });
  }

  #createUrl(boardServer: string, location: string) {
    return `${boardServer}::${location}`;
  }

  #parseUrl(url: string) {
    return url.split("::");
  }

  #hideBoardServerOverflowMenu(evt: Event) {
    if (evt instanceof KeyboardEvent && evt.key !== "Escape") {
      return;
    }

    const [top] = evt.composedPath();
    if (
      top &&
      top instanceof HTMLButtonElement &&
      top.id === "board-server-settings"
    ) {
      return;
    }

    this.showBoardServerOverflowMenu = false;
  }

  #returnToDefaultStore() {
    if (!this.boardServers.length) {
      return;
    }

    const mainBoardServer = this.boardServers[0];
    const selectedBoardServer = mainBoardServer.name;
    if (mainBoardServer.items().size === 0) {
      return;
    }

    const boardServerNames = [...mainBoardServer.items().keys()];
    const selectedLocation = boardServerNames[0];

    if (
      selectedBoardServer !== this.selectedBoardServer &&
      selectedLocation !== this.selectedLocation
    ) {
      this.selectedBoardServer = selectedBoardServer;
      this.selectedLocation = selectedLocation;

      this.dispatchEvent(
        new GraphBoardServerSelectionChangeEvent(
          this.selectedBoardServer,
          this.selectedLocation
        )
      );
    }
  }

  #boardServerContents: Promise<TemplateResult<1>> | null = null;
  async #loadBoardServerContents() {
    const boardServer =
      this.boardServers.find(
        (boardServer) => boardServer.name === this.selectedBoardServer
      ) || this.boardServers[0];

    if (!boardServer) {
      this.#returnToDefaultStore();
      return html`<nav id="menu">Error loading Board Server</nav>`;
    }

    const extendedCapabilities = boardServer.extendedCapabilities();

    await boardServer.ready();

    let store = boardServer.items().get(this.selectedLocation);
    if (!store) {
      store = [...boardServer.items().values()].find(
        (boardServer) =>
          boardServer.url && boardServer.url === this.selectedLocation
      );
    }
    if (!store) {
      this.#returnToDefaultStore();
      return html`<nav id="menu">Error loading store</nav>`;
    }

    const { permission } = store;

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
          @click=${(evt: PointerEvent) => {
            const isMac = navigator.platform.indexOf("Mac") === 0;
            const isCtrlCommand = isMac ? evt.metaKey : evt.ctrlKey;

            this.dispatchEvent(
              new GraphBoardServerLoadRequestEvent(
                boardServer.name,
                url,
                isCtrlCommand
              )
            );
          }}
          data-url=${url}
          class=${classMap({
            mine,
            board: true,
            tool: tags?.includes("tool") ?? false,
            published: tags?.includes("published") ?? false,
          })}
          title=${url}
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
                  new GraphBoardServerDeleteRequestEvent(
                    this.selectedBoardServer,
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
      boardListing = html`<div id="empty-board-server">
        No boards in this Board Server
      </div>`;
    }

    return permission === "granted"
      ? boardListing
      : html`<div id="renew-access">
          <span>Access has expired for this Board Server</span>
          <button
            id="request-renewed-access"
            @click=${() => {
              this.dispatchEvent(
                new GraphBoardServerRenewAccessRequestEvent(
                  this.selectedBoardServer,
                  this.selectedLocation
                )
              );
            }}
          >
            Renew
          </button>
        </div>`;
  }

  render() {
    const boardServer =
      this.boardServers.find(
        (boardServer) => boardServer.name === this.selectedBoardServer
      ) || this.boardServers[0];

    if (!boardServer) {
      this.#returnToDefaultStore();
      return html`<nav id="menu">Error loading Board Server</nav>`;
    }

    const extendedCapabilities = boardServer.extendedCapabilities();

    const selected = this.#createUrl(
      this.selectedBoardServer,
      this.selectedLocation
    );

    return html`<nav id="menu">
        <header>
          <h1>
            <button
              id="reset"
              @click=${() => {
                this.dispatchEvent(new ResetEvent());
              }}
            >
              Breadboard
            </button>
          </h1>
          <button
            id="new-board"
            @click=${() => {
              this.dispatchEvent(new GraphBoardServerBlankBoardEvent());
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
        <section id="board-server" ${ref(this.#boardServerRef)}>
          <header>
            <h1>Board Server</h1>
            <div id="board-server-chooser">
              <select
                @input=${(evt: Event) => {
                  if (!(evt.target instanceof HTMLSelectElement)) {
                    return;
                  }

                  const [boardServer, location] = this.#parseUrl(
                    evt.target.value
                  );
                  this.selectedBoardServer = boardServer;
                  this.selectedLocation = location;

                  this.dispatchEvent(
                    new GraphBoardServerSelectionChangeEvent(
                      boardServer,
                      location
                    )
                  );
                }}
              >
                ${map(this.boardServers, (boardServer) => {
                  return html`${map(
                    boardServer.items(),
                    ([location, store]) => {
                      const value = `${boardServer.name}::${store.url ?? location}`;
                      const isSelectedOption = value === selected;
                      return html`<option
                        .selected=${isSelectedOption}
                        .value=${value}
                      >
                        ${store.title}
                      </option>`;
                    }
                  )}`;
                })}
              </select>
              <button
                id="board-server-settings"
                @click=${() => {
                  this.showBoardServerOverflowMenu = true;
                }}
              >
                Board Server Settings
              </button>
            </div>
          </header>
          ${until(
            this.#boardServerContents,
            html`<div id="loading-message">Loading...</div>`
          )}
        </section>
      </nav>

      ${this.showBoardServerOverflowMenu
        ? html` <div
            id="overflow-menu"
            @pointerdown=${(evt: Event) => {
              evt.preventDefault();
              evt.stopImmediatePropagation();
            }}
          >
            <button
              @click=${() => {
                this.dispatchEvent(new GraphBoardServerAddEvent());
                this.showBoardServerOverflowMenu = false;
              }}
              id="add-new-board-server"
            >
              Add new Board Server
            </button>
            ${extendedCapabilities.refresh
              ? html`<button
                  @click=${() => {
                    this.showBoardServerOverflowMenu = false;
                    this.dispatchEvent(
                      new GraphBoardServerRefreshEvent(
                        this.selectedBoardServer,
                        this.selectedLocation
                      )
                    );
                  }}
                  id="refresh-board-server"
                >
                  Refresh Board Server
                </button>`
              : nothing}
            ${extendedCapabilities.disconnect
              ? html`<button
                  @click=${() => {
                    if (
                      !confirm(
                        "Are you sure you want to remove this Board Server?"
                      )
                    ) {
                      return;
                    }
                    this.dispatchEvent(
                      new GraphBoardServerDisconnectEvent(
                        this.selectedBoardServer,
                        this.selectedLocation
                      )
                    );
                    this.showBoardServerOverflowMenu = false;
                    this.#returnToDefaultStore();
                  }}
                  id="remove-board-server"
                >
                  Remove Board Server
                </button>`
              : nothing}
          </div>`
        : nothing}`;
  }
}
