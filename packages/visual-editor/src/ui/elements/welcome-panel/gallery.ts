/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GraphProviderItem } from "@breadboard-ai/types";
import { SignalWatcher } from "@lit-labs/signals";
import { consume } from "@lit/context";
import { css, html, HTMLTemplateResult, LitElement, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { guard } from "lit/directives/guard.js";
import { keyed } from "lit/directives/keyed.js";
import { createRef, ref } from "lit/directives/ref.js";
import { styleMap } from "lit/directives/style-map.js";
import { until } from "lit/directives/until.js";
import { OverflowMenuActionEvent, StateEvent } from "../../events/events.js";
import * as StringsHelper from "../../strings/helper.js";
import { baseColors } from "../../styles/host/base-colors.js";
import { type } from "../../styles/host/type.js";
import { icons } from "../../styles/icons.js";
import { OverflowAction } from "../../types/types.js";
import { renderThumbnail } from "../../media/image.js";
import { scaContext } from "../../../sca/context/context.js";
import { type SCA } from "../../../sca/sca.js";

const GlobalStrings = StringsHelper.forSection("Global");
const Strings = StringsHelper.forSection("ProjectListing");

@customElement("bb-gallery")
export class Gallery extends SignalWatcher(LitElement) {
  static readonly styles = [
    icons,
    baseColors,
    type,
    css`
      :host {
        --border: 1px solid var(--light-dark-n-90);
        --column-gap: var(--bb-grid-size-8);
        --row-gap: var(--bb-grid-size-6);
        --thumbnail-height: 175px;
        --details-min-height: 108px;
        --profile-pic-size: 28px;
        --max-description-lines: 3;
        --items-per-column: 4;
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

      bb-overflow-menu {
        position: fixed;
        right: auto;
        z-index: 20;
      }

      #boards {
        display: grid;
        grid-template-columns: repeat(var(--items-per-column), 1fr);
        grid-auto-rows: auto;
        column-gap: var(--column-gap);
        row-gap: var(--row-gap);
        margin-bottom: var(--bb-grid-size-8);
      }

      .board {
        position: relative;
        background: var(--light-dark-n-100);
        outline: 1px solid transparent;
        border-radius: var(--bb-grid-size-4);
        cursor: pointer;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        padding: 0;
        text-align: left;
        aspect-ratio: 35/39;

        &::before {
          content: "";
          position: absolute;
          pointer-events: none;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          z-index: 1;

          background:
            linear-gradient(0deg, rgba(0, 0, 0, 0) 70%, rgba(0, 0, 0, 0.4) 95%),
            linear-gradient(
              200deg,
              rgba(0, 0, 0, 0) 20%,
              rgba(0, 0, 0, 0.8) 70%
            );
        }

        &::after {
          box-sizing: border-box;
          content: "";
          position: absolute;
          pointer-events: none;
          top: 3px;
          left: 3px;
          width: calc(100% - 6px);
          height: calc(100% - 6px);
          z-index: 2;
          border-radius: calc(var(--bb-grid-size-4) - 3px);
          outline: 7px solid light-dark(var(--n-0), var(--n-80));
          opacity: 0;
          transition: opacity 0.2s cubic-bezier(0, 0, 0.3, 1);
        }

        &:hover:not(:has(button:hover)),
        &:focus:not(:has(button:focus)) {
          &::after {
            opacity: 1;
          }
        }

        .remix-button {
          position: absolute;
          top: var(--bb-grid-size-6);
          left: var(--bb-grid-size-6);
          height: var(--bb-grid-size-8);
          background: var(--light-dark-n-0);
          color: var(--light-dark-n-100);
          border-radius: var(--bb-grid-size-16);
          z-index: 10;
          display: flex;
          align-items: center;
          padding: 0 var(--bb-grid-size-4) 0 var(--bb-grid-size-3);
          border: none;
          transition:
            box-shadow 0.2s cubic-bezier(0, 0, 0.3, 1),
            opacity 0.2s cubic-bezier(0, 0, 0.3, 1);
          @media (min-width: 620px) {
            opacity: 0;
            pointer-events: none;
          }

          & .g-icon {
            margin-right: var(--bb-grid-size-2);
          }

          &:not([disabled]) {
            cursor: pointer;

            &:focus,
            &:hover {
              box-shadow:
                0px 1px 2px rgba(0, 0, 0, 0.3),
                0px 2px 6px 2px rgba(0, 0, 0, 0.15);
            }
          }
        }

        .overflow-pin,
        .overflow-menu {
          position: absolute;
          top: var(--bb-grid-size-6);
          right: var(--bb-grid-size-4);
          z-index: 10;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          padding: 0;
          border: none;
          background: transparent;
          color: var(--n-100);

          > * {
            pointer-events: none;
          }

          &:not([disabled]) {
            cursor: pointer;
          }
        }

        .overflow-pin {
          top: var(--bb-grid-size-4);
          right: auto;
          left: var(--bb-grid-size-4);
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0.3;
          transition: opacity 0.2s cubic-bezier(0, 0, 0.3, 1);

          @media (min-width: 620px) {
            opacity: 0;
            pointer-events: none;
          }

          & .g-icon {
            font-size: 20px;

            &::before {
              content: "keep";
            }
          }

          &.pinned {
            opacity: 1;
            pointer-events: auto;

            &:hover {
              background: oklch(from var(--light-dark-n-0) l c h / 38%);

              & .g-icon::before {
                content: "keep_off";
              }
            }
          }
        }

        &:hover {
          & .overflow-pin .g-icon {
            --icon-fill: 1;
          }

          & .overflow-pin,
          & .remix-button {
            opacity: 1;
            pointer-events: auto;
          }
        }

        .info {
          position: absolute;
          bottom: var(--bb-grid-size-5);
          left: var(--bb-grid-size-6);
          z-index: 10;
          color: var(--n-100);
          width: calc(100% - var(--bb-grid-size-10));

          & .title {
            margin: 0;
            max-height: 72px;
            overflow: hidden;
            margin-bottom: var(--bb-grid-size-2);
          }

          & .description {
            margin: 0;
            max-height: 60px;

            /* Line-based truncation with ellipsis */
            display: -webkit-box;
            -webkit-box-orient: vertical;
            -webkit-line-clamp: var(--max-description-lines);
            overflow: hidden;
          }
        }
      }

      .thumbnail {
        height: 100%;
        width: 100%;
        object-fit: cover;
        background-color: var(--light-dark-n-0);

        &.hidden {
          opacity: 0;
        }

        &.fade {
          animation: fadeIn 0.6s cubic-bezier(0.5, 0, 0.3, 1) forwards;
        }

        &.default {
          background-color: var(--n-100);
          object-fit: contain;
          box-sizing: border-box;
          padding: var(--bb-grid-size-8);
        }
      }

      .details {
        flex: 1;
        min-height: var(--details-min-height);
        padding: var(--bb-grid-size-2) var(--bb-grid-size-3);
        display: flex;
        flex-direction: column;
      }

      .creator {
        display: flex;
        justify-content: space-between;
        margin-bottom: var(--bb-grid-size-2);

        > span {
          display: flex;
          align-items: center;
        }

        .pic {
          display: inline-flex;

          .signed-in {
            width: var(--profile-pic-size);
            height: var(--profile-pic-size);
            border-radius: 50%;
          }

          .g-icon {
            width: var(--profile-pic-size);
            height: var(--profile-pic-size);
            color: var(--n-100);
            border-radius: 50%;
            background: var(--n-0);
            font-size: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
        }

        .name {
          color: var(--n-100);
          margin: 0 0 0 8px;
          display: inline-flex;
          align-items: center;
        }
      }

      #pagination {
        margin: 0;
        padding: 0;
        display: flex;
        justify-content: flex-end;
        justify-self: flex-end;
        margin-bottom: var(--bb-grid-size-10);
        max-width: 100%;
        overflow: hidden;

        #page-numbers {
          flex: 1;
          display: flex;
          overflow-x: hidden;
        }

        & button {
          display: flex;
          align-items: center;
          justify-content: center;
          font: 400 var(--bb-body-medium) / var(--bb-body-line-height-medium)
            var(--bb-font-family);
          width: var(--bb-grid-size-8);
          height: var(--bb-grid-size-8);
          background: none;
          border: none;
          margin-left: var(--bb-grid-size-2);
          border-radius: var(--bb-grid-size-2);
          color: light-dark(var(--n-10), var(--n-70));
          transition: background-color 0.2s cubic-bezier(0, 0, 0.3, 1);
          padding: 0;

          &:not([disabled]) {
            cursor: pointer;

            &:hover,
            &:focus {
              background: light-dark(var(--n-98), var(--n-20));
            }
          }

          &[disabled] {
            background: light-dark(var(--n-98), var(--n-20));
          }

          &#prev,
          &#next {
            width: auto;

            &[disabled] {
              background: transparent;
              color: var(--light-dark-n-80);

              &::before,
              &::after {
                opacity: 0.4;
              }
            }
          }

          &#prev {
            padding: 0 var(--bb-grid-size-2);
          }

          &#next {
            padding: 0 var(--bb-grid-size-2);
          }
        }
      }

      @media (max-width: 620px) {
        :host {
          --items-per-column: 2;
          --column-gap: var(--bb-grid-size-3);
          --row-gap: var(--bb-grid-size-3);
        }

        .board .info {
          left: var(--bb-grid-size-3);
          bottom: var(--bb-grid-size-3);
          width: calc(100% - var(--bb-grid-size-6));
        }

        .board .info .title {
          font-size: 14px;
          line-height: 18px;
          max-height: 54px;
          margin-bottom: var(--bb-grid-size);
        }

        .board .info .description {
          font-size: 12px;
          line-height: 14px;
        }

        .board .remix-button {
          top: var(--bb-grid-size-3);
          left: var(--bb-grid-size-3);
          height: var(--bb-grid-size-7);
          padding: 0 var(--bb-grid-size-3) 0 var(--bb-grid-size-2);
          font-size: 11px;
        }

        .board .remix-button .g-icon {
          font-size: 16px;
          margin-right: var(--bb-grid-size);
        }

        .board .overflow-pin,
        .board .overflow-menu {
          top: var(--bb-grid-size-3);
          right: var(--bb-grid-size-2);
        }

        .board .overflow-pin {
          left: var(--bb-grid-size-2);
        }

        .board .creator {
          margin-bottom: var(--bb-grid-size);
        }

        .board .creator .pic .g-icon,
        .board .creator .pic .signed-in {
          width: 20px;
          height: 20px;
          font-size: 16px;
        }

        .board .creator .name {
          font-size: 11px;
          margin-left: var(--bb-grid-size);
        }

        /* Pagination: larger touch targets and arrow icons on narrow screens */
        #pagination {
          & button {
            width: 48px;
            height: 48px;
            font-size: 16px;
          }

          & #prev,
          & #next {
            font-size: 0;
            width: 48px;
            padding: 0;

            &::before {
              font-family: "Google Symbols";
              font-size: 24px;
            }
          }

          & #prev::before {
            content: "arrow_left_alt";
          }

          & #next::before {
            content: "arrow_right_alt";
          }
        }
      }

      @keyframes fadeIn {
        from {
          opacity: 0;
        }

        to {
          opacity: 1;
        }
      }
    `,
  ];

  #overflowMenuConfig: { x: number; y: number; value: string } | null = null;

  @consume({ context: scaContext })
  accessor sca!: SCA;

  @property({ attribute: false })
  accessor items: [string, GraphProviderItem][] | null = null;

  @property({ attribute: false })
  accessor recentItems: string[] | null = null;

  @property({ type: Number })
  accessor page = 0;

  @property({ type: Boolean })
  accessor showOverflowMenu = false;

  @property({ type: Boolean })
  accessor forceCreatorToBeTeam = false;

  /**
   * How many items to display per page. Set to -1 to disable pagination.
   */
  @property({ type: Number })
  accessor pageSize = 8;

  readonly #paginationContainer = createRef<HTMLElement>();

  #isPinned(url: string): boolean {
    const recentBoards = this.sca.controller.home.recent.boards;
    const currentItem = recentBoards.find((board) => {
      return url === board.url;
    });

    let isPinned = false;
    if (currentItem) {
      isPinned = currentItem.pinned ?? false;
    }

    return isPinned;
  }

  override render() {
    const pageSize = this.pageSize ?? -1;
    const pageItems =
      this.pageSize > 0
        ? (this.items ?? []).slice(
            this.page * pageSize,
            (this.page + 1) * pageSize
          )
        : (this.items ?? []);

    let boardOverflowMenu: HTMLTemplateResult | symbol = nothing;
    if (this.showOverflowMenu && this.#overflowMenuConfig) {
      const isPinned = this.#isPinned(this.#overflowMenuConfig.value);
      const actions: OverflowAction[] = [
        {
          title: Strings.from("COMMAND_DELETE"),
          name: "delete",
          icon: "delete",
          value: this.#overflowMenuConfig.value,
        },
        {
          title: Strings.from("COMMAND_DUPLICATE"),
          name: "duplicate",
          icon: "duplicate",
          value: this.#overflowMenuConfig.value,
        },
        {
          title: isPinned
            ? Strings.from("COMMAND_UNPIN")
            : Strings.from("COMMAND_PIN"),
          name: "pin",
          icon: isPinned ? "unpin" : "pin",
          value: this.#overflowMenuConfig.value,
        },
      ];

      boardOverflowMenu = html`<bb-overflow-menu
        id="board-overflow"
        style=${styleMap({
          left: `${this.#overflowMenuConfig.x}px`,
          top: `${this.#overflowMenuConfig.y}px`,
        })}
        .actions=${actions}
        .disabled=${false}
        @bboverflowmenudismissed=${() => {
          this.showOverflowMenu = false;
        }}
        @bboverflowmenuaction=${async (actionEvt: OverflowMenuActionEvent) => {
          this.showOverflowMenu = false;
          if (!this.#overflowMenuConfig) {
            return;
          }

          switch (actionEvt.action) {
            case "delete": {
              this.dispatchEvent(
                new StateEvent({
                  eventType: "board.delete",
                  url: this.#overflowMenuConfig.value,
                  messages: {
                    query: GlobalStrings.from("QUERY_DELETE_PROJECT"),
                    start: GlobalStrings.from("STATUS_DELETING_PROJECT"),
                    end: GlobalStrings.from("STATUS_PROJECT_DELETED"),
                    error: GlobalStrings.from("ERROR_UNABLE_TO_CREATE_PROJECT"),
                  },
                })
              );
              break;
            }

            case "duplicate": {
              this.#onRemixButtonClick(
                actionEvt,
                this.#overflowMenuConfig.value
              );
              break;
            }

            case "pin": {
              this.dispatchEvent(
                new StateEvent({
                  eventType: "board.togglepin",
                  url: this.#overflowMenuConfig.value,
                  status: isPinned ? "unpin" : "pin",
                })
              );
              break;
            }
          }

          this.#overflowMenuConfig = null;
        }}
      ></bb-overflow-menu>`;
    }

    return html`
      <div id="boards">
        ${pageItems.map((item) => {
          const isPinned = this.#isPinned(item[0]);
          return this.#renderBoard(item, isPinned);
        })}
      </div>
      ${this.#renderPagination()} ${boardOverflowMenu}
    `;
  }

  async #renderThumbnail(thumbnail: string | null | undefined) {
    return await renderThumbnail(
      thumbnail,
      this.sca.services.googleDriveClient!,
      {
        thumbnail: true,
      }
    );
  }

  #renderBoard([name, item]: [string, GraphProviderItem], isPinned = false) {
    const { url, mine, title, description, thumbnail } = item;

    return html`
      <div
        aria-role="button"
        class=${classMap({ board: true, mine })}
        tabindex="0"
        @click=${(event: PointerEvent) => this.#onBoardClick(event, url)}
        @keydown=${(event: KeyboardEvent) => this.#onBoardKeydown(event, url)}
      >
        ${keyed(
          thumbnail,
          html`${guard([thumbnail], () =>
            until(this.#renderThumbnail(thumbnail))
          )}`
        )}
        ${mine
          ? html` <button
                class=${classMap({ "overflow-pin": true, pinned: isPinned })}
                @click=${(evt: Event) => {
                  evt.preventDefault();
                  evt.stopImmediatePropagation();

                  this.dispatchEvent(
                    new StateEvent<"board.togglepin">({
                      eventType: "board.togglepin",
                      status: isPinned ? "unpin" : "pin",
                      url,
                    })
                  );
                }}
              >
                <span class="g-icon filled heavy round"></span>
              </button>
              <button
                class="overflow-menu"
                @click=${(evt: Event) => {
                  evt.preventDefault();
                  evt.stopImmediatePropagation();

                  if (!(evt.target instanceof HTMLButtonElement)) {
                    return;
                  }

                  const bounds = evt.target.getBoundingClientRect();
                  let x = bounds.x;
                  if (x + 144 > window.innerWidth) {
                    x = window.innerWidth - 144;
                  }

                  this.#overflowMenuConfig = {
                    x,
                    y: bounds.bottom,
                    value: url,
                  };
                  this.showOverflowMenu = true;
                }}
              >
                <span class="g-icon filled heavy w-500 round">more_vert</span>
              </button>`
          : html` <button
              class=${classMap({
                "remix-button": true,
                "sans-flex": true,
                "w-500": true,
                round: true,
                "md-body-small": true,
                persistent: !mine,
              })}
              @click=${(event: PointerEvent) =>
                this.#onRemixButtonClick(event, url)}
              @keydown=${(event: KeyboardEvent) =>
                this.#onRemixButtonKeydown(event, url)}
            >
              <span class="g-icon filled round">gesture</span>
              ${Strings.from("COMMAND_REMIX")}
            </button>`}
        <div class="info">
          ${mine
            ? nothing
            : html` <div class="creator">
                <span>
                  <span class="pic">${this.#renderCreatorImage(item)}</span>
                  <span class="name md-title-small sans-flex round w-400"
                    >${this.#renderCreatorName(item)}</span
                  >
                </span>
              </div>`}
          <h4 class="title sans-flex round w-500 md-headline-medium">
            ${title ?? name}
          </h4>
          <p class="description sans-flex round w-400 md-body-medium">
            ${description ?? "No description"}
          </p>
        </div>
      </div>
    `;
  }

  #renderCreatorImage(item: GraphProviderItem) {
    if (this.forceCreatorToBeTeam) {
      return html`<span class="g-icon">spark</span>`;
    }
    if (item.mine && this.sca.services.signinAdapter.pictureSignal) {
      return html`
        <img
          class="signed-in"
          crossorigin="anonymous"
          src=${this.sca.services.signinAdapter.pictureSignal}
        />
      `;
    }
    return html`<span class="g-icon">person</span>`;
  }

  #renderCreatorName(item: GraphProviderItem) {
    if (this.forceCreatorToBeTeam) {
      return Strings.from("LABEL_TEAM_NAME");
    }
    if (!item.mine || !this.sca.services.signinAdapter) {
      return "Unknown User";
    }
    return this.sca.services.signinAdapter.nameSignal || "Unknown User";
  }

  #renderPagination() {
    const pageSize = this.pageSize;
    const items = this.items ?? [];
    const pages =
      items.length % pageSize === 0
        ? items.length / pageSize
        : Math.floor(items.length / pageSize) + 1;
    if (pages <= 1) {
      return nothing;
    }
    return html`
      <menu id="pagination">
        <span>
          <button
            id="prev"
            ?disabled=${this.page === 0}
            @click=${this.#onClickPrevPage}
          >
            ${Strings.from("COMMAND_PREVIOUS")}
          </button>
        </span>
        <div id="page-numbers" ${ref(this.#paginationContainer)}>
          ${new Array(pages).fill(undefined).map((_, idx) => {
            return html`
              <span>
                <button
                  ?disabled=${idx === this.page}
                  data-page-idx=${idx}
                  @click=${this.#onClickPageNumber}
                >
                  ${idx + 1}
                </button>
              </span>
            `;
          })}
        </div>
        <span>
          <button
            id="next"
            ?disabled=${this.page === pages - 1}
            @click=${this.#onClickNextPage}
          >
            ${Strings.from("COMMAND_NEXT")}
          </button>
        </span>
      </menu>
    `;
  }

  #onClickPageNumber(event: PointerEvent & { target: HTMLElement }) {
    this.page = Number(event.target.dataset.pageIdx);
    this.#scrollCurrentPageNumberButtonIntoView();
  }

  #onClickPrevPage() {
    this.page--;
    this.#scrollCurrentPageNumberButtonIntoView();
  }

  #onClickNextPage() {
    this.page++;
    this.#scrollCurrentPageNumberButtonIntoView();
  }

  #scrollCurrentPageNumberButtonIntoView() {
    const container = this.#paginationContainer.value;
    if (!container) {
      console.error("Could not find pagination container");
      return;
    }
    const button = container.querySelector(`[data-page-idx="${this.page}"]`);
    if (!button) {
      console.error("Could not find page number button");
      return;
    }
    const isOverflowing = container.scrollWidth > container.clientWidth;
    if (isOverflowing) {
      button.scrollIntoView({
        block: "nearest",
        inline: "center",
        behavior: "smooth",
      });
    }
  }

  #onBoardClick(_event: PointerEvent | KeyboardEvent, url: string) {
    this.sca?.services.actionTracker?.openApp(
      url,
      this.forceCreatorToBeTeam ? "gallery" : "user"
    );
    this.dispatchEvent(
      new StateEvent({
        eventType: "board.load",
        url,
        shared: this.forceCreatorToBeTeam,
      })
    );
  }

  #onBoardKeydown(event: KeyboardEvent, url: string) {
    if (event.key === "Enter" || event.key === "Space") {
      return this.#onBoardClick(event, url);
    }
  }

  #onRemixButtonClick(
    event: PointerEvent | KeyboardEvent | OverflowMenuActionEvent,
    url: string
  ) {
    this.sca?.services.actionTracker?.remixApp(
      url,
      this.forceCreatorToBeTeam ? "gallery" : "user"
    );
    event.stopPropagation();
    this.dispatchEvent(
      new StateEvent({
        eventType: "board.remix",
        messages: {
          start: GlobalStrings.from("STATUS_REMIXING_PROJECT"),
          end: GlobalStrings.from("STATUS_PROJECT_CREATED"),
          error: GlobalStrings.from("ERROR_UNABLE_TO_CREATE_PROJECT"),
        },
        url,
      })
    );
  }

  #onRemixButtonKeydown(event: KeyboardEvent, url: string) {
    if (event.key === "Enter" || event.key === "Space") {
      event.stopPropagation();
      return this.#onRemixButtonClick(event, url);
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bb-gallery": Gallery;
  }
}
