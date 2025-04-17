/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css, nothing, PropertyValueMap } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { Overlay } from "./overlay.js";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import {
  GraphBoardServerAddEvent,
  GraphBoardServerBlankBoardEvent,
  GraphBoardServerDisconnectEvent,
  GraphBoardServerLoadRequestEvent,
  GraphBoardServerRefreshEvent,
  GraphBoardServerRenewAccessRequestEvent,
  GraphBoardServerSelectionChangeEvent,
  OverlayDismissedEvent,
} from "../../events/events.js";
import { BoardServer, GraphProviderStore } from "@google-labs/breadboard";
import { map } from "lit/directives/map.js";
import { classMap } from "lit/directives/class-map.js";
import { until } from "lit/directives/until.js";

const SHOW_OTHER_PEOPLES_BOARDS_KEY =
  "bb-open-board-overlay-show-other-peoples-boards";

@customElement("bb-open-board-overlay")
export class OpenBoardOverlay extends LitElement {
  @property()
  accessor boardServers: BoardServer[] = [];

  @property()
  accessor boardServerNavState: string | null = null;

  @property({ reflect: true })
  accessor visible = false;

  @property()
  accessor url: string | null = null;

  @property()
  accessor selectedBoardServer = "Example Boards";

  @property()
  accessor selectedLocation = "example://example-boards";

  @state()
  accessor filter: string | null = null;

  @state()
  accessor showOtherPeoplesBoards = false;

  @state()
  accessor showBoardServerOverflowMenu = false;

  #selectedIndex = 0;

