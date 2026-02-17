/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  MutableGraphCollection,
  type GraphProviderItem,
} from "@breadboard-ai/types";
import { SignalWatcher } from "@lit-labs/signals";
import { consume } from "@lit/context";
import { css, html, LitElement, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import "../../elements/shared/expanding-search-button.js";
import { StateEvent } from "../../events/events.js";
import "../../flow-gen/flowgen-homepage-panel.js";
import * as StringsHelper from "../../strings/helper.js";
import { blankBoard } from "../../utils/blank-board.js";
import "./gallery.js";

import * as Styles from "../../styles/styles.js";
import { styleMap } from "lit/directives/style-map.js";
import { scaContext } from "../../../sca/context/context.js";
import { type SCA } from "../../../sca/sca.js";

const Strings = StringsHelper.forSection("ProjectListing");

const PAGE_SIZE = 4;
const URL_PARAMS = new URL(document.URL).searchParams;
const FORCE_NO_BOARDS = URL_PARAMS.has("forceNoBoards");

@customElement("bb-project-listing-lite")
export class ProjectListingLite extends SignalWatcher(LitElement) {
  @consume({ context: scaContext })
  accessor sca!: SCA;

  @property()
  accessor featuredFilter: string | null = null;

  @property()
  accessor libraryTitle: string | null = null;

  @property()
  accessor libraryIcon: string | null = null;

  @property()
  accessor noLibraryAppsTitle: string | null = null;

  @property()
  accessor galleryTitle: string | null = null;

  @property()
  accessor galleryIcon: string | null = null;

  @property()
  accessor createNewTitle: string | null = null;

  @property()
  accessor allowCreate: boolean = true;

  @property({ reflect: true, type: String })
  accessor createNewIcon: string | null = null;

  static styles = [
    Styles.HostIcons.icons,
    Styles.HostColorsMaterial.baseColors,
    Styles.HostType.type,
    css`
      * {
        box-sizing: border-box;
      }

      :host {
        display: block;
        --items-per-column: 4;
        --column-gap: 10px;
        --row-gap: 10px;
        --items-per-column: 4;
        --max-title-lines: 3;
        --max-description-lines: 3;
        --border: 1px solid var(--light-dark-n-90);
        --thumbnail-height: 175px;
        --details-min-height: 108px;
        --profile-pic-size: 28px;
      }

      @media (min-width: 480px) and (max-width: 800px) {
        :host {
          --items-per-column: 3;
        }
      }
      @media (min-width: 0px) and (max-width: 480px) {
        :host {
          --items-per-column: 2;
        }
      }

      #hero {
        padding: 0 var(--bb-grid-size-16);
        display: flex;
        flex-direction: column;
        align-items: center;
      }

      #hero h1 {
        margin: var(--bb-grid-size-9) 0 0 0;
        text-align: center;
      }

      #board-listing {
        margin-top: 24px;
      }

      #loading-message {
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--light-dark-n-40);
        font: 400 var(--bb-body-medium) / var(--bb-body-line-height-medium)
          var(--bb-font-family);
        margin: var(--bb-grid-size-10) 0;
      }

      #loading-message::before {
        content: "";
        display: block;
        width: 20px;
        height: 20px;
        background: url(/images/progress-ui.svg) center center / 20px 20px
          no-repeat;
        margin-right: var(--bb-grid-size-2);
      }

      #loading-message p {
        margin: 0 0 var(--bb-grid-size) 0;
      }

      #no-projects-panel,
      #no-create-panel {
        background: var(--sys-color--surface-container-low);
        color: var(--sys-color--on-surface-low);
        padding: var(--bb-grid-size-4);
        border-radius: var(--bb-grid-size-3);
        text-align: center;

        .g-icon {
          vertical-align: bottom;
        }
      }

      #no-create-panel {
        margin-top: var(--bb-grid-size-3);
      }

      #create-new-button-inline {
        display: flex;
        align-items: center;
        color: var(--sys-color--on-primary);
        border-radius: var(--bb-grid-size-16);
        border: none;
        background: var(--sys-color--primary);
        height: var(--bb-grid-size-10);
        padding: 0 var(--bb-grid-size-5) 0 var(--bb-grid-size-4);
        transition: background-color 0.2s cubic-bezier(0, 0, 0.3, 1);
        position: relative;
        -webkit-font-smoothing: antialiased;

        &[disabled] .g-icon {
          animation: rotate 1s linear infinite;
        }

        &[disabled] .g-icon::after {
          content: "progress_activity";
        }

        &:not([disabled]) {
          cursor: pointer;
        }

        &:not([disabled]):focus,
        &:not([disabled]):hover {
          box-shadow:
            0 2px 1px -1px rgba(0, 0, 0, 0.2),
            0 1px 1px 0 rgba(0, 0, 0, 0.14),
            0 1px 3px 0 rgba(0, 0, 0, 0.12);

          &::after {
            content: "";
            pointer-events: none;
            background: var(--sys-color--on-primary);
            opacity: 0.08;
            position: absolute;
            inset: 0;
            border-radius: var(--bb-grid-size-16);
          }
        }

        .g-icon {
          font-size: 1.125rem;
          -webkit-font-smoothing: antialiased;

          color: var(--sys-color--on-primary);
          margin-right: var(--bb-grid-size-2);
        }

        .g-icon::after {
          content: var(--create-new-icon, "add");
        }
      }

      #new-project-container {
        display: flex;
        justify-content: center;
      }

      #location-selector-container {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      #location-selector-container #location-selector-outer {
        display: flex;
        align-items: center;
      }

      #location-selector-container #location-selector-outer #location-selector {
        padding: 0;
        border: none;
      }

      #content {
        display: flex;
        flex-direction: column;
      }

      #content .gallery-wrapper {
        margin-top: var(--bb-grid-size-8);
      }

      #content .gallery-wrapper .gallery-header h2 {
        margin: 0;
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
      <div id="board-listing">
        <div id="content">${this.#renderBoardListing()}</div>
      </div>
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
    if (galleryGraphs.loading) {
      return html`
        <div id="loading-message">${Strings.from("STATUS_LOADING")}</div>
      `;
    }
    const featuredGraphs = this.#filterGraphs(
      [...galleryGraphs.entries()],
      this.featuredFilter
    );

    featuredGraphs.sort(([, a], [, b]) => {
      const indexA = a.metadata?.liteModeFeaturedIndex;
      const indexB = b.metadata?.liteModeFeaturedIndex;
      if (indexA !== undefined && indexB !== undefined) {
        return indexA - indexB;
      }
      if (indexA !== undefined) {
        return -1;
      }
      if (indexB !== undefined) {
        return 1;
      }
      return 0;
    });
    return [
      this.#renderFeaturedGraphs(featuredGraphs),
      this.#renderUserGraphs(userGraphs),
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

  #renderUserGraphs(userGraphsCollection: MutableGraphCollection) {
    if (!FORCE_NO_BOARDS && userGraphsCollection.loading) {
      return html`
        <div id="loading-message">${Strings.from("STATUS_LOADING")}</div>
      `;
    }
    const userGraphs = FORCE_NO_BOARDS
      ? []
      : this.#sortUserGraphs([...userGraphsCollection.entries()]);
    const createNewIcon = this.createNewIcon
      ? `"${this.createNewIcon}"`
      : '"add"';
    return html`
      <div class="gallery-wrapper">
        <bb-gallery-lite
          .headerIcon=${this.libraryIcon}
          .headerText=${this.libraryTitle ??
          Strings.from("LABEL_TABLE_DESCRIPTION_YOUR_PROJECTS_LITE")}
          .items=${userGraphs}
          .pageSize=${PAGE_SIZE}
        >
          ${this.allowCreate
            ? html`<button
                slot="actions"
                id="create-new-button-inline"
                class="md-title-small sans-flex w-500"
                style=${styleMap({
                  ["--create-new-icon"]: createNewIcon,
                })}
                @click=${this.#clickNewProjectButton}
              >
                <span class="g-icon round"></span>
                ${this.createNewTitle ?? Strings.from("COMMAND_NEW_PROJECT")}
              </button>`
            : nothing}
        </bb-gallery-lite>
      </div>
      ${userGraphs.length === 0 ? this.#renderNoUserGraphsPanel() : nothing}
      ${this.allowCreate ? nothing : this.#renderNoCreatePanel()}
    `;
  }

  #renderNoUserGraphsPanel() {
    return html`
      <div id="no-projects-panel">
        <span class="g-icon">pentagon</span>
        ${this.noLibraryAppsTitle ?? Strings.from("LABEL_NO_OPALS_LITE")}
      </div>
    `;
  }

  #renderNoCreatePanel() {
    return html`
      <div id="no-create-panel">
        <span class="g-icon">info</span>
        ${Strings.from("LABEL_NO_CREATE_COMPACT")}
      </div>
    `;
  }

  #renderFeaturedGraphs(sampleItems: [string, GraphProviderItem][]) {
    return html`
      ${sampleItems.length === 0
        ? html`<div class="gallery-wrapper">
            <h2 class="sans md-title-small w-400 ta-c">There are no items</h2>
          </div>`
        : html`<bb-gallery-lite
            collapsable
            .headerIcon=${this.galleryIcon}
            .headerText=${this.galleryTitle ??
            Strings.from("LABEL_SAMPLE_GALLERY_TITLE_LITE")}
            .items=${sampleItems}
            .pageSize=${/* Unlimited */ -1}
            forceCreatorToBeTeam
          >
          </bb-gallery-lite>`}
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

declare global {
  interface HTMLElementTagNameMap {
    "bb-project-listing-lite": ProjectListingLite;
  }
}
