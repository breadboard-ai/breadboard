/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  type BoardServer,
  type GraphProviderStore,
  type GraphProviderItem,
} from "@google-labs/breadboard";
import { consume } from "@lit/context";
import { Task, TaskStatus } from "@lit/task";
import { css, html, LitElement, nothing, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { map } from "lit/directives/map.js";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import { styleMap } from "lit/directives/style-map.js";
import { until } from "lit/directives/until.js";
import {
  globalConfigContext,
  type GlobalConfig,
} from "../../contexts/global-config.js";
import {
  GraphBoardServerAddEvent,
  GraphBoardServerDisconnectEvent,
  GraphBoardServerRefreshEvent,
  GraphBoardServerRenewAccessRequestEvent,
  GraphBoardServerSelectionChangeEvent,
  StateEvent,
} from "../../events/events";
import "../../flow-gen/flowgen-homepage-panel.js";
import { colorsLight } from "../../styles/host/colors-light.js";
import { type } from "../../styles/host/type.js";
import { icons } from "../../styles/icons.js";
import type { RecentBoard } from "../../types/types.js";
import { ActionTracker } from "../../utils/action-tracker.js";
import { blankBoard } from "../../utils/blank-board.js";
import {
  type Connection,
  fetchAvailableConnections,
} from "../connection/connection-server.js";
import "./gallery.js";
import "./homepage-search-button.js";

import * as StringsHelper from "../../strings/helper.js";
const Strings = StringsHelper.forSection("ProjectListing");

const MODE_KEY = "bb-project-listing-mode";
const OVERFLOW_MENU_CLEARANCE = 4;

const URL_PARAMS = new URL(document.URL).searchParams;
const FORCE_NO_BOARDS = URL_PARAMS.has("forceNoBoards");
const SHOW_GOOGLE_DRIVE_DEBUG_PANEL = URL_PARAMS.has("driveDebug");
if (SHOW_GOOGLE_DRIVE_DEBUG_PANEL) {
  import("../google-drive/google-drive-debug-panel.js");
}

@customElement("bb-project-listing")
export class ProjectListing extends LitElement {
  @property({ attribute: false })
  accessor boardServers: BoardServer[] = [];

  @property()
  accessor boardServerNavState: string | null = null;

  @property()
  accessor selectedBoardServer = "Browser Storage";

  @property()
  accessor selectedLocation = "Browser Storage";

  @property({ attribute: false })
  accessor recentBoards: RecentBoard[] = [];

  @property()
  accessor filter: string | null = null;

  @state()
  accessor showBoardServerOverflowMenu = false;
  readonly #overflowMenu = {
    x: 0,
    y: 0,
  };

  @state()
  accessor showAdditionalSources = true;

  @state()
  accessor mode: "detailed" | "condensed" = "detailed";

  @consume({ context: globalConfigContext })
  accessor globalConfig: GlobalConfig | undefined;

  #selectedIndex = 0;

  #availableConnections?: Task<readonly unknown[], Connection[]>;

  static styles = [
    icons,
    colorsLight,
    type,
    css`
      * {
        box-sizing: border-box;
      }

      :host {
        display: block;
        background: var(--bb-neutral-0);
        --items-per-column: 4;
        --column-gap: var(--bb-grid-size-8);
        --row-gap: var(--bb-grid-size-6);
      }

      @media (min-width: 800px) and (max-width: 1080px) {
        :host {
          --items-per-column: 3;
        }
      }

      @media (min-width: 480px) and (max-width: 800px) {
        :host {
          --items-per-column: 2;
        }
      }
      @media (min-width: 0px) and (max-width: 480px) {
        :host {
          --items-per-column: 1;
        }
      }

      #wrapper {
        margin: 0 auto;
        padding: 0 var(--bb-grid-size-8) var(--bb-grid-size-12)
          var(--bb-grid-size-8);
        width: 100%;
        max-width: 1200px;
        min-height: 100%;

        & #hero {
          padding: 0 var(--bb-grid-size-16);
          display: flex;
          flex-direction: column;
          align-items: center;

          & h1 {
            margin: var(--bb-grid-size-9) 0 0 0;
            text-align: center;
            max-width: 560px;
          }
        }

        & #board-listing {
          margin-top: 24px;
        }

        & #loading-message {
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--bb-neutral-700);
          font: 400 var(--bb-body-medium) / var(--bb-body-line-height-medium)
            var(--bb-font-family);
          margin: var(--bb-grid-size-10) 0;

          &::before {
            content: "";
            display: block;
            width: 20px;
            height: 20px;
            background: url(/images/progress-ui.svg) center center / 20px 20px
              no-repeat;
            margin-right: var(--bb-grid-size-2);
          }

          & p {
            margin: 0 0 var(--bb-grid-size) 0;
          }
        }

        & #no-projects-panel {
          display: grid;
          display: grid;
          grid-template-columns: repeat(var(--items-per-column), 1fr);
          grid-auto-rows: auto;
          column-gap: var(--column-gap);
          row-gap: var(--row-gap);

          & #create-new-button {
            border: none;
            background: var(--ui-custom-o-5);
            border-radius: var(--bb-grid-size-4);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 184px;
            color: var(--n-0);
            transition: background 0.2s cubic-bezier(0, 0, 0.3, 1);

            > * {
              pointer-events: none;
            }

            & .g-icon {
              display: flex;
              justify-content: center;
              align-items: center;
              color: var(--n-70);
              font-size: 30px;
              width: 48px;
              height: 48px;
              background: var(--n-100);
              border-radius: 50%;
              margin-bottom: var(--bb-grid-size-4);
              font-weight: 500;

              &::after {
                content: "add";
              }
            }

            &[disabled] {
              & .g-icon {
                animation: rotate 1s linear infinite;

                &::after {
                  content: "progress_activity";
                }
              }
            }

            &:not([disabled]) {
              cursor: pointer;

              &:hover,
              &:focus {
                background: var(--ui-custom-o-10);
              }
            }
          }
        }

        & #buttons {
          order: 0;
          height: 80px;
          display: flex;
          align-items: center;
          justify-content: space-between;

          & #create-new-button-inline {
            display: flex;
            align-items: center;
            color: var(--n-100);
            border-radius: var(--bb-grid-size-16);
            border: none;
            background: var(--n-0);
            height: var(--bb-grid-size-10);
            padding: 0 var(--bb-grid-size-4) 0 var(--bb-grid-size-3);

            > * {
              pointer-events: none;
            }

            & .g-icon {
              color: var(--n-100);
              margin-right: var(--bb-grid-size-2);

              &::after {
                content: "add";
              }
            }

            &[disabled] {
              & .g-icon {
                animation: rotate 1s linear infinite;
                &::after {
                  content: "progress_activity";
                }
              }
            }

            &:not([disabled]) {
              cursor: pointer;

              &:focus,
              &:hover {
                background: var(--n-10);
              }
            }
          }

          & #mode-container {
            display: flex;
            height: var(--bb-grid-size-10);
            padding-top: var(--bb-grid-size);

            & input {
              display: none;
            }

            & label {
              display: flex;
              align-items: center;
              font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
                var(--bb-font-family);
              cursor: pointer;

              & .detailed {
                display: block;
                width: 52px;
                height: var(--bb-grid-size-9);
                border: 1px solid var(--bb-neutral-300);
                border-radius: var(--bb-grid-size-16) 0 0 var(--bb-grid-size-16);
                background: var(--bb-ui-50) var(--bb-icon-grid-view) 16px
                  center / 20px 20px no-repeat;
              }

              & .condensed {
                display: block;
                width: 52px;
                height: var(--bb-grid-size-9);
                border: 1px solid var(--bb-neutral-300);
                border-left: none;
                border-radius: 0 var(--bb-grid-size-16) var(--bb-grid-size-16) 0;
                margin-right: var(--bb-grid-size-4);
                background: var(--bb-neutral-0) var(--bb-icon-dehaze) 14px
                  center / 20px 20px no-repeat;
              }

              & .sort-by-icon {
                width: 20px;
                height: 20px;
                background: var(--bb-icon-sort-by) center center / 20px 20px
                  no-repeat;
                margin-right: var(--bb-grid-size);
              }
            }

            /* Checked means condensed */
            & input:checked + label {
              & .detailed {
                background-color: var(--bb-neutral-0);
              }

              & .condensed {
                background-color: var(--bb-ui-50);
              }
            }

            & bb-homepage-search-button {
              margin-left: 8px;
            }
          }
        }

        & #new-project-container {
          display: flex;
          justify-content: center;
        }

        & #location-selector-container {
          display: flex;
          align-items: center;
          justify-content: space-between;

          & #location-selector-outer {
            display: flex;
            align-items: center;

            & #location-selector {
              padding: 0;
              border: none;
            }
          }
        }

        & #list-other-peoples-boards-container {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 60px;
          font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
            var(--bb-font-family);
          margin-left: var(--bb-grid-size-8);
        }

        & #content {
          display: flex;
          flex-direction: column;

          & .gallery-wrapper {
            order: 1;
            margin-top: var(--bb-grid-size-8);

            & .gallery-title {
              margin: 0 0 var(--bb-grid-size-6) 0;
            }
          }
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
        position: fixed;
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
            background: var(--bb-icon-refresh) center center / 20px 20px
              no-repeat;
          }

          &#remove-board-server::before {
            background: var(--bb-icon-delete) center center / 20px 20px
              no-repeat;
          }
        }
      }

      #app-version {
        font: 400 var(--bb-body-x-small) / var(--bb-body-line-height-x-small)
          var(--bb-font-family);
        color: var(--bb-neutral-500);
        position: relative;
        text-align: right;
        margin-top: -32px;
        padding: 0 var(--bb-grid-size-3);
      }

      @keyframes rotate {
        from {
          rotate: 0deg;
        }

        to {
          rotate: 360deg;
        }
      }
    `,
  ];

  readonly #wrapperRef: Ref<HTMLDivElement> = createRef();
  readonly #searchRef: Ref<HTMLInputElement> = createRef();
  readonly #hideBoardServerOverflowMenuBound =
    this.#hideBoardServerOverflowMenu.bind(this);
  #attemptFocus = false;
  #attemptScrollUpdate = false;

  override connectedCallback() {
    super.connectedCallback();

    this.addEventListener("click", this.#hideBoardServerOverflowMenuBound);

    for (const boardServer of this.boardServers) {
      const closuredName = boardServer.name;
      boardServer.addEventListener("boardlistrefreshed", () => {
        // Listen to all, react only to the current.
        if (closuredName == this.selectedBoardServer) {
          this.dispatchEvent(
            new GraphBoardServerRefreshEvent(
              this.selectedBoardServer,
              this.selectedLocation
            )
          );
        }
      });
    }

    this.#attemptFocus = true;

    this.mode =
      globalThis.localStorage.getItem(MODE_KEY) === "condensed"
        ? "condensed"
        : "detailed";
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();

    this.removeEventListener("click", this.#hideBoardServerOverflowMenuBound);
  }

  protected willUpdate(changedProperties: PropertyValues<this>): void {
    if (
      changedProperties.has("boardServerNavState") ||
      changedProperties.has("boardServers") ||
      changedProperties.has("selectedLocation") ||
      changedProperties.has("selectedBoardServer") ||
      changedProperties.has("filter") ||
      changedProperties.has("mode")
    ) {
      this.#selectedIndex = 0;
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

  #createUrl(boardServer: string, location: string) {
    return `${boardServer}::${location}`;
  }

  #parseUrl(url: string) {
    return url.split("::");
  }

  override render() {
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

    return html`
      <div id="wrapper" ${ref(this.#wrapperRef)}>
        ${[this.#renderHero(), this.#renderBoardListing()]}
      </div>

      ${this.showBoardServerOverflowMenu
        ? this.#renderBoardServerOverflowMenu(boardServer)
        : nothing}
      ${this.#renderAppVersion()}
      ${SHOW_GOOGLE_DRIVE_DEBUG_PANEL
        ? html`<bb-google-drive-debug-panel></bb-google-drive-debug-panel>`
        : nothing}
    `;
  }

  #renderHero() {
    return html`
      <section id="hero">
        <h1 class="sans-flex w-500 round md-headline-large">
          ${Strings.from("LABEL_WELCOME_MESSAGE_B")}
        </h1>
      </section>
    `;
  }

  #renderBoardListing() {
    return html`
      <div id="board-listing">
        <div id="content">
          ${until(
            this.#boardServerContents.then(
              (store) => this.#renderBoardListingSuccess(store),
              (error) => this.#renderBoardListingError(error)
            ),
            html`
              <div id="loading-message">${Strings.from("STATUS_LOADING")}</div>
            `
          )}
        </div>
      </div>
    `;
  }

  #renderBoardListingSuccess(store: GraphProviderStore | null) {
    if (!store) {
      return nothing;
    }
    if (store.permission !== "granted") {
      return this.#renderRenewAccess();
    }

    const { myItems, sampleItems } = this.#separateGraphsByOwner(store);

    const userHasAnyGraphs = myItems.length > 0 && !FORCE_NO_BOARDS;

    return [
      html`
        <div id="locations">
          <div id="location-selector-container">
            ${this.showAdditionalSources
              ? this.#renderLocationSelectorWithAdditionalSources()
              : this.#renderLocationSelectorWithoutAdditionalSources()}
            <div id="buttons">
              ${userHasAnyGraphs
                ? this.#renderInlineCreateNewButton()
                : nothing}
            </div>
          </div>
        </div>
      `,

      userHasAnyGraphs
        ? this.#renderUserGraphs(myItems)
        : this.#renderNoUserGraphsPanel(),

      this.#renderFeaturedGraphs(sampleItems),
    ];
  }

  #renderRenewAccess() {
    return html`
      <div id="renew-access">
        <span>${Strings.from("LABEL_ACCESS_EXPIRED_PROJECT_SERVER")}</span>
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
      </div>
    `;
  }

  #separateGraphsByOwner(store: GraphProviderStore) {
    const filter = this.filter ? new RegExp(this.filter, "gim") : undefined;
    const allItems = [...store.items]
      .filter(
        ([name, item]) =>
          !filter ||
          (item.title && filter.test(item.title)) ||
          (name && filter.test(name))
      )
      .sort(([, dataA], [, dataB]) => {
        // Sort by recency.
        const indexA = this.recentBoards.findIndex(
          (board) => board.url === dataA.url
        );
        const indexB = this.recentBoards.findIndex(
          (board) => board.url === dataB.url
        );

        if (indexA !== -1 && indexB === -1) {
          return -1;
        }
        if (indexA === -1 && indexB !== -1) {
          return 1;
        }

        if (indexA !== -1 && indexB !== -1) {
          return indexA - indexB;
        }

        // If both are unknown for recency, choose those that are
        // mine.
        if (dataA.mine && !dataB.mine) {
          return -1;
        }

        if (!dataA.mine && dataB.mine) {
          return 1;
        }

        return 0;
      });

    const myItems = allItems.filter(([, item]) => item.mine);
    const sampleItems = allItems
      .filter(([, item]) => (item.tags ?? []).includes("featured"))
      .sort(([, dataA], [, dataB]) => {
        if (dataA.title && !dataB.title) return -1;
        if (!dataA.title && dataB.title) return 1;
        if (dataA.title && dataB.title) {
          if (dataA.title < dataB.title) return -1;
          if (dataA.title > dataB.title) return 1;
          return 0;
        }
        return 0;
      });
    return { myItems, sampleItems };
  }

  #renderBoardListingError(error: Error) {
    if (error.message.includes("No folder ID or access token")) {
      if (!this.#availableConnections) {
        this.#availableConnections = fetchAvailableConnections(
          this,
          () => this.globalConfig,
          true
        );
      }
      if (this.#availableConnections!.status === TaskStatus.INITIAL) {
        this.#availableConnections!.run();
      }

      const gdriveConnectionID = "google-drive-limited";
      return this.#availableConnections!.render({
        pending: () => html`<p>Loading connections ...</p>`,
        error: () => html`<p>Error loading connections</p>`,
        complete: (result: Connection[]) => {
          const gdrive = (result as Array<{ id: string }>).find(
            (connection: { id: string }) => connection.id === gdriveConnectionID
          );
          if (gdrive) {
            return html`<div>
              <p class="loading-message">
                You haven't yet granted us Google Drive Permissions, please sign
                in into Google Drive in order to be able to create and save your
                Flows.
              </p>
              <bb-connection-signin
                .connection=${gdrive}
                @bbtokengranted=${({
                  token,
                  expiresIn,
                }: HTMLElementEventMap["bbtokengranted"]) => {
                  this.dispatchEvent(
                    new StateEvent({
                      eventType: "board.input",
                      id: this.id,
                      data: {
                        clientId: gdriveConnectionID,
                        secret: token,
                        expiresIn,
                      },
                      allowSavingIfSecret: false,
                    })
                  );
                }}
              ></bb-connection-signin>
            </div>`;
          }
        },
      });
    }
  }

  #renderLocationSelectorWithAdditionalSources() {
    const selected = this.#createUrl(
      this.selectedBoardServer,
      this.selectedLocation
    );
    return html`
      <div id="location-selector-outer">
        <select
          id="location-selector"
          class="gallery-title md-headline-small sans-flex w-400 round"
          @input=${(evt: Event) => {
            if (!(evt.target instanceof HTMLSelectElement)) {
              return;
            }

            const [boardServer, location] = this.#parseUrl(evt.target.value);
            this.selectedBoardServer = boardServer;
            this.selectedLocation = location;

            this.dispatchEvent(
              new GraphBoardServerSelectionChangeEvent(boardServer, location)
            );
          }}
        >
          ${map(this.boardServers, (boardServer) => {
            return html`${map(boardServer.items(), ([location, store]) => {
              const value = `${boardServer.name}::${store.url ?? location}`;
              const isSelectedOption = value === selected;
              return html`<option .selected=${isSelectedOption} .value=${value}>
                ${store.title}
              </option>`;
            })}`;
          })}
        </select>

        <button
          id="board-server-settings"
          @click=${(evt: PointerEvent) => {
            if (!(evt.target instanceof HTMLButtonElement)) {
              return;
            }

            const bounds = evt.target.getBoundingClientRect();
            this.#overflowMenu.x = bounds.left;
            this.#overflowMenu.y =
              window.innerHeight - (bounds.top - OVERFLOW_MENU_CLEARANCE);

            this.showBoardServerOverflowMenu = true;
          }}
        >
          ${Strings.from("LABEL_PROJECT_SERVER_SETTINGS")}
        </button>
      </div>
    `;
  }

  #renderLocationSelectorWithoutAdditionalSources() {
    return html`
      <h2
        id="location-selector"
        class="gallery-title md-headline-small sans-flex w-400 round"
      >
        ${Strings.from("LABEL_TABLE_DESCRIPTION_YOUR_PROJECTS")}
      </h2>
    `;
  }

  #renderInlineCreateNewButton() {
    return html`
      <div id="create-new-button-container">
        <button
          id="create-new-button-inline"
          class="md-title-small sans-flex w-400 round"
          @click=${this.#clickNewProjectButton}
        >
          <span class="g-icon"></span>
          ${Strings.from("COMMAND_NEW_PROJECT")}
        </button>
      </div>
    `;
  }

  #renderUserGraphs(myItems: [string, GraphProviderItem][]) {
    return html`
      <div class="gallery-wrapper">
        <bb-gallery .items=${myItems} .pageSize=${8}></bb-gallery>
      </div>
    `;
  }

  #renderNoUserGraphsPanel() {
    return html`
      <div id="no-projects-panel">
        <button
          id="create-new-button"
          class="md-title-small sans-flex w-400 round"
          @click=${this.#clickNewProjectButton}
        >
          <span class="g-icon"></span>
          ${Strings.from("COMMAND_NEW_PROJECT")}
        </button>
      </div>
    `;
  }

  #renderFeaturedGraphs(sampleItems: [string, GraphProviderItem][]) {
    return html`
      <div class="gallery-wrapper">
        <h2 class="gallery-title md-headline-small sans-flex w-400 round">
          ${Strings.from("LABEL_SAMPLE_GALLERY_TITLE")}
        </h2>
        <bb-gallery
          .items=${sampleItems}
          .pageSize=${/* Unlimited */ -1}
          forceCreatorToBeTeam
        ></bb-gallery>
      </div>
    `;
  }

  #renderBoardServerOverflowMenu(boardServer: BoardServer) {
    const extendedCapabilities = boardServer.extendedCapabilities();
    return html`
      <div
        id="overflow-menu"
        style=${styleMap({
          left: `${this.#overflowMenu.x}px`,
          bottom: `${this.#overflowMenu.y}px`,
        })}
      >
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
      </div>
    `;
  }

  #renderAppVersion() {
    const buildInfo = this.globalConfig?.buildInfo;
    return html`
      <div id="app-version">
        ${buildInfo
          ? `${buildInfo.packageJsonVersion} (${buildInfo.gitCommitHash})`
          : `Unknown version`}
      </div>
    `;
  }

  #clickNewProjectButton(evt: Event) {
    if (!(evt.target instanceof HTMLButtonElement)) {
      return;
    }

    ActionTracker.createNew();

    evt.target.disabled = true;
    this.dispatchEvent(
      new StateEvent({
        eventType: "board.create",
        editHistoryCreator: { role: "user" },
        graph: blankBoard(),
        messages: {
          start: "",
          end: "",
          error: "",
        },
      })
    );
  }
}