  static styles = css`
    * {
      box-sizing: border-box;
    }

    :host {
      display: block;
      position: fixed;
      z-index: 20;
    }

    header {
      display: flex;
      align-items: center;
    }

    #list-other-peoples-boards {
      whitespace: no-wrap;
      margin: 0 var(--bb-grid-size) 0 var(--bb-grid-size-6);
    }

    h1 {
      width: 100%;
      display: flex;
      align-items: center;
      font: 400 var(--bb-title-medium) / var(--bb-title-line-height-medium)
        var(--bb-font-family);
      padding: var(--bb-grid-size-3) var(--bb-grid-size-4);
      margin: 0;
      text-align: left;
      border-bottom: 1px solid var(--bb-neutral-300);
      user-select: none;
    }

    h1::before {
      content: "";
      display: block;
      width: 20px;
      height: 20px;
      background: transparent var(--bb-icon-open-new) center center / 20px 20px
        no-repeat;
      margin-right: var(--bb-grid-size-2);
    }

    h1 span {
      flex: 1;
    }

    #content {
      width: 100%;
      max-height: none;
      flex: 1;
      overflow-y: auto;
    }

    #wrapper {
      width: 60vw;
      min-width: 410px;
      max-width: 660px;
      height: 60vh;
      min-height: 250px;
      max-height: 550px;
      display: flex;
      flex-direction: column;
      overflow: auto;
      container-type: size;
    }

    #container {
      display: flex;
      padding: var(--bb-grid-size-4) var(--bb-grid-size-4) var(--bb-grid-size)
        var(--bb-grid-size-4);
      flex-direction: column;
      height: 100%;
      overflow: auto;
    }

    #buttons {
      padding: var(--bb-grid-size-2) var(--bb-grid-size-4) var(--bb-grid-size-4)
        var(--bb-grid-size-4);
      display: flex;
      justify-content: flex-end;
      align-items: center;
    }

    #buttons > div {
      display: flex;
      flex-shrink: 0;
    }

    #new-board-container {
      display: flex;
      flex: 1 1 auto;
      align-items: center;
    }

    #search-container,
    #locations {
      display: flex;
      align-items: center;
    }

    #locations label {
      margin-right: var(--bb-grid-size-2);
    }

    #search {
      flex: 1;
    }

    #cancel {
      background: transparent;
      border: none;
      font: 400 var(--bb-title-small) / var(--bb-title-line-height-small)
        var(--bb-font-family);
      color: var(--bb-neutral-500);
      margin-right: var(--bb-grid-size-2);
    }

    #open {
      background: var(--bb-ui-500);
      border: none;
      font: 400 var(--bb-title-small) / var(--bb-title-line-height-small)
        var(--bb-font-family);
      color: var(--bb-neutral-0);
      padding: var(--bb-grid-size) var(--bb-grid-size-4) var(--bb-grid-size)
        var(--bb-grid-size-2);
      border-radius: var(--bb-grid-size-12);
      display: flex;
      justify-content: flex-end;
      align-items: center;
      cursor: pointer;
      transition: background-color 0.3s cubic-bezier(0, 0, 0.3, 1);
    }

    #open::before {
      content: "";
      display: block;
      width: 20px;
      height: 20px;
      background: transparent var(--bb-icon-check-inverted) center center / 20px
        20px no-repeat;
      margin-right: var(--bb-grid-size-2);
    }

    #open:hover,
    #open:focus {
      background: var(--bb-ui-600);
      transition-duration: 0.1s;
    }

    input[type="text"],
    input[type="search"],
    select,
    textarea {
      padding: var(--bb-grid-size-2) var(--bb-grid-size-3);
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
      border: 1px solid var(--bb-neutral-300);
      border-radius: var(--bb-grid-size);
    }

    textarea {
      resize: none;
      field-sizing: content;
      max-height: 300px;
    }

    label {
      font: 400 var(--bb-label-medium) / var(--bb-label-line-height-medium)
        var(--bb-font-family);
    }

    .boards {
      overflow-y: scroll;
      padding: var(--bb-grid-size-6) var(--bb-grid-size);
    }

    menu {
      padding: 0;
      margin: 0;
      list-style: none;
    }

    menu li {
      margin-bottom: var(--bb-grid-size-2);
      width: 100%;
      display: flex;
    }

    .title-container {
      display: flex;
      align-items: center;
    }

    .version {
      color: var(--bb-ui-500);
      font: 600 var(--bb-body-x-small) / var(--bb-body-line-height-x-small)
        var(--bb-font-family-mono);
      padding: var(--bb-grid-size) var(--bb-grid-size-2);
      border-radius: var(--bb-grid-size-10);
      background: var(--bb-ui-50);
      margin-left: var(--bb-grid-size-2);
    }

    .tags {
      color: var(--bb-inputs-600);
      font: 600 var(--bb-body-x-small) / var(--bb-body-line-height-x-small)
        var(--bb-font-family-mono);
      padding: var(--bb-grid-size) var(--bb-grid-size-2);
      border-radius: var(--bb-grid-size-10);
      background: var(--bb-inputs-50);
      margin-left: var(--bb-grid-size-2);
    }

    .username {
      color: var(--bb-looper-600);
      font: 600 var(--bb-body-x-small) / var(--bb-body-line-height-x-small)
        var(--bb-font-family-mono);
      padding: var(--bb-grid-size) var(--bb-grid-size-2);
      border-radius: var(--bb-grid-size-10);
      background: var(--bb-looper-50);
      margin-left: var(--bb-grid-size-2);
    }

    .board {
      flex: 1 1 auto;
      background: none;
      border: none;
      color: var(--bb-neutral-900);
      font: 400 var(--bb-body-medium) / var(--bb-body-line-height-medium)
        var(--bb-font-family);
      padding: 0 var(--bb-grid-size-3) 0 var(--bb-grid-size-9);
      position: relative;
      min-height: var(--bb-grid-size-7);
      margin-right: var(--bb-grid-size-2);
    }

    .board .description,
    .board .title-container {
      flex: 1 0 auto;
    }

    .board .description {
      color: var(--bb-neutral-600);
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
      text-align: left;
      margin: var(--bb-grid-size) 0 var(--bb-grid-size-3) 0;
      max-width: 80%;
    }

    .board::after {
      content: "";
      order: 0;
      width: var(--bb-grid-size-7);
      height: var(--bb-grid-size-7);
      background: var(--bb-neutral-50) var(--bb-icon-draft) center center / 20px
        20px no-repeat;
      position: absolute;
      left: 0;
      top: 0;
      border-radius: var(--bb-grid-size);
    }

    .board.selected::before {
      content: "";
      background: var(--bb-ui-50);
      z-index: -1;
      order: 1;
      position: absolute;
      left: 0;
      top: 0;
      width: 100%;
      height: 100%;
      border-radius: var(--bb-grid-size);
      box-shadow: 0 0 0 4px var(--bb-ui-50);
    }

    .board.selected::after,
    .board.selected .version {
      background-color: var(--bb-neutral-0);
    }

    summary::-webkit-details-marker {
      display: none;
    }

    summary {
      list-style: none;
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
      height: var(--bb-grid-size-7);
      color: var(--bb-neutral-600);
      user-select: none;
    }

    details {
      margin-bottom: var(--bb-grid-size-2);
    }

    #board-server-settings {
      width: 32px;
      height: 32px;
      background: var(--bb-neutral-100) var(--bb-icon-folder-managed) center
        center / 20px 20px no-repeat;
      border-radius: var(--bb-grid-size);
      border: none;
      font-size: 0;
      flex: 0 0 auto;
      margin-left: var(--bb-grid-size);
    }

    #overflow-menu {
      z-index: 1000;
      display: grid;
      grid-template-rows: var(--bb-grid-size-11);
      top: 54px;
      right: 16px;
      position: absolute;
      box-shadow:
        0px 4px 8px 3px rgba(0, 0, 0, 0.05),
        0px 1px 3px rgba(0, 0, 0, 0.1);
      background: var(--bb-neutral-0);
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

    #new-board {
      background: var(--bb-neutral-100);
      border: none;
      font: 400 var(--bb-title-small) / var(--bb-title-line-height-small)
        var(--bb-font-family);
      color: var(--bb-neutral-800);
      padding: var(--bb-grid-size) var(--bb-grid-size-4) var(--bb-grid-size)
        var(--bb-grid-size-2);
      border-radius: var(--bb-grid-size-12);
      display: flex;
      justify-content: flex-end;
      align-items: center;
      cursor: pointer;
      transition: background-color 0.3s cubic-bezier(0, 0, 0.3, 1);
    }

    #new-board::before {
      content: "";
      background: var(--bb-icon-add) center center / 20px 20px no-repeat;
      width: 20px;
      height: 20px;
      margin-right: var(--bb-grid-size);
    }

    #new-board:hover,
    #new-board:focus {
      background-color: var(--bb-neutral-300);
    }
  `;

