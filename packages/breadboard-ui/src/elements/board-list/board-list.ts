/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css, TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { until } from "lit/directives/until.js";
import { Board } from "../../types/types.js";
import { StartEvent, ToastEvent, ToastType } from "../../events/events.js";

/**
 * Breadboard BoardList element.
 *
 * @export
 * @class BoardList
 * @extends {LitElement}
 *
 * @property {Board[]} boards - the array of boards to display as BoardItem elements.
 * @property {string | null} bootWithUrl
 **/
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

/**
 * Breadboard BoardItem element.
 *
 * @export
 * @class BoardItem
 * @extends {LitElement}
 *
 * @property {string | null} boardTitle - The title of the board.
 * @property {string | null} boardUrl - The URL of the board.
 * @property {string | null} boardVersion - The version of the board.
 **/
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

  /**
   * Replace links with HTML anchor tags in a given description.
   *
   * Safely extract markdown links and make them real HTML links. Any other HTML will remain safely escaped.
   *
   * @param {string} description - Text description to parse
   *
   * @returns {(string | TemplateResult<1>)[]}
   */
  #replaceLinks(description: string): (string | TemplateResult<1>)[] {
    // Safely extract markdown links and make them real HTML links. Any other
    // HTML will remain safely escaped.
    const parts = [];
    let lastIndex = 0;
    for (const match of description.matchAll(/\[(.*?)\]\((.*?)\)/gim)) {
      const index = match.index;
      if (index === undefined) {
        continue;
      }
      const precedingText = description.slice(lastIndex, index);
      parts.push(precedingText);
      const [fullMatch, linkLabel, linkUrl] = match;
      parts.push(html`<a href="${linkUrl}">${linkLabel}</a>`);
      lastIndex = index + fullMatch.length;
    }
    const remainingText = description.slice(lastIndex);
    parts.push(remainingText);
    return parts;
  }

  async #getDescription() {
    if (!this.boardUrl || !this.boardTitle) {
      return Promise.resolve("Unable to load description");
    }
    const response = await fetch(this.boardUrl);
    const info = await response.json();
    return this.#replaceLinks(info.description || "No description");
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
