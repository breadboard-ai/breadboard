/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as StringsHelper from "../../strings/helper.js";
const Strings = StringsHelper.forSection("ProjectListing");

import { LitElement, html, css, nothing, PropertyValueMap } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import {
  GraphBoardServerAddEvent,
  GraphBoardServerBlankBoardEvent,
  GraphBoardServerDisconnectEvent,
  GraphBoardServerLoadRequestEvent,
  GraphBoardServerRefreshEvent,
  GraphBoardServerRenewAccessRequestEvent,
  GraphBoardServerSelectionChangeEvent,
} from "../../events/events";
import { map } from "lit/directives/map.js";
import { classMap } from "lit/directives/class-map.js";
import { until } from "lit/directives/until.js";
import { BoardServer, GraphProviderStore } from "@google-labs/breadboard";
import { createRef, ref, Ref } from "lit/directives/ref.js";

const SHOW_OTHER_PEOPLES_BOARDS_KEY =
  "bb-project-listing-show-other-peoples-boards";

interface Guides {
  title: string;
  description: string;
  url: string;
  image?: string;
}

@customElement("bb-project-listing")
export class ProjectListing extends LitElement {
  @property()
  boardServers: BoardServer[] = [];

  @property()
  boardServerNavState: string | null = null;

  @property({ reflect: true })
  visible = false;

  @property()
  url: string | null = null;

  @property()
  version = "dev";

  @property()
  selectedBoardServer = "Example Boards";

  @property()
  selectedLocation = "example://example-boards";

  @state()
  filter: string | null = null;

  @state()
  showOtherPeoplesBoards = false;

  @state()
  showBoardServerOverflowMenu = false;

  @state()
  guides: Guides[] = [
    {
      title: "Getting Started with Breadboard",
      description: "Learn the basics of using the Visual Editor",
      url: "https://breadboard-ai.github.io/breadboard/docs/visual-editor/",
    },
    {
      title: "Building a Librarian with the Agent Kit",
      description:
        "Learn to make a simple agent that helps us finding interesting books",
      url: "https://breadboard-ai.github.io/breadboard/docs/guides/librarian/",
    },
    {
      title: "Building our First Tool",
      description: "Create your first tool, and use it within a board",
      url: "https://breadboard-ai.github.io/breadboard/docs/guides/first-tool/",
    },
  ];

  #selectedIndex = 0;