  #overlayRef: Ref<Overlay> = createRef();
  #searchRef: Ref<HTMLInputElement> = createRef();
  #onKeyDownBound = this.#onKeyDown.bind(this);
  #hideBoardServerOverflowMenuBound =
    this.#hideBoardServerOverflowMenu.bind(this);
  #attemptFocus = false;
  #attemptScrollUpdate = false;
  #maxIndex = 0;

  connectedCallback(): void {
    super.connectedCallback();

    this.addEventListener("keydown", this.#onKeyDownBound);
    this.addEventListener("click", this.#hideBoardServerOverflowMenuBound);

    this.showOtherPeoplesBoards =
      globalThis.localStorage.getItem(SHOW_OTHER_PEOPLES_BOARDS_KEY) === "true";
    this.#attemptFocus = true;
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();

    this.removeEventListener("keydown", this.#onKeyDownBound);
    this.removeEventListener("click", this.#hideBoardServerOverflowMenuBound);
  }

  protected willUpdate(
    changedProperties:
      | PropertyValueMap<{
          boardServerNavState: string | null;
          boardServers: BoardServer[];
          selectedBoardServer: string;
          selectedLocation: string;
          showOtherPeoplesBoards: boolean;
          filter: string | null;
        }>
      | Map<PropertyKey, unknown>
  ): void {
    if (
      changedProperties.has("boardServerNavState") ||
      changedProperties.has("boardServers") ||
      changedProperties.has("selectedLocation") ||
      changedProperties.has("selectedBoardServer") ||
      changedProperties.has("showOtherPeoplesBoards") ||
      changedProperties.has("filter")
    ) {
      this.#selectedIndex = 0;
      this.#maxIndex = 0;
      this.#boardServerContents = this.#loadBoardServerContents();
    }
  }

  protected updated(): void {
    // Wait a frame because the overlay animation seems to negate the ability to
    // focus the search control and scroll the contents.
    requestAnimationFrame(() => {
      this.#highlightSelectedBoard();

      if (this.#attemptFocus) {
        this.#attemptFocus = false;
        this.#focusSearchField();
      }
    });
  }

  #hideBoardServerOverflowMenu(evt: Event) {
    if (evt instanceof KeyboardEvent && evt.key !== "Escape") {
      return;
    }

    evt.stopImmediatePropagation();
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

  #highlightSelectedBoard() {
    if (!this.#overlayRef.value) {
      return;
    }

    const selected =
      this.#overlayRef.value.querySelector<HTMLButtonElement>(
        "button.selected"
      );
    selected?.classList.remove("selected");

    const boardList =
      this.#overlayRef.value.querySelectorAll<HTMLButtonElement>(
        `button.board`
      );

    const newlySelected = boardList[this.#selectedIndex];
    newlySelected?.classList.add("selected");

    if (!this.#attemptScrollUpdate) {
      return;
    }
    this.#attemptScrollUpdate = false;
    this.#scrollToSelectedBoard();
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

  #boardServerContents: Promise<GraphProviderStore | null> =
    Promise.resolve(null);
  async #loadBoardServerContents() {
    const boardServer =
      this.boardServers.find(
        (boardServer) => boardServer.name === this.selectedBoardServer
      ) || this.boardServers[0];

    if (!boardServer) {
      this.#returnToDefaultStore();
      return null;
    }

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
      return null;
    }

    return store;
  }

  #scrollToSelectedBoard() {
    if (!this.#overlayRef.value) {
      return;
    }

    const selected =
      this.#overlayRef.value.querySelector<HTMLButtonElement>(
        "button.selected"
      );
    if (!selected) {
      return;
    }

