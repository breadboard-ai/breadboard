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
  GraphBoardServerRefreshEvent,
  GraphBoardServerRenewAccessRequestEvent,
  GraphBoardServerSelectionChangeEvent,
  InputEnterEvent,
} from "../../events/events";
import { map } from "lit/directives/map.js";
import { until } from "lit/directives/until.js";
import { BoardServer, GraphProviderStore } from "@google-labs/breadboard";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import { styleMap } from "lit/directives/style-map.js";
import "../../flow-gen/flowgen-homepage-panel.js";
import "./homepage-search-button.js";
import { icons } from "../../styles/icons.js";
import "./gallery.js";
import {
  Connection,
  fetchAvailableConnections,
} from "../connection/connection-server.js";
import { consume } from "@lit/context";

import {
  environmentContext,
  type Environment,
} from "../../contexts/environment.js";
import { Task, TaskStatus } from "@lit/task";
import { RecentBoard } from "../../types/types.js";

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
  accessor gitCommitHash = "unknown";

  @property()
  accessor selectedBoardServer = "Browser Storage";

  @property()
  accessor selectedLocation = "Browser Storage";

  @property()
  accessor recentBoards: RecentBoard[] = [];

  @property()
  accessor filter: string | null = null;

  @state()
  accessor showBoardServerOverflowMenu = false;
  #overflowMenu = {
    x: 0,
    y: 0,
  };

  @state()
  accessor showAdditionalSources = true;

  @state()
  accessor mode: "detailed" | "condensed" = "detailed";

  @consume({ context: environmentContext })
  accessor environment!: Environment;

  #selectedIndex = 0;

  #availableConnections?: Task<readonly unknown[], Connection[]>;

  static styles = [
    icons,
    css`
      * {
        box-sizing: border-box;
      }

      :host {
        display: block;
        background: var(--bb-neutral-0);
      }

      #wrapper {
        margin: 0 auto;
        padding: 0 var(--bb-grid-size-8) var(--bb-grid-size-12)
          var(--bb-grid-size-8);
        width: 100%;
        max-width: 1200px;
        min-height: 100%;

        & #hero {
          padding: 0 16px 28px 16px;
          display: flex;
          flex-direction: column;
          align-items: center;

          & h1 {
            font: 400 var(--bb-title-xx-large) /
              var(--bb-title-line-height-xx-large) var(--bb-font-family);
            padding: 0;
            margin: 76px 0 0 0;
            text-align: center;

            & .gradient {
              background: linear-gradient(
                0deg,
                #217bfe,
                #078efb,
                #a190ff,
                #bd99fe
              );
              background-clip: text;
              -webkit-text-fill-color: transparent;
            }
          }

          & bb-flowgen-homepage-panel {
            width: 100%;
            max-width: 976px;
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
          background: #f8fafd;
          border-radius: var(--bb-grid-size-6);
          padding: 34px;
          display: flex;
          flex-direction: column;
          align-items: center;
          p {
            color: var(--bb-neutral-700);
            font: 400 var(--bb-body-medium) / var(--bb-body-line-height-medium)
              var(--bb-font-family);
          }
        }

        & #buttons {
          order: 0;
          height: 80px;
          display: flex;
          align-items: center;
          justify-content: space-between;

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
              margin: var(--bb-grid-size-5) 0;
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
          }
        }
      }

      .gallery-title {
        font: 400 var(--bb-title-large) / var(--bb-title-line-height-large)
          var(--bb-font-family);
      }
      .gallery-description {
        font: 400 var(--bb-label-large) / var(--bb-label-line-height-large)
          var(--bb-font-family);
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

      .g-icon {
        font-variation-settings:
          "FILL" 0,
          "wght" 600,
          "GRAD" 0,
          "opsz" 48;
      }

      #create-new-button {
        color: #004a77;
        background-color: #c2e7ff;
        font: 500 var(--bb-title-small) / var(--bb-title-line-height-small)
          var(--bb-font-family);
        display: flex;
        align-items: center;
        border-radius: 100px;
        border: none;
        padding: 6px 12px;
        transition: background 0.2s cubic-bezier(0, 0, 0.3, 1);

        & > .g-icon {
          margin-right: 4px;
        }

        &[disabled] {
          opacity: 0.6;
        }

        &:not([disabled]) {
          cursor: pointer;

          &:hover,
          &:focus {
            background-color: #96d6ff;
          }
        }
      }
    `,
  ];

  #wrapperRef: Ref<HTMLDivElement> = createRef();
  #searchRef: Ref<HTMLInputElement> = createRef();
  #hideBoardServerOverflowMenuBound =
    this.#hideBoardServerOverflowMenu.bind(this);
  #attemptFocus = false;
  #attemptScrollUpdate = false;

  connectedCallback(): void {
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

  disconnectedCallback(): void {
    super.disconnectedCallback();

    this.removeEventListener("click", this.#hideBoardServerOverflowMenuBound);
  }

  protected willUpdate(
    changedProperties:
      | PropertyValueMap<{
          boardServerNavState: string | null;
          boardServers: BoardServer[];
          selectedBoardServer: string;
          selectedLocation: string;
          mode: boolean;
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

  #getCurrentStoreName(_url: string) {
    return Strings.from("LABEL_TABLE_DESCRIPTION_YOUR_PROJECTS");
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

    const location = this.showAdditionalSources
      ? html`<div id="location-selector-outer">
          <select
            id="location-selector"
            class="gallery-title"
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
        </div>`
      : html`<h2 id="location-selector" class="gallery-title">
          ${this.#getCurrentStoreName(selected)}
        </h2>`;

    return html`
      <div id="wrapper" ${ref(this.#wrapperRef)}>
        <section id="hero">
          <h1>
            <span class="gradient"
              >${Strings.from("LABEL_WELCOME_MESSAGE_A")}</span
            >
            ${Strings.from("LABEL_WELCOME_MESSAGE_B")}
          </h1>
          <bb-flowgen-homepage-panel></bb-flowgen-homepage-panel>
        </section>

        <div id="board-listing">
          <div id="content">
            ${until(
              this.#boardServerContents.then(
                (store) => {
                  if (!store) {
                    return nothing;
                  }

                  const { permission } = store;
                  const filter = this.filter
                    ? new RegExp(this.filter, "gim")
                    : undefined;
                  const allItems = [...store.items]
                    .filter(
                      ([name, item]) =>
                        !filter ||
                        (item.title && filter.test(item.title)) ||
                        (name && filter.test(name))
                    )
                    .sort(([, dataA], [, dataB]) => {
                      // Sort by recency.
                      const urlA = new URL(dataA.url);
                      const urlB = new URL(dataB.url);
                      const indexA = this.recentBoards.findIndex(
                        (board) => board.url === urlA.pathname
                      );
                      const indexB = this.recentBoards.findIndex(
                        (board) => board.url === urlB.pathname
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
                  const sampleItems = allItems.filter(([, item]) =>
                    (item.tags ?? []).includes("featured")
                  );
                  const boardListings = [
                    myItems.length && !FORCE_NO_BOARDS
                      ? html`
                          <div class="gallery-wrapper">
                            <bb-gallery
                              .items=${myItems}
                              .pageSize=${8}
                            ></bb-gallery>
                          </div>
                        `
                      : html`
                          <div id="no-projects-panel">
                            <p>${Strings.from("LABEL_NO_PROJECTS_FOUND")}</p>
                            ${this.#renderCreateNewButton()}
                          </div>
                        `,
                    html`
                      <div class="gallery-wrapper">
                        <h2 class="gallery-title">
                          ${Strings.from("LABEL_SAMPLE_GALLERY_TITLE")}
                        </h2>
                        <p class="gallery-description">
                          ${Strings.from("LABEL_SAMPLE_GALLERY_DESCRIPTION")}
                        </p>
                        <bb-gallery
                          .items=${sampleItems}
                          .pageSize=${/* Unlimited */ -1}
                          forceCreatorToBeTeam
                        ></bb-gallery>
                      </div>
                    `,
                  ];

                  const buttons =
                    myItems.length && !FORCE_NO_BOARDS
                      ? html`
                          <div id="buttons">
                            <div id="create-new-button-container">
                              ${this.#renderCreateNewButton()}
                            </div>
                          </div>
                        `
                      : nothing;

                  return permission === "granted"
                    ? [
                        html`<div id="locations">
                          <div id="location-selector-container">
                            ${location} ${buttons}
                          </div>
                        </div>`,
                        boardListings,
                      ]
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
                },
                async (error) => {
                  if (error.message.includes("No folder ID or access token")) {
                    if (!this.#availableConnections) {
                      this.#availableConnections = fetchAvailableConnections(
                        this,
                        () => this.environment,
                        true
                      );
                    }
                    if (
                      this.#availableConnections!.status === TaskStatus.INITIAL
                    ) {
                      this.#availableConnections!.run();
                    }

                    const gdriveConnectionID = "google-drive-limited";
                    return this.#availableConnections!.render({
                      pending: () => html`<p>Loading connections ...</p>`,
                      error: () => html`<p>Error loading connections</p>`,
                      complete: (result: Connection[]) => {
                        const gdrive = (result as Array<{ id: string }>).find(
                          (connection: { id: string }) =>
                            connection.id === gdriveConnectionID
                        );
                        if (gdrive) {
                          return html`<div>
                            <p class="loading-message">
                              You haven't yet granted us Google Drive
                              Permissions, please sign in into Google Drive in
                              order to be able to create and save your Flows.
                            </p>
                            <bb-connection-signin
                              .connection=${gdrive}
                              @bbtokengranted=${({
                                token,
                                expiresIn,
                              }: HTMLElementEventMap["bbtokengranted"]) => {
                                this.dispatchEvent(
                                  new InputEnterEvent(
                                    this.id,
                                    {
                                      clientId: gdriveConnectionID,
                                      secret: token,
                                      expiresIn,
                                    },
                                    false
                                  )
                                );
                              }}
                            ></bb-connection-signin>
                          </div>`;
                        }
                      },
                    });
                  }
                }
              ),
              html`<div id="loading-message">
                ${Strings.from("STATUS_LOADING")}
              </div>`
            )}
          </div>
        </div>
      </div>

      ${this.showBoardServerOverflowMenu
        ? html` <div
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
          </div>`
        : nothing}

      <div id="app-version">${this.version} (${this.gitCommitHash})</div>
      ${SHOW_GOOGLE_DRIVE_DEBUG_PANEL
        ? html`<bb-google-drive-debug-panel></bb-google-drive-debug-panel>`
        : nothing}
    `;
  }

  #renderCreateNewButton() {
    return html`
      <button id="create-new-button" @click=${this.#clickNewProjectButton}>
        <span class="g-icon">add</span>
        ${Strings.from("COMMAND_NEW_PROJECT")}
      </button>
    `;
  }

  #clickNewProjectButton(evt: Event) {
    if (!(evt.target instanceof HTMLButtonElement)) {
      return;
    }
    evt.target.disabled = true;
    this.dispatchEvent(new GraphBoardServerBlankBoardEvent());
  }
}