  static styles = css`
    * {
      box-sizing: border-box;
    }

    :host {
      display: block;
      background: var(--bb-neutral-0);
    }

    header {
      display: flex;
      align-items: center;
    }

    #list-other-peoples-boards {
      whitespace: no-wrap;
      margin: 0 var(--bb-grid-size) 0 var(--bb-grid-size-2);
    }

    #content {
      width: 100%;
      height: 100%;
      overflow: auto;
    }

    #wrapper {
      width: 60vw;
      min-width: 540px;
      max-width: 800px;
      height: 100%;
      margin: 0 auto;
      padding: var(--bb-grid-size-6) var(--bb-grid-size-2)
        var(--bb-grid-size-16) var(--bb-grid-size-2);
    }

    #board-listing {
      height: calc(100% - 280px);
      overflow: auto;
    }

    table {
      width: 100%;
      overflow: auto;
      position: relative;
    }

    thead tr {
      z-index: 1;
      background: var(--bb-neutral-0);
      position: sticky;
      top: 0;
      font: 400 var(--bb-label-medium) / var(--bb-label-line-height-medium)
        var(--bb-font-family);
    }

    thead tr td {
      padding: var(--bb-grid-size) 0;
      border-bottom: 1px solid var(--bb-neutral-400);
    }

    tbody tr:first-of-type td {
      padding-top: var(--bb-grid-size-2);
    }

    tbody {
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
      overflow-y: scroll;
    }

    tbody tr td {
      height: var(--bb-grid-size-7);
      padding-right: var(--bb-grid-size-2);
    }

    td {
      max-width: 200px;
    }

    td:has(.description) {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    td:has(.version) {
      max-width: 10px;
    }

    td:has(.tool) {
      max-width: 45px;
    }

    td:has(.board) {
      max-width: 90px;
    }

    #guides {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      column-gap: var(--bb-grid-size-3);
    }

    #guides h1 {
      font: 400 var(--bb-label-medium) / var(--bb-label-line-height-medium)
        var(--bb-font-family);
      grid-column: 1 / 4;
      margin: var(--bb-grid-size-6) 0 var(--bb-grid-size-2) 0;
    }

    .guide {
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
    }

    .guide a {
      background: var(--bb-ui-50);
      border-radius: var(--bb-grid-size);
      display: block;
      height: 100%;
      padding: var(--bb-grid-size-3);
      color: var(--bb-neutral-700);
      text-decoration: none;
      transition: background 0.2s cubic-bezier(0, 0, 0.3, 1);
    }

    .guide a:hover,
    .guide a:focus {
      background: var(--bb-ui-100);
    }

    .guide h2 {
      margin: 0 var(--bb-grid-size-3) 0 0;
      font: 400 var(--bb-label-large) / var(--bb-label-line-height-large)
        var(--bb-font-family);
    }

    .guide p {
      margin: var(--bb-grid-size) 0 var(--bb-grid-size-2) 0;
    }

    #container {
      display: flex;
      padding: 0 0 var(--bb-grid-size) 0;
      flex-direction: column;
      height: 100%;
    }

    #buttons {
      padding: 0 0 var(--bb-grid-size-7);
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

    #locations {
      margin-bottom: var(--bb-grid-size-4);
    }

    #locations label {
      margin-right: var(--bb-grid-size-2);
    }

    #search {
      flex: 1;
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

    .board {
      background: none;
      border: none;
      color: var(--bb-ui-600);
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-medium)
        var(--bb-font-family);
      position: relative;
      margin-right: var(--bb-grid-size-2);
      cursor: pointer;
      padding: 0;
      height: 100%;
      text-align: left;
      display: flex;
      align-items: center;
    }

    .tool,
    .published {
      display: inline-block;
      opacity: 0.3;
      width: 20px;
      height: 20px;
      margin-right: var(--bb-grid-size);
      font-size: 0;
      background: red;
    }

    .tool {
      background: transparent var(--bb-icon-tool) center center / 20px 20px
        no-repeat;
    }

    .published {
      background: transparent var(--bb-icon-public) center center / 20px 20px
        no-repeat;
    }

    .tool.active,
    .published.active {
      opacity: 1;
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
      top: 84px;
      left: calc(50% - 30vw);
      position: absolute;
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

    #new-board {
      background: var(--bb-neutral-50) var(--bb-icon-add) 12px center / 20px
        20px no-repeat;
      border: 1px solid var(--bb-neutral-300);
      font: 400 var(--bb-label-medium) / var(--bb-label-line-height-medium)
        var(--bb-font-family);
      color: var(--bb-neutral-700);
      padding: var(--bb-grid-size-2) var(--bb-grid-size-6) var(--bb-grid-size-2)
        var(--bb-grid-size-10);
      border-radius: var(--bb-grid-size-12);
      display: flex;
      justify-content: flex-end;
      align-items: center;
      cursor: pointer;
      transition: background-color 0.3s cubic-bezier(0, 0, 0.3, 1);
    }

    #new-board:hover,
    #new-board:focus {
      background-color: var(--bb-neutral-300);
    }

    #location-selector-container {
      display: flex;
      align-items: center;
      flex: 1;
    }

    #location-selector {
      border: none;
      font: 400 var(--bb-title-medium) / var(--bb-title-line-height-medium)
        var(--bb-font-family);
      padding: var(--bb-grid-size-2) 0;
    }

    #location-selector:focus {
      outline: none;
      background: var(--bb-ui-50);
    }

    .no-value {
      color: var(--bb-neutral-500);
      font-style: italic;
    }

    #app-version {
      font: 400 var(--bb-body-x-small) / var(--bb-body-line-height-x-small)
        var(--bb-font-family);
      position: absolute;
      bottom: var(--bb-grid-size-2);
      right: var(--bb-grid-size-2);
    }

    summary::-webkit-details-marker {
      display: none;
    }

    summary {
      list-style: none;
      font: 400 var(--bb-title-small) / var(--bb-title-line-height-small)
        var(--bb-font-family);
      height: var(--bb-grid-size-7);
      color: var(--bb-neutral-700);
      user-select: none;
    }

    details {
      margin-bottom: var(--bb-grid-size-2);
    }

    @media (min-width: 840px) {
      #wrapper {
        display: grid;
        width: 90vw;
        grid-template-columns: 1fr 260px;
        max-width: 1440px;
        column-gap: var(--bb-grid-size-6);
      }

      #content {
        height: calc(100% - 120px);
      }

      #board-listing {
        height: 100%;
      }

      #guides {
        grid-template-columns: auto;
        row-gap: var(--bb-grid-size-3);
        border-left: 1px solid var(--bb-neutral-100);
        padding: var(--bb-grid-size-4);
      }

      #guides h1 {
        margin: var(--bb-grid-size) 0 0 0;
        font: 400 var(--bb-title-medium) / var(--bb-title-line-height-medium)
          var(--bb-font-family);
        align-self: end;
      }

      .guide {
        grid-column: 1 / 4;
        max-width: 240px;
      }
    }
  `;