    selected.scrollIntoView({
      behavior: "instant",
      block: "nearest",
      inline: "nearest",
    });
  }

  #focusSearchField() {
    if (!this.#searchRef.value) {
      return;
    }

    this.#searchRef.value.select();
  }

  #emitSelectedBoard() {
    if (!this.#overlayRef.value) {
      return;
    }

    const selected =
      this.#overlayRef.value.querySelector<HTMLButtonElement>(
        "button.selected"
      );
    if (!selected) {
      console.log("lol");
      return;
    }

    const { url } = selected.dataset;
    if (!url) {
      return;
    }

    this.dispatchEvent(new GraphBoardServerLoadRequestEvent(url));
  }

  #onKeyDown(evt: KeyboardEvent) {
    if (
      !this.shadowRoot ||
      !this.shadowRoot.activeElement ||
      !(this.shadowRoot.activeElement instanceof HTMLElement)
    ) {
      return;
    }

    switch (evt.key) {
      case "Escape": {
        if (this.showBoardServerOverflowMenu) {
          this.#hideBoardServerOverflowMenu(evt);
        }
        break;
      }

      case "Enter": {
        this.#emitSelectedBoard();
        break;
      }

      case "ArrowUp": {
        this.#selectedIndex = this.#clamp(
          this.#selectedIndex - 1,
          0,
          this.#maxIndex
        );

        this.#attemptScrollUpdate = true;
        this.#highlightSelectedBoard();
        break;
      }

      case "Tab":
      case "ArrowDown": {
        evt.preventDefault();

        this.#selectedIndex = this.#clamp(
          this.#selectedIndex + 1,
          0,
          this.#maxIndex
        );

        this.#attemptScrollUpdate = true;
        this.#highlightSelectedBoard();
        break;
      }
    }
  }

  #clamp(value: number, min: number, max: number) {
    if (value < min) {
      value = min;
    }

    if (value > max) {
      value = max;
    }

    return value;
  }

  #createUrl(boardServer: string, location: string) {
    return `${boardServer}::${location}`;
  }

  #parseUrl(url: string) {
    return url.split("::");
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

    return html`<bb-overlay ${ref(this.#overlayRef)}>
      <div id="wrapper">
        <h1>
          <span>Open Board...</span>
          <div id="locations">
            <label for="locations">Location</label>
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
                return html`${map(boardServer.items(), ([location, store]) => {
                  const value = `${boardServer.name}::${store.url ?? location}`;
                  const isSelectedOption = value === selected;
                  return html`<option
                    .selected=${isSelectedOption}
                    .value=${value}
                  >
                    ${store.title}
                  </option>`;
                })}`;
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
        </h1>
        <div id="content">
          <div id="container">
            <header>
              <input
                type="search"
                id="search"
                placeholder="Search boards"
                autocomplete="off"
                ${ref(this.#searchRef)}
                @input=${(evt: InputEvent) => {
                  if (!(evt.target instanceof HTMLInputElement)) {
                    return;
                  }

                  this.filter = evt.target.value;
                }}
              />

              <input
                id="list-other-peoples-boards"
                type="checkbox"
                ?checked=${this.showOtherPeoplesBoards}
                @click=${(evt: Event) => {
                  if (!(evt.target instanceof HTMLInputElement)) {
                    return;
                  }

                  this.showOtherPeoplesBoards = evt.target.checked;
                  globalThis.localStorage.setItem(
                    SHOW_OTHER_PEOPLES_BOARDS_KEY,
                    `${this.showOtherPeoplesBoards}`
                  );
                }}
              />
              <label for="list-other-peoples-boards">List others' boards</label>
            </header>

            ${until(
              this.#boardServerContents.then((store) => {
                if (!store) {
                  return nothing;
                }

                const { permission } = store;

                // Divide the items into two buckets: those that belong to the user and
                // other published boards.
                const items = [...store.items].filter(([name, item]) => {
                  const canShow =
                    this.showOtherPeoplesBoards ||
                    item.mine ||
                    store.title === "Example Boards" ||
                    store.title === "Playground Boards";

                  if (!this.filter) {
                    return canShow;
                  }
                  const filter = new RegExp(this.filter, "gim");
                  return filter.test(name) && canShow;
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

                this.#maxIndex = Math.max(
                  0,
                  myItems.length + otherItems.length - 1
                );

                let idx = 0;
                type BoardInfo = (typeof items)[0];
                const renderBoards = ([
                  name,
                  { url, mine, tags, title, username, version, description },
                ]: BoardInfo) => {
                  const itemIdx = idx++;
                  const visibleTags = (tags ?? []).filter(
                    (tag) => mine || tag !== "published"
                  );

                  return html`<li>
                    <button
                      @pointerover=${() => {
                        this.#selectedIndex = itemIdx;
                        this.#highlightSelectedBoard();
                      }}
                      @click=${() => {
                        this.dispatchEvent(
                          new GraphBoardServerLoadRequestEvent(url)
                        );
                      }}
                      data-board-server=${boardServer.name}
                      data-url=${url}
                      class=${classMap({
                        mine,
                        board: true,
                        tool: tags?.includes("tool") ?? false,
                        published: tags?.includes("published") ?? false,
                      })}
                      title=${url}
                    >
                      <div class="title-container">
                        <span class="name">${title ?? name}</span>
                        ${version
                          ? html`<span class="version">${version}</span>`
                          : nothing}
                        ${visibleTags && visibleTags.length > 0
                          ? html`<span class="tags"
                              >${visibleTags.join(", ")}</span
                            >`
                          : ""}
                        ${username && !mine
                          ? html`<span class="username">@${username}</span>`
                          : ""}
                      </div>
                      ${description
                        ? html`<div class="description">${description}</div>`
                        : nothing}
                    </button>
                  </li>`;
                };

                const myBoards = html` <menu class="mine">
                  ${map(myItems, renderBoards)}
                </menu>`;

                const otherBoards = html`<menu class="other-boards">
                  ${map(otherItems, renderBoards)}
                </menu>`;

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
                    No boards found
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
              }),
              html`<div id="loading-message">Loading...</div>`
            )}
          </div>
        </div>
        <div id="buttons">
          <div id="new-board-container">
            <button
              id="new-board"
              @click=${() => {
                this.dispatchEvent(new GraphBoardServerBlankBoardEvent());
              }}
            >
              New board
            </button>
          </div>
          <div>
            <button
              id="cancel"
              @click=${() => {
                this.dispatchEvent(new OverlayDismissedEvent());
              }}
            >
              Cancel
            </button>
            <button id="open" @click=${() => {}}>Open</button>
          </div>
        </div>
      </div>

      ${this.showBoardServerOverflowMenu
        ? html` <div id="overflow-menu">
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
        : nothing}
    </bb-overlay>`;
  }
}
