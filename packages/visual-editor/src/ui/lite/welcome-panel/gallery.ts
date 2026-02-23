/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GraphProviderItem } from "@breadboard-ai/types";
import { consume } from "@lit/context";
import { css, html, HTMLTemplateResult, LitElement, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { keyed } from "lit/directives/keyed.js";
import { createRef, ref } from "lit/directives/ref.js";
import { styleMap } from "lit/directives/style-map.js";
import { OverflowMenuActionEvent, StateEvent } from "../../events/events.js";
import * as StringsHelper from "../../strings/helper.js";
import { OverflowAction } from "../../types/types.js";
import { until } from "lit/directives/until.js";
import { renderThumbnail } from "../../media/image.js";
import { guard } from "lit/directives/guard.js";
import { SignalWatcher } from "@lit-labs/signals";
import * as Styles from "../../styles/styles.js";
import { scaContext } from "../../../sca/context/context.js";
import { type SCA } from "../../../sca/sca.js";

const COLLAPSED_KEY = "gallery-lite-collapsed";
const GlobalStrings = StringsHelper.forSection("Global");
const Strings = StringsHelper.forSection("ProjectListing");

@customElement("bb-gallery-lite")
export class GalleryLite extends SignalWatcher(LitElement) {
  static readonly styles = [
    Styles.HostIcons.icons,
    Styles.HostColorsMaterial.baseColors,
    Styles.HostType.type,
    css`
      :host {
        display: block;
        overflow: hidden;
      }

      bb-overflow-menu {
        position: fixed;
        right: auto;
        z-index: 100;
      }

      #boards {
        overflow: hidden;
        height: var(--expanded-height);
        transition: height 200ms cubic-bezier(0.2, 0, 0, 1);

        & #boards-inner {
          display: grid;
          grid-template-columns: repeat(var(--items-per-column), 1fr);
          grid-template-rows: auto;
          grid-auto-rows: auto;
          column-gap: var(--column-gap);
          row-gap: var(--row-gap);
          position: relative;

          & #sentinel-collapsed {
            --gap-width: (var(--items-per-column) - 1) * var(--column-gap);
            width: calc((100% - var(--gap-width)) / var(--items-per-column));
            pointer-events: none;
            position: absolute;
            top: 0;
            left: 0;
            background: red;
            aspect-ratio: 35 / 39;
            opacity: 0;
            z-index: -1;
          }

          & #sentinel-expanded {
            width: 20px;
            pointer-events: none;
            position: absolute;
            top: 0;
            right: 0;
            height: 100%;
            background: green;
            opacity: 0;
            z-index: -1;
          }
        }

        &.empty #boards-inner #sentinel-collapsed {
          aspect-ratio: initial;
        }
      }

      :host([iscollapsed]) #boards {
        height: var(--collapsed-height);
      }

      .gallery-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        color: var(--sys-color--on-surface);
        padding-bottom: var(--bb-grid-size-4);

        & .gallery-title {
          display: flex;
          align-items: center;
          flex: 1 0 0;
          margin: 0;

          & .g-icon {
            margin-left: var(--bb-grid-size-2);
          }
        }
      }

      #show-more-button {
        display: flex;
        align-items: center;
        background: transparent;
        border-radius: var(--bb-grid-size-16);
        border: none;
        height: var(--bb-grid-size-10);
        padding: 0 var(--bb-grid-size-3) 0 var(--bb-grid-size-4);
        color: var(--sys-color--primary);
        cursor: pointer;
        transition: background 0.2s cubic-bezier(0, 0, 0.3, 1);
        position: relative;
        -webkit-font-smoothing: antialiased;

        &:not([disabled]) {
          &:hover,
          &:focus {
            &::after {
              content: "";
              pointer-events: none;
              background: var(--sys-color--primary);
              opacity: 0.08;
              position: absolute;
              inset: 0;
              border-radius: var(--bb-grid-size-16);
            }
          }
        }

        .g-icon {
          font-size: 1.125rem;
          font-variation-settings:
            "ROND" 100,
            "wght" 500;
          margin-left: var(--bb-grid-size-2);

          &::after {
            content: "collapse_all";
          }
          &.collapsed::after {
            content: "expand_all";
          }
        }
      }

      .board {
        position: relative;
        background: light-dark(var(--n-100), var(--n-0));
        outline: 1px solid transparent;
        border-radius: var(--bb-grid-size-3);
        cursor: pointer;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        padding: 0;
        text-align: left;
        aspect-ratio: 35/39;
        transition: opacity 450ms cubic-bezier(0, 0, 0.3, 1) 20ms;
        opacity: 1;

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
          border-radius: calc(var(--bb-grid-size-3) - 3px);
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

        &.hidden {
          opacity: 0;
        }

        .remix-button {
          position: absolute;
          top: var(--bb-grid-size-3);
          left: var(--bb-grid-size-3);
          height: var(--bb-grid-size-8);
          background: light-dark(var(--n-0), var(--n-100));
          color: light-dark(var(--n-100), var(--n-0));
          border-radius: var(--bb-grid-size-16);
          z-index: 10;
          display: flex;
          align-items: center;
          padding: 0 var(--bb-grid-size-4) 0 var(--bb-grid-size-3);
          border: none;
          transition:
            box-shadow 0.2s cubic-bezier(0, 0, 0.3, 1),
            opacity 0.2s cubic-bezier(0, 0, 0.3, 1);
          opacity: 0;
          pointer-events: none;

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
          width: 20px;
          height: 20px;
          border-radius: 50%;
          padding: 0;
          border: none;
          background: transparent;
          color: var(--light-dark-n-100);
          z-index: 10;

          > * {
            pointer-events: none;
          }

          &:not([disabled]) {
            cursor: pointer;
          }
        }

        .overflow-pin {
          transition: opacity 0.2s cubic-bezier(0, 0, 0.3, 1);
          opacity: 0;
          pointer-events: none;
          opacity: 0;
          right: auto;
          left: var(--bb-grid-size-4);

          & .g-icon::before {
            content: "keep";
          }

          &.pinned {
            opacity: 1;
            pointer-events: auto;
          }
        }

        &:hover {
          & .overflow-pin,
          & .remix-button {
            opacity: 1;
            pointer-events: auto;
          }

          & .overflow-pin {
            &:hover {
              background: oklch(from var(--light-dark-n-0) l c h / 38%);
            }

            &.pinned {
              & .g-icon::before {
                content: "keep_off";
              }
            }
          }
        }

        .info {
          position: absolute;
          bottom: 16px;
          left: 16px;
          z-index: 10;
          color: var(--light-dark-n-100);
          width: calc(100% - 32px);

          & .title {
            margin: 0;
            max-height: 96px;
            overflow: hidden;
            margin-bottom: var(--bb-grid-size-2);
            /* Line-based truncation with ellipsis */
            display: -webkit-box;
            -webkit-box-orient: vertical;
            -webkit-line-clamp: var(--max-title-lines);
            overflow: hidden;
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
          background-color: light-dark(var(--n-100), var(--n-0));
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
            color: var(--light-dark-n-100);
            border-radius: 50%;
            background: var(--light-dark-n-0);
            font-size: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
        }

        .name {
          color: var(--light-dark-n-100);
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
        margin-top: var(--bb-grid-size-4);
        color: var(--sys-color--on-surface);

        #page-numbers {
          margin-right: var(--bb-grid-size-3);
        }

        & input {
          width: var(--bb-grid-size-4);
          text-align: center;
          field-sizing: content;
          border: 1px solid var(--sys-color--surface-container-highest);
          border-radius: var(--bb-grid-size);
          background: var(--sys-color--surface);
        }

        input[type="number"]::-webkit-outer-spin-button,
        input[type="number"]::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }

        & button {
          display: flex;
          align-items: center;
          justify-content: center;
          background: none;
          border: none;
          color: oklch(
            from var(--sys-color--on-surface) l c h / calc(alpha * 0.38)
          );
          transition: color 0.2s cubic-bezier(0, 0, 0.3, 1);
          padding: 0;

          &:not([disabled]) {
            cursor: pointer;

            &:hover,
            &:focus {
              color: var(--sys-color--on-surface);
            }
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

  @property()
  accessor headerIcon: string | null = null;

  @property()
  accessor headerText: string | null = null;

  @property({ type: Boolean })
  accessor collapsable = false;

  @property({ attribute: false })
  accessor recentItems: string[] | null = null;

  @property({ type: Number })
  accessor page = 0;

  @property({ type: Boolean })
  accessor showOverflowMenu = false;

  @property({ type: Boolean })
  accessor forceCreatorToBeTeam = false;

  @property({ type: Boolean, reflect: true })
  set isCollapsed(collapsed: boolean) {
    this.#isCollapsed = collapsed;
    sessionStorage.setItem(COLLAPSED_KEY, String(this.#isCollapsed));
  }
  get isCollapsed() {
    return this.#isCollapsed;
  }
  #isCollapsed = true;

  /**
   * How many items to display per page. Set to -1 to disable pagination.
   */
  @property({ type: Number })
  accessor pageSize = 4;

  @property({ reflect: true, type: Boolean })
  accessor isAnimatingHeight = false;

  readonly #paginationContainer = createRef<HTMLElement>();
  readonly #boardsSentinelCollapsed = createRef<HTMLElement>();
  readonly #boardsSentinelExpanded = createRef<HTMLElement>();

  #collapsedHeight = 0;
  #expandedHeight = 0;
  #boardsContainer: HTMLElement | undefined = undefined;
  #boardIntersectionObserver: IntersectionObserver | null = null;
  #boardsContainerResizeObserver = new ResizeObserver(() => {
    if (!this.#boardsContainer) {
      return;
    }

    if (
      !this.#boardsSentinelCollapsed.value ||
      !this.#boardsSentinelExpanded.value
    ) {
      return;
    }

    this.#collapsedHeight = this.#boardsSentinelCollapsed.value.offsetHeight;
    this.#expandedHeight = this.#boardsSentinelExpanded.value.offsetHeight;
    this.style.setProperty(`--collapsed-height`, `${this.#collapsedHeight}px`);
    this.style.setProperty(`--expanded-height`, `${this.#expandedHeight}px`);
  });

  constructor() {
    super();

    this.isCollapsed =
      sessionStorage.getItem(COLLAPSED_KEY) === "false" ? false : true;
  }

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

  async #toggleCollapsedState() {
    const container = this.#boardsContainer;
    if (container) {
      this.isCollapsed = !this.isCollapsed;
      await this.updateComplete;
    }
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

    if (this.#boardIntersectionObserver) {
      this.#boardIntersectionObserver.disconnect();
    }

    return html`
      <section class="gallery-header">
        <h2 class="gallery-title md-title-medium sans-flex w-400">
          ${this.headerText}
          ${this.headerIcon
            ? html`<span class="g-icon filled heavy round"
                >${this.headerIcon}</span
              >`
            : nothing}
        </h2>
        <slot name="actions"></slot>
        ${this.collapsable
          ? html`
              <button
                id="show-more-button"
                class="md-title-small sans-flex w-500"
                @click=${this.#toggleCollapsedState}
              >
                ${Strings.from(
                  this.isCollapsed ? "COMMAND_SHOW_MORE" : "COMMAND_SHOW_LESS"
                )}
                <span
                  class=${classMap({
                    "g-icon": true,
                    round: true,
                    collapsed: this.collapsable && this.isCollapsed,
                  })}
                ></span>
              </button>
            `
          : nothing}
      </section>
      <div
        id="boards"
        ${ref((el?: Element) => {
          this.#boardsContainer = undefined;
          if (!(el instanceof HTMLElement)) {
            this.#boardsContainerResizeObserver.disconnect();
            return;
          }

          this.#boardsContainer = el;
          this.#boardsContainerResizeObserver.observe(this.#boardsContainer);

          const THRESHOLD = 0.95;
          this.#boardIntersectionObserver = new IntersectionObserver(
            (entries) => {
              for (const entry of entries) {
                if (!(entry.target instanceof HTMLElement)) continue;
                entry.target.classList.toggle(
                  "hidden",
                  entry.intersectionRatio < THRESHOLD
                );
              }
            },
            { root: this.#boardsContainer, threshold: THRESHOLD }
          );
        })}
        class=${classMap({
          collapsed: this.collapsable && this.isCollapsed,
          empty: pageItems.length === 0,
        })}
      >
        <div id="boards-inner">
          ${pageItems.map((item) => {
            const isPinned = this.#isPinned(item[0]);
            return this.#renderBoard(item, isPinned);
          })}

          <div
            ${ref(this.#boardsSentinelCollapsed)}
            id="sentinel-collapsed"
          ></div>
          <div
            ${ref(this.#boardsSentinelExpanded)}
            id="sentinel-expanded"
          ></div>
        </div>
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
        ${ref((el?: Element) => {
          if (!el) return;
          requestAnimationFrame(() => {
            if (!this.#boardIntersectionObserver) return;
            this.#boardIntersectionObserver.observe(el);
          });
        })}
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
                <span class="g-icon filled heavy"></span>
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
                <span class="g-icon filled heavy w-500">more_vert</span>
              </button>`
          : html` <button
              class=${classMap({
                "remix-button": true,
                "sans-flex": true,
                "w-500": true,
                "md-body-small": true,
                persistent: !mine,
              })}
              @click=${(event: PointerEvent) =>
                this.#onRemixButtonClick(event, url)}
              @keydown=${(event: KeyboardEvent) =>
                this.#onRemixButtonKeydown(event, url)}
            >
              <span class="g-icon filled">gesture</span>
              ${Strings.from("COMMAND_REMIX")}
            </button>`}
        <div class="info">
          <h4 class="title sans-flex w-500 md-label-large round">
            ${title ?? name}
          </h4>
          <p class="description sans-flex w-400 md-label-small">
            ${description ?? "No description"}
          </p>
        </div>
      </div>
    `;
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
      <menu id="pagination" class="md-label-medium">
        <div id="page-numbers" ${ref(this.#paginationContainer)}>
          <input
            @keydown=${(evt: KeyboardEvent) => {
              if (
                evt.key !== "Enter" ||
                !(evt.target instanceof HTMLInputElement)
              ) {
                return;
              }

              const value = Number.parseInt(evt.target.value);
              if (
                Number.isNaN(value) ||
                value === this.page ||
                value < 1 ||
                value > pages
              ) {
                return;
              }

              this.page = value - 1;
            }}
            name="page-number"
            class="md-label-medium"
            type="number"
            .value=${this.page + 1}
          />
          of ${pages}
        </div>
        <button
          id="prev"
          ?disabled=${this.page === 0}
          @click=${this.#onClickPrevPage}
        >
          <span class="g-icon filled heavy round">chevron_left</span>
        </button>
        <button
          id="next"
          ?disabled=${this.page === pages - 1}
          @click=${this.#onClickNextPage}
        >
          <span class="g-icon filled heavy round">chevron_right</span>
        </button>
      </menu>
    `;
  }

  #onClickPrevPage() {
    this.page--;
  }

  #onClickNextPage() {
    this.page++;
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
    "bb-gallery-lite": GalleryLite;
  }
}