  #wrapperRef: Ref<HTMLDivElement> = createRef();
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
    if (!this.#wrapperRef.value) {
      return;
    }

    const selected =
      this.#wrapperRef.value.querySelector<HTMLButtonElement>(
        "button.selected"
      );
    selected?.classList.remove("selected");

    const boardList =
      this.#wrapperRef.value.querySelectorAll<HTMLButtonElement>(
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
    if (!this.#wrapperRef.value) {
      return;
    }

    const selected =
      this.#wrapperRef.value.querySelector<HTMLButtonElement>(
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
    if (!this.#wrapperRef.value) {
      return;
    }

    const selected =
      this.#wrapperRef.value.querySelector<HTMLButtonElement>(
        "button.selected"
      );
    if (!selected) {
      console.log("lol");
      return;
    }

    const { url, boardServer } = selected.dataset;
    if (!url) {
      return;
    }

    this.dispatchEvent(
      new GraphBoardServerLoadRequestEvent(boardServer ?? "", url)
    );
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
      return html`<nav id="menu">
        ${Strings.from("ERROR_LOADING_PROJECTS")}
      </nav>`;
    }

    const extendedCapabilities = boardServer.extendedCapabilities();

    const selected = this.#createUrl(
      this.selectedBoardServer,
      this.selectedLocation
    );

    return html` <div id="wrapper" ${ref(this.#wrapperRef)}>
        <div id="board-listing">
          <div id="buttons">
            <div id="new-board-container">
              <button
                id="new-board"
                @click=${() => {
                  this.dispatchEvent(new GraphBoardServerBlankBoardEvent());
                }}
              >
                ${Strings.from("COMMAND_NEW_PROJECT")}
              </button>
            </div>
          </div>

          <div id="locations">
            <div id="location-selector-container">
              <select
                id="location-selector"
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
                ${Strings.from("LABEL_PROJECT_SERVER_SETTINGS")}
              </button>
            </div>
            <div id="search-container">
              <input
                type="search"
                id="search"
                placeholder="${Strings.from("LABEL_SEARCH_BOARDS")}"
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
              <label for="list-other-peoples-boards"
                >${Strings.from("LABEL_LIST_OTHERS_PROJECTS")}</label
              >
            </div>
          </div>
          <div id="content">
            <div id="container">
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
                    return html`<tr>
                      <td>
                        <button
                          @pointerover=${() => {
                            this.#selectedIndex = itemIdx;
                            this.#highlightSelectedBoard();
                          }}
                          @click=${(evt: PointerEvent) => {
                            const isMac =
                              navigator.platform.indexOf("Mac") === 0;
                            const isCtrlCommand = isMac
                              ? evt.metaKey
                              : evt.ctrlKey;

                            this.dispatchEvent(
                              new GraphBoardServerLoadRequestEvent(
                                boardServer.name,
                                url,
                                isCtrlCommand
                              )
                            );
                          }}
                          data-board-server=${boardServer.name}
                          data-url=${url}
                          class=${classMap({
                            mine,
                            board: true,
                          })}
                          title=${url}
                        >
                          ${title ?? name}
                        </button>
                      </td>
                      <td>
                        ${version
                          ? html`<span class="version">${version}</span>`
                          : html`<span class="no-value"
                              >${Strings.from("LABEL_NO_VERSION")}</span
                            >`}
                      </td>

                      <td>
                        ${description
                          ? html`<span class="description"
                              >${description}</span
                            >`
                          : html`<span class="no-value"
                              >${Strings.from("LABEL_NO_DESCRIPTION")}</span
                            >`}
                      </td>

                      <td>
                        <span
                          class=${classMap({
                            tool: true,
                            active: tags?.includes("tool") ?? false,
                          })}
                          >Tool</span
                        >
                        <span
                          class=${classMap({
                            published: true,
                            active: tags?.includes("published") ?? false,
                          })}
                          >Published</span
                        >
                      </td>

                      ${this.showOtherPeoplesBoards
                        ? html` <td class="username">
                            ${mine
                              ? "You"
                              : username
                                ? `@${username}`
                                : html`<span class="no-value"
                                    >${Strings.from("LABEL_NO_OWNER")}</span
                                  >`}
                          </td>`
                        : nothing}
                    </tr>`;
                  };

                  const myBoards = html` <table cellspacing="0" class="mine">
                    <thead>
                      <tr>
                        <td>${Strings.from("LABEL_TABLE_HEADER_NAME")}</td>
                        <td>${Strings.from("LABEL_TABLE_HEADER_VERSION")}</td>
                        <td>
                          ${Strings.from("LABEL_TABLE_HEADER_DESCRIPTION")}
                        </td>
                        <td>${Strings.from("LABEL_TABLE_HEADER_TAGS")}</td>
                        ${this.showOtherPeoplesBoards
                          ? html`<td>
                              ${Strings.from("LABEL_TABLE_HEADER_DESCRIPTION")}
                            </td>`
                          : nothing}
                      </tr>
                    </thead>
                    <tbody>
                      ${map(myItems, renderBoards)}
                    </tbody>
                  </table>`;

                  const otherBoards = html`<table
                    cellspacing="0"
                    class="other-boards"
                  >
                    <thead>
                      <tr>
                        <td>${Strings.from("LABEL_TABLE_HEADER_NAME")}</td>
                        <td>${Strings.from("LABEL_TABLE_HEADER_VERSION")}</td>
                        <td>
                          ${Strings.from("LABEL_TABLE_HEADER_DESCRIPTION")}
                        </td>
                        <td>${Strings.from("LABEL_TABLE_HEADER_TAGS")}</td>
                        ${this.showOtherPeoplesBoards
                          ? html`<td>
                              ${Strings.from("LABEL_TABLE_HEADER_DESCRIPTION")}
                            </td>`
                          : nothing}
                      </tr>
                    </thead>
                    <tbody>
                      ${map(otherItems, renderBoards)}
                    </tbody>
                  </table>`;

                  let boardListing;
                  if (myItems.length > 0 && otherItems.length > 0) {
                    boardListing = html`<div class="boards">
                      <details open>
                        <summary>
                          ${Strings.from(
                            "LABEL_TABLE_DESCRIPTION_YOUR_PROJECTS"
                          )}
                        </summary>
                        ${myBoards}
                      </details>
                      <details open>
                        <summary>
                          ${Strings.from(
                            "LABEL_TABLE_DESCRIPTION_OTHER_PEOPLES_PROJECTS"
                          )}
                        </summary>
                        ${otherBoards}
                      </details>
                    </div>`;
                  } else if (myItems.length > 0 && otherItems.length === 0) {
                    boardListing = html`<div class="boards">${myBoards}</div>`;
                  } else if (myItems.length === 0 && otherItems.length > 0) {
                    boardListing = html`<div class="boards">
                      ${otherBoards}
                    </div>`;
                  } else {
                    boardListing = html`<div id="empty-board-server">
                      ${Strings.from("LABEL_NO_PROJECTS_FOUND")}
                    </div>`;
                  }

                  return permission === "granted"
                    ? boardListing
                    : html`<div id="renew-access">
                        <span
                          >${Strings.from(
                            "LABEL_ACCESS_EXPIRED_PROJECT_SERVER"
                          )}</span
                        >
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
                          ${Strings.from("COMMAND_RENEW_ACCESS")}
                        </button>
                      </div>`;
                }),
                html`<div id="loading-message">
                  ${Strings.from("STATUS_LOADING")}
                </div>`
              )}
            </div>
          </div>
        </div>
        <div>
          <section id="guides">
            <h1>${Strings.from("LABEL_FEATURED_GUIDES")}</h1>
            ${map(this.guides, (guide) => {
              return html`<div class="guide">
                <a href="${guide.url}">
                  <h2>${guide.title}</h2>
                  <p>${guide.description}</p>
                </a>
              </div>`;
            })}
          </section>
        </div>
      </div>

      <div id="app-version">
        ${Strings.from("LABEL_APP_VERSION")} ${this.version}
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
              ${Strings.from("COMMAND_ADD_NEW_PROJECT_SERVER")}
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
                  ${Strings.from("COMMAND_REFRESH_PROJECT_SERVER")}
                </button>`
              : nothing}
            ${extendedCapabilities.disconnect
              ? html`<button
                  @click=${() => {
                    if (!confirm(Strings.from("QUERY_CONFIRM_REMOVE_SERVER"))) {
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
                  ${Strings.from("COMMAND_REMOVE_PROJECT_SERVER")}
                </button>`
              : nothing}
          </div>`
        : nothing}`;
  }
}
