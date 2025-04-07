/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { BoardServer, GraphProviderItem } from "@google-labs/breadboard";
import { css, html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { GraphBoardServerLoadRequestEvent } from "../../events/events.js";
import * as StringsHelper from "../../strings/helper.js";

const Strings = StringsHelper.forSection("ProjectListing");

const PAGE_SIZE_DETAILED = 8;
const PAGE_SIZE_CONDENSED = 24;

@customElement("bb-gallery")
export class Gallery extends LitElement {
  static styles = [
    css`
      #boards {
        display: grid;
        grid-template-columns: repeat(auto-fit, 265px);
        gap: 24.4px;
        & .board {
          display: flex;
          flex-direction: column;
          background: none;
          border: 1px solid var(--bb-neutral-300);
          border-radius: 12px;
          overflow: hidden;
          padding: 0;
          cursor: pointer;
          transition: box-shadow;
          &:hover {
            box-shadow: rgb(0 0 0 / 11%) 3px 3px 5px;
          }
          & .img-container {
            height: 188px;
            border-bottom: 1px solid var(--bb-neutral-300);
            & img {
              width: 100%;
              height: 100%;
              object-fit: cover;
            }
            & .details {
              padding: 12px;
              text-align: left;
            }
            & .title {
              font-size: 14px;
            }
            & .description {
              font-size: 12px;
            }
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

  @property({ attribute: false })
  accessor items: [string, GraphProviderItem][] = [];

  @property({ attribute: false })
  accessor boardServer: BoardServer | undefined;

  @property({ type: Number })
  accessor page = 0;

  @property({ reflect: true })
  accessor mode: "detailed" | "condensed" = "detailed";

  override render() {
    return html`
      <div id="items">${this.items.map((item) => this.#renderItem(item))}</div>
      ${this.#renderPagination()}
    `;
  }

  #renderItem([name, item]: [string, GraphProviderItem]) {
    const { mine, username, title, description, thumbnail } = item;
    return html`
      <button
        @click=${() => this.#onClickItem(item)}
        class=${classMap({ board: true, mine })}
      >
        <div class="img-container">
          <img .src=${thumbnail ?? "/images/app/generic-flow.jpg"} />
        </div>
        <div class="details">
          <div class="author">
            <img src="" />
            <span class="name">${username}</span>
          </div>
          <div class="title">${title ?? name}</div>
          <div class="description">${description ?? "No description"}</div>
        </div>
      </button>
    `;
  }

  #renderPagination() {
    const pageSize =
      this.mode === "condensed" ? PAGE_SIZE_CONDENSED : PAGE_SIZE_DETAILED;
    const items = this.items;
    const pages =
      items.length % pageSize === 0
        ? items.length / pageSize
        : Math.floor(items.length / pageSize) + 1;
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

  #onClickItem(item: GraphProviderItem) {
    if (!this.boardServer) {
      console.error("No board server configured");
      return;
    }
    this.dispatchEvent(
      new GraphBoardServerLoadRequestEvent(this.boardServer.name, item.url)
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bb-gallery": Gallery;
  }
}
