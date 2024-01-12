/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { until } from "lit/directives/until.js";
import { Board } from "./types.js";
import { longTermMemory } from "./utils/long-term-memory.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { StartEvent, ToastEvent, ToastType } from "./events.js";

@customElement("bb-board-list")
export class BoardList extends LitElement {
  @property()
  boards: Board[] = [];

  @property()
  bootWithUrl: string | null = null;

  static styles = css`
    :host {
      display: block;
      container-type: inline-size;
    }

    #boards {
      margin: 32px;
      display: grid;
      grid-template-columns: auto;
      column-gap: calc(var(--bb-grid-size) * 6);
      row-gap: calc(var(--bb-grid-size) * 6);
    }

    @container (min-width: 640px) {
      #boards {
        grid-template-columns: auto auto;
      }
    }

    @container (min-width: 1040px) {
      #boards {
        grid-template-columns: auto auto auto;
      }
    }

    @container (min-width: 1440px) {
      #boards {
        grid-template-columns: auto auto auto auto;
      }
    }

    @container (min-width: 1840px) {
      #boards {
        grid-template-columns: auto auto auto auto auto;
      }
    }

    @container (min-width: 2240px) {
      #boards {
        grid-template-columns: auto auto auto auto auto auto;
      }
    }
  `;

  render() {
    return html`<div id="boards">
      ${this.boards.map((board) => {
        return html`<bb-board-item
          .boardTitle=${board.title}
          .boardVersion=${board.version}
          .boardUrl=${board.url}
        ></bb-board-item>`;
      })}
    </div>`;
  }

  protected firstUpdated(): void {
    if (!this.bootWithUrl) {
      return;
    }

    this.dispatchEvent(new StartEvent(this.bootWithUrl));
  }
}

@customElement("bb-board-item")
export class BoardItem extends LitElement {
  @property()
  boardTitle: string | null = null;

  @state()
  boardDescription: string | null = null;

  @property()
  boardUrl: string | null = null;

  @property()
  boardVersion: string | null = null;

  #copying = false;

  static styles = css`
    :host {
      display: block;
      position: relative;
    }

    div {
      display: flex;
      height: 100%;
      flex-direction: column;
    }

    div > a {
      flex: 1;
      display: block;
      box-sizing: border-box;
      text-decoration: none;
      padding: calc(var(--bb-grid-size) * 7) calc(var(--bb-grid-size) * 5);
      border-radius: calc(var(--bb-grid-size) * 3);
      background: rgb(255, 255, 255);
      border: 1px solid rgb(233, 233, 233);
      transition: all 0.3s cubic-bezier(0, 0, 0.3, 1);
    }

    div > a:hover {
      background: rgb(113, 106, 162);
      border: 1px solid rgb(88, 79, 138);
      box-shadow: 0 2px 7px 0 rgba(0, 0, 0, 0.14),
        0 13px 27px 0 rgba(0, 0, 0, 0.23);
      transition: all 0.15s cubic-bezier(0, 0, 0.3, 1);
    }

    h1 {
      font-size: var(--bb-text-large);
      color: rgb(57, 57, 57);
      margin: 0;
      max-width: 80%;
    }

    h2 {
      font-size: var(--bb-text-medium);
      color: rgb(57, 57, 57);
      margin: calc(var(--bb-grid-size) * 2)) 0 0 0;
    }

    p {
      font-size: var(--bb-text-small);
      color: rgb(57, 57, 57);
      line-height: 1.5;
      margin: calc(var(--bb-grid-size) * 6) 0;
    }

    :hover h1,
    :hover h2,
    :hover p,
    :hover a {
      color: #fff;
    }

    #copy-to-clipboard {
      width: 32px;
      height: 32px;
      font-size: 0;
      display: inline-block;
      background: var(--bb-icon-copy-to-clipboard) center center no-repeat;
      vertical-align: middle;
      border: none;
      cursor: pointer;
      transition: opacity var(--bb-easing-duration-out) var(--bb-easing);
      opacity: 0.5;
      position: absolute;
      top: 16px;
      right: 16px;
      border-radius: 50%;
    }

    #copy-to-clipboard:hover {
      background-color: #ffffffcc;
      transition: opacity var(--bb-easing-duration-in) var(--bb-easing),
        background-color var(--bb-easing-duration-in) var(--bb-easing);
      opacity: 1;
    }
  `;

  #replaceLinks(description: string) {
    const updatedDescription = description.replaceAll(
      /\[(.*?)\]\((.*?)\)/gim,
      '<a href="$2">$1</a>'
    );
    return unsafeHTML(updatedDescription);
  }

  async #getDescription() {
    if (!this.boardUrl || !this.boardTitle) {
      return Promise.resolve("Unable to load description");
    }

    const titleForKey = this.boardTitle
      .replace(/\W/gim, "-")
      .toLocaleLowerCase();
    const key = `${titleForKey}-${this.boardVersion}`;
    const value = await longTermMemory.retrieve(key);
    if (value !== null) {
      return this.#replaceLinks(value || "No description");
    }

    const response = await fetch(this.boardUrl);
    const info = await response.json();
    longTermMemory.store(key, info.description || "");

    return this.#replaceLinks(info.description);
  }

  async #copyToClipboard(evt: Event) {
    if (this.#copying || !this.boardUrl) {
      return;
    }

    evt.stopImmediatePropagation();
    evt.preventDefault();

    this.#copying = true;
    const linkUrl = new URL(window.location.href);
    linkUrl.searchParams.set("board", this.boardUrl);

    await navigator.clipboard.writeText(linkUrl.toString());
    this.dispatchEvent(
      new ToastEvent("Board URL copied to clipboard", ToastType.INFORMATION)
    );
    this.#copying = false;
  }

  #onBoardSelect(evt: Event) {
    evt.preventDefault();

    if (!this.boardUrl) {
      console.warn("No board URL");
      return;
    }

    this.dispatchEvent(new StartEvent(this.boardUrl));
  }

  render() {
    return html`<div>
      <a @click=${this.#onBoardSelect} href="?board=${this.boardUrl}">
        <button
          id="copy-to-clipboard"
          @click=${this.#copyToClipboard}
          title="Copy board URL"
        >
          Copy board URL
        </button>
        <h1>${this.boardTitle}</h1>
        <h2>${this.boardVersion || "Unversioned"}</h2>
        <p>${until(this.#getDescription(), html`Loading...`)}</p>
      </a>
    </div>`;
  }
}
