/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { StartEvent } from "./events.js";

type Board = {
  title: string;
  url: string;
  version: string;
};

export type StartArgs = {
  boards: Board[];
};

import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("bb-start")
export class Start extends LitElement {
  @property({ reflect: true })
  url = "";

  @property()
  boards: Board[] = [];

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    #sample-board-list {
      width: auto;
      max-width: 30vw;
      padding: calc(var(--bb-grid-size) * 2) calc(var(--bb-grid-size) * 4);
      border-radius: 30px;
      background: rgb(255, 255, 255);
      border: 1px solid rgb(200, 200, 200);
    }
  `;

  #onBoardChange(evt: Event) {
    if (!(evt.target instanceof HTMLSelectElement)) {
      return;
    }

    this.dispatchEvent(new StartEvent(evt.target.value));
  }

  render() {
    return html`<select @change=${this.#onBoardChange} id="sample-board-list">
      <option class="sample-board" value="" disabled selected>
        -- Choose a board --
      </option>
      ${this.boards.map(({ title, url }) => {
        return html`<option
          ?selected=${url === this.url}
          class="sample-board"
          value="${url}"
        >
          ${title}
        </option>`;
      })}
    </select>`;
  }
}
