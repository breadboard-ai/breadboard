/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type GraphProviderItem } from "@breadboard-ai/types";
import { SignalWatcher } from "@lit-labs/signals";
import { consume } from "@lit/context";
import { css, html, LitElement, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { StateEvent } from "../../events/events.js";
import "../../flow-gen/flowgen-homepage-panel.js";
import * as StringsHelper from "../../strings/helper.js";
import { baseColors } from "../../styles/host/base-colors.js";
import { type } from "../../styles/host/type.js";
import { icons } from "../../styles/icons.js";
import { blankBoard } from "../../utils/blank-board.js";
import "./gallery.js";
import "../shared/expanding-search-button.js";
import { ExpandingSearchButton } from "../shared/expanding-search-button.js";
import { scaContext } from "../../../sca/context/context.js";
import { type SCA } from "../../../sca/sca.js";

const Strings = StringsHelper.forSection("ProjectListing");

const NARROW_PAGE_SIZE = 4;
const WIDE_PAGE_SIZE = 8;
const URL_PARAMS = new URL(document.URL).searchParams;
const FORCE_NO_BOARDS = URL_PARAMS.has("forceNoBoards");

@customElement("bb-project-listing")
export class ProjectListing extends SignalWatcher(LitElement) {
  @consume({ context: scaContext })
  accessor sca!: SCA;

  @property()
  accessor userFilter: string | null = null;

  @property()
  accessor featuredFilter: string | null = null;

  get pageSize() {
    return this.sca.controller.global.screenSize.size === "narrow"
      ? NARROW_PAGE_SIZE
      : WIDE_PAGE_SIZE;
  }

  static styles = [
    icons,
    baseColors,
    type,
    css`
      * {
        box-sizing: border-box;
      }

      :host {
        display: block;
        background: light-dark(var(--n-100), var(--n-10));
        color: light-dark(var(--n-0), var(--n-80));
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
          color: var(--light-dark-n-40);
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
            color: var(--light-dark-n-0);
            transition: background 0.2s cubic-bezier(0, 0, 0.3, 1);

            > * {
              pointer-events: none;
            }

            & .g-icon {
              display: flex;
              justify-content: center;
              align-items: center;
              color: var(--light-dark-n-70);
              font-size: 30px;
              width: 48px;
              height: 48px;
              background: var(--light-dark-n-100);
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
          gap: var(--bb-grid-size-5);

          & #create-new-button-inline {
            display: flex;
            align-items: center;
            color: var(--light-dark-n-100);
            border-radius: var(--bb-grid-size-16);
            border: none;
            background: var(--light-dark-n-0);
            height: var(--bb-grid-size-10);
            padding: 0 var(--bb-grid-size-4) 0 var(--bb-grid-size-3);
            white-space: nowrap;

            > * {
              pointer-events: none;
            }

            & .g-icon {
              color: var(--light-dark-n-100);
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
                background: var(--light-dark-n-10);
              }
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

        & #content {
          display: flex;
          flex-direction: column;

          & .gallery-wrapper {
            order: 1;
            margin-top: var(--bb-grid-size-8);

            & .gallery-header {
              display: flex;
              align-items: center;
              justify-content: space-between;
              margin: 0 0 var(--bb-grid-size-8) 0;

              & h2 {
                margin: 0;
              }
            }
          }
        }

        @media (max-width: 620px) {
          padding: 0 var(--bb-grid-size-3) var(--bb-grid-size-6)
            var(--bb-grid-size-3);

          & #hero {
            padding: 0 var(--bb-grid-size-4);

            & h1 {
              margin: var(--bb-grid-size-4) 0 0 0;
              font-size: 24px;
              line-height: 28px;
            }
          }

          & bb-expanding-search-button {
            display: none;
          }

          & #content .gallery-wrapper {
            margin-top: 0;
          }

          & #board-listing {
            #location-selector,
            .gallery-title {
              font-size: 20px;
            }
            & .gallery-wrapper {
              & .gallery-header {
                margin-bottom: var(--bb-grid-size-4);
              }
            }
          }
        }

      #app-version {
        font: 400 var(--bb-body-x-small) / var(--bb-body-line-height-x-small)
          var(--bb-font-family);
        color: var(--light-dark-n-98);
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

  override render() {
    const boardServer = this.sca.services.googleDriveBoardServer;
    if (!boardServer) {
      return html`<nav id="menu">
        ${Strings.from("ERROR_LOADING_PROJECTS")}
      </nav>`;
    }

    return html`
      <div id="wrapper">
        ${this.#renderHero()}

        <div id="board-listing">
          <div id="content">${this.#renderBoardListing()}</div>
        </div>
      </div>

      ${this.#renderAppVersion()}
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
    const server = this.sca.services.googleDriveBoardServer;
    if (!server) {
      console.error(`[homepage] No board server provided`);
      return nothing;
    }
    const { userGraphs, galleryGraphs } = server;
    if (!userGraphs || !galleryGraphs) {
      console.error(
        `[homepage] Board server was missing userGraphs and/or galleryGraphs`
      );
      return nothing;
    }
    if (userGraphs.loading || galleryGraphs.loading) {
      return html`
        <div id="loading-message">${Strings.from("STATUS_LOADING")}</div>
      `;
    }

    const userHasAnyGraphs = userGraphs.size > 0 && !FORCE_NO_BOARDS;
    const filteredGraphs = this.#filterGraphs(
      [...userGraphs.entries()],
      this.userFilter
    );
    const featuredGraphs = this.#filterGraphs(
      [...galleryGraphs.entries()],
      this.featuredFilter
    );

    return [
      html`
        <div id="locations">
          <div id="location-selector-container">
            <h2
              id="location-selector"
              class="gallery-title md-headline-small sans-flex w-400 round"
            >
              ${Strings.from("LABEL_TABLE_DESCRIPTION_YOUR_PROJECTS")}
            </h2>

            <div id="buttons">
              ${userGraphs.size > this.pageSize
                ? html`<bb-expanding-search-button
                    showLabel
                    @input=${(evt: InputEvent) => {
                      const inputs = evt.composedPath();
                      const input = inputs.find(
                        (el) => el instanceof ExpandingSearchButton
                      );
                      if (!input) {
                        return;
                      }

                      this.userFilter = input.value;
                    }}
                  ></bb-expanding-search-button>`
                : nothing}
              ${userHasAnyGraphs
                ? this.#renderInlineCreateNewButton()
                : nothing}
            </div>
          </div>
        </div>
      `,

      userHasAnyGraphs
        ? this.#renderUserGraphs(this.#sortUserGraphs(filteredGraphs))
        : this.#renderNoUserGraphsPanel(),

      this.#renderFeaturedGraphs(featuredGraphs),
    ];
  }

  #filterGraphs(
    items: [string, GraphProviderItem][],
    filter: string | null
  ): [string, GraphProviderItem][] {
    if (!filter) {
      return items;
    }
    const filterRegExp = filter ? new RegExp(filter, "gim") : undefined;
    return items.filter(
      ([name, item]) =>
        !filterRegExp ||
        (item.title && filterRegExp.test(item.title)) ||
        (name && filterRegExp.test(name))
    );
  }

  #sortUserGraphs(
    items: [string, GraphProviderItem][]
  ): [string, GraphProviderItem][] {
    const recentBoards = this.sca.controller.home.recent.boards;
    return items.sort(([, dataA], [, dataB]) => {
      // Sort by pinned status first if possible.
      const boardA = recentBoards.find((board) => board.url === dataA.url);
      const boardB = recentBoards.find((board) => board.url === dataB.url);

      const boardAPinned = boardA && boardA.pinned;
      const boardBPinned = boardB && boardB.pinned;
      if (boardAPinned && !boardBPinned) return -1;
      if (!boardAPinned && boardBPinned) return 1;

      // When both are pinned we fall through to sort by recency.
      const indexA = recentBoards.findIndex((board) => board.url === dataA.url);
      const indexB = recentBoards.findIndex((board) => board.url === dataB.url);

      // One of them is not found, prioritize the one that is.
      if (indexA !== -1 && indexB === -1) return -1;
      if (indexA === -1 && indexB !== -1) return 1;

      // Both are found, sort by index.
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;

      // If both are unknown for recency, choose those that are mine.
      if (dataA.mine && !dataB.mine) return -1;
      if (!dataA.mine && dataB.mine) return 1;

      return 0;
    });
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
    if (myItems.length === 0) {
      return html`<div class="gallery-wrapper">
        <h2 class="sans md-title-small w-400 ta-c">There are no items</h2>
      </div>`;
    }

    return html`
      <div class="gallery-wrapper">
        <bb-gallery .items=${myItems} .pageSize=${this.pageSize}></bb-gallery>
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
        <section class="gallery-header">
          <h2 class="gallery-title md-headline-small sans-flex w-400 round">
            ${Strings.from("LABEL_SAMPLE_GALLERY_TITLE")}
          </h2>
          <bb-expanding-search-button
            showLabel
            @input=${(evt: InputEvent) => {
              const inputs = evt.composedPath();
              const input = inputs.find(
                (el) => el instanceof ExpandingSearchButton
              );
              if (!input) {
                return;
              }

              this.featuredFilter = input.value;
            }}
          ></bb-expanding-search-button>
        </section>

        ${sampleItems.length === 0
          ? html`<div class="gallery-wrapper">
              <h2 class="sans md-title-small w-400 ta-c">There are no items</h2>
            </div>`
          : html`<bb-gallery
              .items=${sampleItems}
              .pageSize=${/* Unlimited */ -1}
              forceCreatorToBeTeam
            ></bb-gallery>`}
      </div>
    `;
  }

  #renderAppVersion() {
    const buildInfo = this.sca?.services.globalConfig?.buildInfo;
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

    this.sca?.services.actionTracker?.createNew();

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
