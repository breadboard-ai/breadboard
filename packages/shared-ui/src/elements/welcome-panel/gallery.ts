/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GraphProviderItem } from "@google-labs/breadboard";
import { consume } from "@lit/context";
import { css, html, HTMLTemplateResult, LitElement, nothing, svg } from "lit";
import { customElement, property } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { keyed } from "lit/directives/keyed.js";
import { createRef, ref } from "lit/directives/ref.js";
import { styleMap } from "lit/directives/style-map.js";
import {
  BoardDeleteEvent,
  GraphBoardServerLoadRequestEvent,
  GraphBoardServerRemixRequestEvent,
  OverflowMenuActionEvent,
} from "../../events/events.js";
import * as StringsHelper from "../../strings/helper.js";
import { icons } from "../../styles/icons.js";
import { OverflowAction } from "../../types/types.js";
import {
  type SigninAdapter,
  signinAdapterContext,
} from "../../utils/signin-adapter.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";

const Strings = StringsHelper.forSection("ProjectListing");

@customElement("bb-gallery")
export class Gallery extends LitElement {
  static readonly styles = [
    icons,
    css`
      :host {
        --border: 1px solid var(--bb-neutral-300);
        --column-gap: var(--bb-grid-size-6);
        --row-gap: var(--bb-grid-size-4);
        --thumbnail-height: 175px;
        --details-min-height: 108px;
        --profile-pic-size: 20px;
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
        border: var(--border);
        background: var(--bb-neutral-0);
        outline: 1px solid transparent;
        border-radius: var(--bb-grid-size-2);
        cursor: pointer;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        padding: 0;
        text-align: left;

        &:hover:not(:has(button:hover)),
        &:focus:not(:has(button:focus)) {
          outline: 1px solid var(--bb-neutral-400);
        }
      }

      .thumbnail {
        height: var(--thumbnail-height);
        width: 100%;
        object-fit: cover;
        border-bottom: var(--border);
        /* Matches the color of the placeholder background */
        background-color: #ebf5ff;

        &.default {
          background-color: var(--bb-neutral-0);
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
            color: #0a89f1;
            border-radius: 50%;
            background: #000;
            font-size: var(--profile-pic-size);
          }
        }
        .name {
          color: #444746;
          font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
            var(--bb-font-family);
          margin: 0 0 0 8px;
          display: inline-flex;
          align-items: center;
        }

        .overflow-menu {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: var(--bb-neutral-0);
          padding: 0;
          border: none;
          transition: background-color 0.2s cubic-bezier(0, 0, 0.3, 1);

          > * {
            pointer-events: none;
          }

          &:not([disabled]) {
            cursor: pointer;

            &:hover,
            &:focus {
              background-color: var(--bb-neutral-50);
            }
          }
        }
      }

      .title {
        margin: var(--bb-grid-size-2) 0 0 0;
        color: #1f1f1f;
        font: 500 var(--bb-title-small) / var(--bb-title-line-height-small)
          var(--bb-font-family);
      }

      .description {
        margin: var(--bb-grid-size-2) 0 0 0;
        color: #444746;
        font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
          var(--bb-font-family);

        /* Line-based truncation with ellipsis */
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: var(--max-description-lines);
        overflow: hidden;
      }

      .button-container {
        margin-top: auto;
        align-self: flex-end;
        .remix-button {
          padding: 6px 16px;
          background: transparent;
          margin: var(--bb-grid-size-2) calc(var(--bb-grid-size) * -1) 0 0;
          font: 500 var(--bb-body-medium) / var(--bb-body-line-height-medium)
            var(--bb-font-family);
          color: #575b5f;
          border: 1px solid var(--bb-neutral-400);
          border-radius: 8px;
          cursor: pointer;
          &:hover {
            outline: 1px solid var(--bb-neutral-400);
          }
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
          color: var(--bb-neutral-900);
          transition: background-color 0.2s cubic-bezier(0, 0, 0.3, 1);
          padding: 0;

          &:not([disabled]) {
            cursor: pointer;

            &:hover,
            &:focus {
              background: var(--bb-neutral-50);
            }
          }

          &[disabled] {
            background: var(--bb-neutral-100);
          }

          &#prev,
          &#next {
            width: auto;

            &[disabled] {
              background: transparent;
              color: var(--bb-neutral-400);

              &::before,
              &::after {
                opacity: 0.4;
              }
            }
          }

          &#prev {
            padding: 0 var(--bb-grid-size-2) 0 var(--bb-grid-size);

            &::before {
              content: "";
              width: 20px;
              height: 20px;
              background: var(--bb-icon-before) center center / 20px 20px
                no-repeat;
              margin-right: var(--bb-grid-size-2);
            }
          }

          &#next {
            padding: 0 var(--bb-grid-size) 0 var(--bb-grid-size-2);

            &::after {
              content: "";
              width: 20px;
              height: 20px;
              background: var(--bb-icon-next) center center / 20px 20px
                no-repeat;
              margin-left: var(--bb-grid-size-2);
            }
          }
        }
      }
    `,
  ];

