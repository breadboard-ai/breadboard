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
  accessor boardServers: BoardServer[] = [];

  @property()
  accessor boardServerNavState: string | null = null;

  @property({ reflect: true })
  accessor visible = false;

  @property()
  accessor url: string | null = null;

  @property()
  accessor version = "dev";

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

  @state()
  accessor showAdditionalSources = true;

  @state()
  accessor breakPoint = 0;

  @state()
  accessor guides: Guides[] = [
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

  #resizeObserver = new ResizeObserver((entries) => {
    const entry = entries[0];
    let items = 1;
    if (entry.contentRect.width >= 480) items = 2;
    if (entry.contentRect.width >= 800) items = 3;
    if (entry.contentRect.width >= 1080) items = 4;

    this.breakPoint = items;
  });

  static styles = css`
    * {
      box-sizing: border-box;
    }

    :host {
      display: block;
      background: var(--bb-neutral-0);
    }

    #wrapper {
      margin: 0 auto;
      padding: var(--bb-grid-size-8);
      width: 100%;
      max-width: 1200px;

      & #no-projects {
        color: var(--bb-neutral-700);
        font: 400 var(--bb-body-medium) / var(--bb-body-line-height-medium)
          var(--bb-font-family);
        margin-bottom: var(--bb-grid-size-4);

        & p {
          margin: 0 0 var(--bb-grid-size) 0;
          text-align: center;
        }
      }

      & h1 {
        margin: var(--bb-grid-size-5) 0;
        padding: 0;
        font: 400 var(--bb-title-large) / var(--bb-title-line-height-large)
          var(--bb-font-family);
        text-align: center;
        width: 100%;
        color: var(--bb-neutral-900);
      }

      & #guides {
        display: grid;
        grid-template-columns: 1fr;
        grid-auto-rows: auto;
        column-gap: var(--bb-grid-size-10);
        row-gap: var(--bb-grid-size-2);
        margin: var(--bb-grid-size-8) 0 var(--bb-grid-size-16) 0;

        & h2 {
          margin: var(--bb-grid-size-5) 0;
          padding: 0;
          font: 400 var(--bb-title-large) / var(--bb-title-line-height-large)
            var(--bb-font-family);
          width: 100%;
          color: var(--bb-neutral-900);
          text-align: left;
        }

        .guide {
          display: flex;
          flex-direction: column;
          font: 400 var(--bb-title-small) / var(--bb-title-line-height-small)
            var(--bb-font-family);
          color: var(--bb-neutral-900);
          background: transparent;
          border: 1px solid var(--bb-neutral-300);
          outline: 1px solid transparent;
          border-radius: var(--bb-grid-size-2);
          cursor: pointer;
          transition:
            background 0.2s cubic-bezier(0, 0, 0.3, 1),
            border 0.2s cubic-bezier(0, 0, 0.3, 1),
            outline 0.2s cubic-bezier(0, 0, 0.3, 1);
          align-items: center;
          text-decoration: none;
          width: 100%;
          overflow: hidden;

          & .img {
            display: none;
          }

          & .title,
          & .description {
            display: block;
            width: 100%;
            text-align: left;
          }

          & .title {
            padding: var(--bb-grid-size-4) var(--bb-grid-size-4)
              var(--bb-grid-size-2) var(--bb-grid-size-4);
            font-weight: 500;
          }

          & .description {
            padding: 0 var(--bb-grid-size-4) var(--bb-grid-size-4)
              var(--bb-grid-size-4);
          }

          &:hover,
          &:focus {
            background: var(--bb-ui-50);
          }
        }
      }

      & #buttons {
        order: 0;
      }

      & #new-project-container {
        display: flex;
        height: 80px;
        justify-content: center;

        & #new-project {
          height: 40px;
          background: var(--bb-icon-add-inverted) var(--bb-ui-500) 8px center /
            32px 32px no-repeat;
          border-radius: var(--bb-grid-size-16);
          border: none;
          color: var(--bb-neutral-0);
          font: 400 var(--bb-title-medium) / var(--bb-title-line-height-medium)
            var(--bb-font-family);
          padding: 0 var(--bb-grid-size-8) 0 var(--bb-grid-size-10);
          height: var(--bb-grid-size-10);
          transition: background 0.2s cubic-bezier(0, 0, 0.3, 1);
          cursor: pointer;

          &:hover,
          &:focus {
            background-color: var(--bb-ui-600);
          }
        }
      }

      & #location-selector-container {
        display: flex;
        align-items: center;

        & #location-selector {
          margin: var(--bb-grid-size-5) 0;
          padding: 0;
          font: 400 var(--bb-title-large) / var(--bb-title-line-height-large)
            var(--bb-font-family);
          border: none;
        }
      }

      & #list-other-peoples-boards-container {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 60px;
        font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
          var(--bb-font-family);
      }

      & #content {
        display: flex;
        flex-direction: column;

        & .boards {
          order: 1;

          &.recent {
            display: grid;
            grid-template-columns: 1fr;
            grid-auto-rows: auto;
            gap: var(--bb-grid-size-10);
            margin-bottom: var(--bb-grid-size-16);

            & button {
              width: 100%;
              height: 240px;
              border: 1px solid var(--bb-neutral-300);
              background: var(--bb-neutral-0);
              outline: 1px solid transparent;
              border-radius: var(--bb-grid-size-2);
              cursor: pointer;
              transition:
                border 0.2s cubic-bezier(0, 0, 0.3, 1),
                outline 0.2s cubic-bezier(0, 0, 0.3, 1);

              display: flex;
              flex-direction: column;
              overflow: auto;
              padding: 0;

              & .img {
                flex: 1 1 auto;
                background: url(/images/placeholder.svg) var(--bb-ui-50) center
                  center / contain no-repeat;
                width: 100%;
                border-bottom: 1px solid var(--bb-neutral-300);
              }

              & .title {
                display: block;
                color: var(--bb-neutral-900);
                font: 500 var(--bb-title-small) /
                  var(--bb-title-line-height-small) var(--bb-font-family);
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                width: 100%;
                text-align: left;
                padding: var(--bb-grid-size-3) var(--bb-grid-size-2)
                  var(--bb-grid-size) var(--bb-grid-size-3);
              }

              & .description {
                display: block;
                color: var(--bb-neutral-900);
                font: 400 var(--bb-body-small) /
                  var(--bb-body-line-height-small) var(--bb-font-family);
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                width: 100%;
                text-align: left;
                padding: 0 var(--bb-grid-size-3) var(--bb-grid-size-3)
                  var(--bb-grid-size-3);
              }

              &:hover,
              &:focus {
                border: 1px solid var(--bb-neutral-400);
                outline: 1px solid var(--bb-neutral-400);
              }
            }
          }

          &:not(.recent) {
            display: grid;
            grid-template-columns: 1fr;
            column-gap: var(--bb-grid-size-4);
            row-gap: var(--bb-grid-size);
            button {
              display: grid;
              height: var(--bb-grid-size-7);
              grid-template-columns: 1fr;
              gap: var(--bb-grid-size-3);
              font: 400 var(--bb-title-small) /
                var(--bb-title-line-height-small) var(--bb-font-family);
              color: var(--bb-neutral-900);
              background: transparent;
              border: 1px solid transparent;
              outline: 1px solid transparent;
              border-radius: var(--bb-grid-size-2);
              cursor: pointer;
              transition:
                background 0.2s cubic-bezier(0, 0, 0.3, 1),
                border 0.2s cubic-bezier(0, 0, 0.3, 1),
                outline 0.2s cubic-bezier(0, 0, 0.3, 1);
              padding: 0 var(--bb-grid-size-2);
              align-items: center;

              & .img {
                display: none;
              }

              & .title,
              & .description {
                display: block;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                width: 100%;
                text-align: left;
              }

              & .title {
                font-weight: 500;
                display: inline-block;
                align-items: center;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                padding-left: var(--bb-grid-size-7);
                background: var(--bb-add-icon-project) 0 center / 20px 20px
                  no-repeat;
              }

              & .description {
                display: none;
              }

              &:hover,
              &:focus {
                background: var(--bb-ui-50);
              }
            }
          }
        }
      }
    }

    #search-container {
      display: flex;
      justify-contents: center;

      & input {
        height: var(--bb-grid-size-14);
        border-radius: var(--bb-grid-size-16);
        font: 400 var(--bb-label-large) / var(--bb-label-line-height-large)
          var(--bb-font-family);
        padding: 0 var(--bb-grid-size-4) 0 var(--bb-grid-size-14);
        border: none;
        width: 100%;
        max-width: 680px;
        background: var(--bb-icon-search) var(--bb-ui-50) 16px center / 32px
          32px no-repeat;
        margin: 0 auto;
      }
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
      top: 190px;
      left: calc(50% - 30vw);
      position: absolute;
      box-shadow:
        0px 4px 8px 3px rgba(0, 0, 0, 0.05),
        0px 1px 3px rgba(0, 0, 0, 0.1);
      background: var(--bb-neutral-0);
      border: 1px solid var(--bb-neutral-300);
      border-radius: var(--bb-grid-size-2);
      overflow: auto;
      pointer-events: auto;

      & button {
        display: flex;
        align-items: center;
        background: none;
        margin: 0;
        padding: var(--bb-grid-size-3) var(--bb-grid-size-6)
          var(--bb-grid-size-3) var(--bb-grid-size-3);
        border: none;
        border-bottom: 1px solid var(--bb-neutral-300);
        text-align: left;
        cursor: pointer;

        &:hover,
        &:focus {
          background: var(--bb-neutral-50);
        }

        &:last-of-type {
          border: none;
        }

        &::before {
          content: "";
          width: 20px;
          height: 20px;
          margin-right: var(--bb-grid-size-3);
        }

        &#add-new-board-server::before {
          background: var(--bb-icon-add) center center / 20px 20px no-repeat;
        }

        &#rename-board-server::before {
          background: var(--bb-icon-edit) center center / 20px 20px no-repeat;
        }

        &#refresh-board-server::before {
          background: var(--bb-icon-refresh) center center / 20px 20px no-repeat;
        }

        &#remove-board-server::before {
          background: var(--bb-icon-delete) center center / 20px 20px no-repeat;
        }
      }
    }

    #app-version {
      font: 400 var(--bb-body-x-small) / var(--bb-body-line-height-x-small)
        var(--bb-font-family);
      position: relative;
      padding: var(--bb-grid-size-2);
      text-align: right;
    }

    @media (min-width: 480px) and (max-width: 799px) {
      #wrapper {
        & #content .boards.recent {
          grid-template-columns: repeat(2, 1fr);

          & button:nth-child(n + 3) {
            height: auto;
            & .img {
              display: none;
            }
          }
        }

        & #content .boards:not(.recent) {
          grid-template-columns: repeat(2, 1fr);
        }

        & #guides {
          & h2 {
            grid-column: 1 / -1;
          }

          grid-template-columns: repeat(2, 1fr);
        }
      }
    }

    @media (min-width: 800px) and (max-width: 1079px) {
      #wrapper {
        & #content .boards.recent {
          grid-template-columns: repeat(3, 1fr);

          & button:nth-child(n + 4) {
            height: auto;
            & .img {
              display: none;
            }
          }
        }

        & #content .boards:not(.recent) {
          grid-template-columns: repeat(3, 1fr);
        }

        & #guides {
          & h2 {
            grid-column: 1 / -1;
          }

          grid-template-columns: repeat(3, 1fr);
        }
      }
    }

    @media (min-width: 1080px) {
      #wrapper {
        & #content .boards.recent {
          grid-template-columns: repeat(4, 1fr);

          & button:nth-child(n + 5) {
            height: auto;
            & .img {
              display: none;
            }
          }
        }

        & #content .boards:not(.recent) {
          grid-template-columns: repeat(3, 1fr);
          row-gap: var(--bb-grid-size-6);

          & button {
            padding: var(--bb-grid-size-2);
            height: auto;
            gap: var(--bb-grid-size);

            & .description {
              display: block;
              padding-left: var(--bb-grid-size-7);
            }
          }
        }

        & #guides {
          & h2 {
            grid-column: 1 / -1;
          }

          grid-template-columns: repeat(4, 1fr);
        }
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
      this.showAdditionalSources &&
      globalThis.localStorage.getItem(SHOW_OTHER_PEOPLES_BOARDS_KEY) === "true";
    this.#attemptFocus = true;

    this.#resizeObserver.observe(this);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();

    this.removeEventListener("keydown", this.#onKeyDownBound);
    this.removeEventListener("click", this.#hideBoardServerOverflowMenuBound);

    this.#resizeObserver.disconnect();
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

  #getCurrentStoreName(url: string) {
    for (const boardServer of this.boardServers) {
      for (const [location, store] of boardServer.items()) {
        const value = `${boardServer.name}::${store.url ?? location}`;

        if (value === url) {
          return store.title;
        }
      }
    }

    return "Unknown Store";
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
        <h1>${Strings.from("LABEL_WELCOME_MESSAGE")}</h1>
        <div id="board-listing">
          <div id="locations">
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
            </div>

            ${this.showAdditionalSources
              ? html` <div id="list-other-peoples-boards-container">
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
                  /><label for="list-other-peoples-boards"
                    >${Strings.from("LABEL_LIST_OTHERS_PROJECTS")}</label
                  >
                </div>`
              : nothing}
            <div id="location-selector-container">
              ${this.showAdditionalSources
                ? html`<select
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
                    </button>`
                : html`<h2 id="location-selector">
                    ${this.#getCurrentStoreName(selected)}
                  </h2>`}
            </div>
          </div>
          <div id="content">
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
                  { url, mine, title, description },
                ]: BoardInfo) => {
                  const itemIdx = idx++;
                  return html`<button
                    @pointerover=${() => {
                      this.#selectedIndex = itemIdx;
                      this.#highlightSelectedBoard();
                    }}
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
                    data-board-server=${boardServer.name}
                    data-url=${url}
                    class=${classMap({
                      mine,
                      board: true,
                    })}
                    title=${url}
                  >
                    <span class="img"></span>
                    <span class="title"> ${title ?? name} </span>
                    <span class="description">
                      ${description ?? "No description"}
                    </span>
                  </button> `;
                };

                const myRecentBoards = this.filter
                  ? nothing
                  : html`${map(myItems.slice(0, this.breakPoint), renderBoards)}`;
                const myOtherBoards = this.filter
                  ? html`${map(myItems, renderBoards)}`
                  : html`${map(myItems.slice(this.breakPoint), renderBoards)}`;
                const otherBoards = html`${map(otherItems, renderBoards)}`;

                let boardListing;
                if (myItems.length > 0 && otherItems.length > 0) {
                  boardListing = html`<div class="boards">
                    <details open>
                      <summary>
                        ${Strings.from("LABEL_TABLE_DESCRIPTION_YOUR_PROJECTS")}
                      </summary>
                      ${myRecentBoards}
                    </details>
                    <details open>
                      <summary>
                        ${Strings.from("LABEL_TABLE_DESCRIPTION_YOUR_PROJECTS")}
                      </summary>
                      ${myOtherBoards}
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
                  boardListing = html`<div class="boards recent">
                      ${myRecentBoards}
                    </div>
                    <div class="boards">${myOtherBoards}</div>`;
                } else if (myItems.length === 0 && otherItems.length > 0) {
                  boardListing = html`<div class="boards">${otherBoards}</div>`;
                } else {
                  boardListing = html`<div id="no-projects">
                    <p>${Strings.from("LABEL_NO_PROJECTS_FOUND")}</p>
                    <p>${Strings.from("COMMAND_GET_STARTED")}</p>
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

            <div id="buttons">
              <div id="new-project-container">
                <button
                  id="new-project"
                  @click=${() => {
                    this.dispatchEvent(new GraphBoardServerBlankBoardEvent());
                  }}
                >
                  ${Strings.from("COMMAND_NEW_PROJECT")}
                </button>
              </div>
            </div>
          </div>
        </div>
        <section id="guides">
          <h2>${Strings.from("LABEL_FEATURED_GUIDES")}</h2>
          ${map(this.guides, (guide) => {
            return html` <a href="${guide.url}" class="guide">
              <span class="title">${guide.title}</span>
              <span class="description">${guide.description}</span>
            </a>`;
          })}
        </section>
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
