/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { BoardServer, GraphProviderItem } from "@google-labs/breadboard";
import { css, html, LitElement, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { GraphBoardServerLoadRequestEvent } from "../../events/events.js";

@customElement("bb-gallery")
export class Gallery extends LitElement {
  static styles = [
    css`
      :host {
        display: grid;
        grid-template-columns: repeat(auto-fit, 287px);
        gap: 24.4px;
      }
      .board {
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
      }
      .img-container {
        height: 188px;
        border-bottom: 1px solid var(--bb-neutral-300);
        & > img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
      }
      .details {
        padding: 12px;
        text-align: left;
      }
      .title {
        font-size: 14px;
      }
      .description {
        font-size: 12px;
      }
    `,
  ];

  @property({ attribute: false })
  accessor items: [string, GraphProviderItem][] = [];

  @property({ attribute: false })
  accessor boardServer: BoardServer | undefined;

  override render() {
    return this.items.map((item) => this.#renderItem(item));
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