  #overflowMenuConfig: { x: number; y: number; value: string } | null = null;

  @consume({ context: signinAdapterContext })
  accessor signinAdapter: SigninAdapter | undefined = undefined;

  @property({ attribute: false })
  accessor items: [string, GraphProviderItem][] | undefined = undefined;

  @property({ attribute: false })
  accessor recentItems: string[] | undefined = undefined;

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
      const actions: OverflowAction[] = [
        {
          title: Strings.from("COMMAND_DELETE"),
          name: "delete",
          icon: "delete",
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
                new BoardDeleteEvent(this.#overflowMenuConfig.value)
              );
              break;
            }
          }

          this.#overflowMenuConfig = null;
        }}
      ></bb-overflow-menu>`;
    }

    return html`
      <div id="boards">${pageItems.map((item) => this.#renderBoard(item))}</div>
      ${this.#renderPagination()} ${boardOverflowMenu}
    `;
  }

  #renderThumbnail(thumbnail?: string | null) {
    // TODO: Replace this with a more robust check. The theme does include this
    // information but the board server logic doesn't currently expose it.
    const svgPrefix = "data:image/svg+xml;base64,";
    if (thumbnail?.startsWith(svgPrefix)) {
      return svg`${unsafeHTML(thumbnail!.substring(svgPrefix.length))}`;
    } else {
      const isDefaultTheme = thumbnail?.startsWith("data:") ?? false;
      return html`<img
        class=${classMap({ thumbnail: true, default: isDefaultTheme })}
        src=${thumbnail ?? "/images/placeholder.svg"}
      />`;
    }
  }

  #renderBoard([name, item]: [string, GraphProviderItem]) {
    const { url, mine, title, description, thumbnail } = item;

    return html`
      <div
        aria-role="button"
        class=${classMap({ board: true, mine })}
        tabindex="0"
        @click=${(event: PointerEvent) => this.#onBoardClick(event, url)}
        @keydown=${(event: KeyboardEvent) => this.#onBoardKeydown(event, url)}
      >
        ${keyed(thumbnail, this.#renderThumbnail(thumbnail))}
        <div class="details">
          <div class="creator">
            <span>
              <span class="pic">${this.#renderCreatorImage(item)}</span>
              <span class="name">by ${this.#renderCreatorName(item)}</span>
            </span>
            ${mine
              ? html`<button
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
                  <span class="g-icon">more_vert</span>
                </button>`
              : nothing}
          </div>
          <h4 class="title">${title ?? name}</h4>
          <p class="description">${description ?? "No description"}</p>
          ${mine
            ? nothing
            : html`
                <div class="button-container">
                  <button
                    class="remix-button"
                    @click=${(event: PointerEvent) =>
                      this.#onRemixButtonClick(event, url)}
                    @keydown=${(event: KeyboardEvent) =>
                      this.#onRemixButtonKeydown(event, url)}
                  >
                    ${Strings.from("COMMAND_REMIX")}
                  </button>
                </div>
              `}
        </div>
      </div>
    `;
  }

  #renderCreatorImage(item: GraphProviderItem) {
    if (this.forceCreatorToBeTeam) {
      return html`<span class="g-icon">spark</span>`;
    }
    if (item.mine && this.signinAdapter?.picture) {
      return html`
        <img
          class="signed-in"
          crossorigin="anonymous"
          src=${this.signinAdapter.picture}
        />
      `;
    }
    return html`<span class="g-icon">person</span>`;
  }

  #renderCreatorName(item: GraphProviderItem) {
    if (this.forceCreatorToBeTeam) {
      return Strings.from("LABEL_TEAM_NAME");
    }
    if (item.mine && this.signinAdapter?.name) {
      return this.signinAdapter.name;
    }
    return "Unknown User";
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
    this.dispatchEvent(new GraphBoardServerLoadRequestEvent(url));
  }

  #onBoardKeydown(event: KeyboardEvent, url: string) {
    if (event.key === "Enter" || event.key === "Space") {
      return this.#onBoardClick(event, url);
    }
  }

  #onRemixButtonClick(event: PointerEvent | KeyboardEvent, url: string) {
    event.stopPropagation();
    this.dispatchEvent(new GraphBoardServerRemixRequestEvent(url));
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
