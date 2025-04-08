/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { BoardServer, GraphProviderItem } from "@google-labs/breadboard";
import { css, html, LitElement, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { styleMap } from "lit/directives/style-map.js";
import { GraphBoardServerLoadRequestEvent } from "../../events/events.js";
import * as StringsHelper from "../../strings/helper.js";

const Strings = StringsHelper.forSection("ProjectListing");
const PAGE_SIZE_DETAILED = 8;
const PAGE_SIZE_CONDENSED = 24;

@customElement("bb-gallery")
export class Gallery extends LitElement {
  static readonly styles = [
    css`
      * {
        box-sizing: border-box;
      }

      #boards {
        display: grid;
        grid-template-columns: 1fr;
        grid-auto-rows: auto;
        column-gap: var(--bb-grid-size-12);
        row-gap: var(--bb-grid-size-5);
        margin-bottom: var(--bb-grid-size-8);

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
          position: relative;

          & .img {
            position: relative;
            flex: 1 1 auto;
            width: 100%;
            border-bottom: 1px solid var(--bb-neutral-300);

            &::before {
              content: "";
              top: 0;
              left: 0;
              position: absolute;
              width: 100%;
              height: 100%;
              background: url(/images/progress-ui.svg) center center / 20px 20px
                no-repeat;
            }

            &::after {
              content: "";
              top: 0;
              left: 0;
              position: absolute;
              width: 100%;
              height: 100%;
              background-image: var(--background-image);
              background-size: cover;
              background-repeat: no-repeat;
              background-position: center center;
            }
          }

          & .img:not(.custom)::after {
            background-color: var(--bb-ui-50);
            background-image: url(/images/placeholder.svg);
            background-size: contain;
          }

          &:has(> .username) .title {
            width: calc(100% - 60px);
          }

          & .title {
            display: block;
            color: var(--bb-neutral-900);
            font: 500 var(--bb-title-small) / var(--bb-title-line-height-small)
              var(--bb-font-family);
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
            font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
              var(--bb-font-family);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            width: 100%;
            text-align: left;
            padding: 0 var(--bb-grid-size-3) var(--bb-grid-size-3)
              var(--bb-grid-size-3);
          }

          & .username {
            position: absolute;
            top: 4px;
            right: 4px;
            height: 16px;
            display: flex;
            align-items: center;
            background: var(--bb-ui-100);
            border-radius: var(--bb-grid-size-16);
            font: 400 var(--bb-body-x-small) /
              var(--bb-body-line-height-x-small) var(--bb-font-family);
            padding: 0 var(--bb-grid-size-2);
          }

          &:hover,
          &:focus {
            border: 1px solid var(--bb-neutral-400);
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

      :host([mode="condensed"]) button {
        height: auto !important;
        & .img {
          display: none;
        }
      }

      @media (min-width: 480px) and (max-width: 800px) {
        #boards {
          grid-template-columns: repeat(2, 1fr);
        }
      }

      @media (min-width: 800px) and (max-width: 1080px) {
        #boards {
          grid-template-columns: repeat(3, 1fr);
        }
      }

      @media (min-width: 1080px) {
        #boards {
          grid-template-columns: repeat(4, 1fr);
        }
      }
    `,
  ];

  @property({ attribute: false })
  accessor items: [string, GraphProviderItem][] | undefined = undefined;

  @property({ attribute: false })
  accessor recentItems: string[] | undefined = undefined;

  @property({ attribute: false })
  accessor boardServer: BoardServer | undefined = undefined;

  @property({ reflect: true })
  accessor mode: "detailed" | "condensed" = "detailed";

  @property({ type: Number })
  accessor page = 0;

  override render() {
    const pageSize = this.#pageSize;
    const pageItems = (this.items ?? []).slice(
      this.page * pageSize,
      (this.page + 1) * pageSize
    );
    return html`
      <div id="boards">${pageItems.map((item) => this.#renderBoard(item))}</div>
      ${this.#renderPagination()}
    `;
  }

  get #pageSize(): number {
    return this.mode === "condensed" ? PAGE_SIZE_CONDENSED : PAGE_SIZE_DETAILED;
  }

  #renderBoard([name, item]: [string, GraphProviderItem]) {
    const { url, mine, username, title, description, thumbnail } = item;
    const styles: Record<string, string> = {};

    if (thumbnail !== null && thumbnail !== undefined) {
      styles["--background-image"] = `url(${thumbnail})`;
    }

    return html`
      <button
        @click=${(evt: PointerEvent) => {
          const isMac = navigator.platform.indexOf("Mac") === 0;
          const isCtrlCommand = isMac ? evt.metaKey : evt.ctrlKey;
          if (!this.boardServer) {
            return;
          }
          this.dispatchEvent(
            new GraphBoardServerLoadRequestEvent(
              this.boardServer.name,
              url,
              isCtrlCommand
            )
          );
        }}
        data-url=${url}
        class=${classMap({
          mine,
          board: true,
        })}
      >
        <span
          class=${classMap({
            img: true,
            custom: thumbnail !== null && thumbnail !== undefined,
          })}
          style=${styleMap(styles)}
        ></span>
        <span class="title"> ${title ?? name} </span>
        <span class="description"> ${description ?? "No description"} </span>
        ${mine
          ? nothing
          : username
            ? html`<span class="username">@${username}</span>`
            : nothing}
      </button>
    `;
  }

  #renderPagination() {
    const pageSize = this.#pageSize;
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
}

declare global {
  interface HTMLElementTagNameMap {
    "bb-gallery": Gallery;
  }
}
