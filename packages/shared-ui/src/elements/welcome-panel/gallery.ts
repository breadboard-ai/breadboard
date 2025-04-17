/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GraphProviderItem } from "@google-labs/breadboard";
import { consume } from "@lit/context";
import { css, html, LitElement, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import {
  GraphBoardServerLoadRequestEvent,
  GraphBoardServerRemixRequestEvent,
} from "../../events/events.js";
import * as StringsHelper from "../../strings/helper.js";
import { icons } from "../../styles/icons.js";
import {
  type SigninAdapter,
  signinAdapterContext,
} from "../../utils/signin-adapter.js";

const Strings = StringsHelper.forSection("ProjectListing");

@customElement("bb-gallery")
export class Gallery extends LitElement {
  static readonly styles = [
    icons,
    css`
      :host {
        --board-width: 248px;
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

      #boards {
        display: grid;
        grid-template-columns: repeat(var(--items-per-column), 1fr);
        grid-auto-rows: auto;
        column-gap: var(--column-gap);
        row-gap: var(--row-gap);
        margin-bottom: var(--bb-grid-size-8);
      }

      .board {
        width: var(--board-width);
        border: var(--border);
        background: var(--bb-neutral-0);
        outline: 1px solid transparent;
        border-radius: var(--bb-grid-size-2);
        cursor: pointer;
        overflow: hidden;
        display: flex;
        flex-direction: column;
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
        list-style: none;
        display: flex;
        justify-content: flex-end;
        height: var(--bb-grid-size-8);
        margin-bottom: var(--bb-grid-size-10);
        width: 100%;
        overflow: hidden;

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

  @consume({ context: signinAdapterContext })
  accessor signinAdapter: SigninAdapter | undefined = undefined;

  @property({ attribute: false })
  accessor items: [string, GraphProviderItem][] | undefined = undefined;

  @property({ attribute: false })
  accessor recentItems: string[] | undefined = undefined;

  @property({ type: Number })
  accessor page = 0;

  /**
   * How many items to display per page. Set to -1 to disable pagination.
   */
  @property({ type: Number })
  accessor pageSize = 8;

  override render() {
    const pageSize = this.pageSize ?? -1;
    const pageItems =
      this.pageSize > 0
        ? (this.items ?? []).slice(
            this.page * pageSize,
            (this.page + 1) * pageSize
          )
        : (this.items ?? []);
    return html`
      <div id="boards">${pageItems.map((item) => this.#renderBoard(item))}</div>
      ${this.#renderPagination()}
    `;
  }

  #renderBoard([name, item]: [string, GraphProviderItem]) {
    const { url, mine, title, description, thumbnail } = item;
    return html`
      <div
        class=${classMap({ board: true, mine })}
        aria-role="button"
        tabindex="0"
        @click=${(event: PointerEvent) => this.#onBoardClick(event, url)}
        @keydown=${(event: KeyboardEvent) => this.#onBoardKeydown(event, url)}
      >
        <img class="thumbnail" src=${thumbnail ?? "/images/placeholder.svg"} />
        <div class="details">
          <div class="creator">
            <span class="pic">${this.#renderCreatorImage(item)}</span>
            <span class="name">by ${this.#renderCreatorName(item)}</span>
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
    if (item.mine && this.signinAdapter?.picture) {
      return html`
        <img
          class="signed-in"
          crossorigin="anonymous"
          src=${this.signinAdapter.picture}
        />
      `;
    }
    if (item.tags && item.tags.includes("featured")) {
      return html`<span class="g-icon">spark</span>`;
    }
    return html`<span class="g-icon">person</span>`;
  }

  #renderCreatorName(item: GraphProviderItem) {
    if (item.mine && this.signinAdapter?.name) {
      return this.signinAdapter.name;
    }
    if (item.tags && item.tags.includes("featured")) {
      return Strings.from("LABEL_TEAM_NAME");
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
        <li>
          <button
            id="prev"
            ?disabled=${this.page === 0}
            @click=${() => {
              this.page--;
            }}
          >
            ${Strings.from("COMMAND_PREVIOUS")}
          </button>
        </li>
        ${new Array(pages).fill(undefined).map((_, idx) => {
          return html`<li>
            <button
              ?disabled=${idx === this.page}
              @click=${() => {
                this.page = idx;
              }}
            >
              ${idx + 1}
            </button>
          </li>`;
        })}
        <li>
          <button
            id="next"
            ?disabled=${this.page === pages - 1}
            @click=${() => {
              this.page++;
            }}
          >
            ${Strings.from("COMMAND_NEXT")}
          </button>
        </li>
      </menu>
    `;
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

  #isCtrlCommand(event: PointerEvent | KeyboardEvent) {
    const isMac = navigator.platform.indexOf("Mac") === 0;
    return isMac ? event.metaKey : event.ctrlKey;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bb-gallery": Gallery;
  }
}
