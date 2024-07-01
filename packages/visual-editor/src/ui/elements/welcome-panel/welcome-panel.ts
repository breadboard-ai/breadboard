/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { map } from "lit/directives/map.js";
import {
  GraphProviderBlankBoardEvent,
  StartEvent,
} from "../../events/events.js";
import { RecentBoard } from "../../types/types.js";

interface Guides {
  title: string;
  description: string;
  url: string;
  image?: string;
}

@customElement("bb-welcome-panel")
export class WelcomePanel extends LitElement {
  @property()
  version = "dev";

  @state()
  recentBoards: RecentBoard[] = [];

  @state()
  guides: Guides[] = [
    {
      title: "Building a Librarian with the Agent Kit",
      description:
        "Learn to make a simple agent that helps us finding interesting books",
      url: "https://breadboard-ai.github.io/breadboard/docs/guides/librarian/",
    },
    {
      title: "Building our First Tool",
      description: "Create your first tool, and use it within a board",
      url: "https://breadboard-ai.github.io/breadboard/docs/guides/first-tool/",
    },
  ];

  static styles = css`
    * {
      box-sizing: border-box;
    }

    :host {
      display: block;
      position: absolute;
      top: 50%;
      left: 50%;
      width: min(80%, 650px);
      transform: translate(-50%, -50%);
      background: #fff;
      border-radius: var(--bb-grid-size-2);
      border: 1px solid var(--bb-neutral-300);
      user-select: none;
    }

    header {
      display: flex;
      align-items: center;
      padding: var(--bb-grid-size-3) var(--bb-grid-size-4);
    }

    header h1 {
      flex: 1;
      margin: 0;
      font: 400 var(--bb-title-large) / var(--bb-title-line-height-large)
        var(--bb-font-family);
      display: flex;
      align-items: center;
      color: var(--bb-neutral-900);
    }

    #new-board {
      border-radius: 50px;
      background: var(--bb-ui-500);
      border: none;
      color: var(--bb-neutral-0);
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
      display: flex;
      align-items: center;
      cursor: pointer;
      height: 30px;
      padding-right: var(--bb-grid-size-4);
      opacity: 0.8;
      transition: opacity 0.3s cubic-bezier(0, 0, 0.3, 1);
    }

    #new-board::before {
      content: "";
      background: var(--bb-icon-add-inverted) center center / 20px 20px
        no-repeat;
      width: 20px;
      height: 20px;
      margin-right: var(--bb-grid-size);
    }

    #new-board:hover,
    #new-board:focus {
      opacity: 1;
      transition-duration: 0.1s;
    }

    #contents {
      display: grid;
      grid-template-columns: minmax(0, 2fr) 3fr;
      column-gap: var(--bb-grid-size-4);
    }

    #contents section {
      padding: 0 var(--bb-grid-size-4);
    }

    #contents section h1 {
      margin: 0;
      padding-bottom: var(--bb-grid-size-2);
      font: 400 var(--bb-title-small) / var(--bb-title-line-height-small)
        var(--bb-font-family);
      display: flex;
      align-items: center;
      color: var(--bb-neutral-900);
    }

    #no-recent-boards {
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
      color: var(--bb-neutral-600);
    }

    #recent-boards ul {
      padding: 0;
      margin: 0;
      list-style: none;
      width: 100%;
      overflow: auto;
    }

    #recent-boards li {
      width: 100%;
      overflow: auto;
      position: relative;
      margin-bottom: var(--bb-grid-size-2);
    }

    #recent-boards button {
      display: flex;
      flex-direction: column;
      align-items: center;
      white-space: nowrap;
      width: calc(100%);
      padding: 0 0 0 var(--bb-grid-size-3);
      margin: 0;
      background: none;
      border: none;
      cursor: pointer;
    }

    #recent-boards button::before {
      content: "";
      background: var(--bb-ui-100);
      position: absolute;
      top: 0;
      left: 0;
      border-radius: 4px;
      width: 4px;
      height: 100%;
      transition: background 0.1s cubic-bezier(0, 0, 0.3, 1);
    }

    #recent-boards button:hover::before,
    #recent-boards button:focus::before {
      background: var(--bb-ui-300);
    }

    #recent-boards button span {
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
      width: 100%;
      text-align: left;
    }

    #recent-boards button span.title {
      transition: color 0.1s cubic-bezier(0, 0, 0.3, 1);
      color: var(--bb-neutral-800);
    }

    #recent-boards button:hover span.title,
    #recent-boards button:focus span.title {
      color: var(--bb-neutral-900);
    }

    #recent-boards button span.url {
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
      color: var(--bb-neutral-500);
    }

    #guides ul {
      padding: 0;
      margin: 0;
      list-style: none;
    }

    #guides ul li {
      margin-bottom: var(--bb-grid-size-2);
    }

    #guides ul li a {
      border-radius: var(--bb-grid-size-2);
      background: var(--bb-ui-50);
      display: flex;
      flex-direction: column;
      padding: var(--bb-grid-size-2) var(--bb-grid-size-3);
      text-decoration: none;
      font: 400 var(--bb-body-medium) / var(--bb-body-line-height-medium)
        var(--bb-font-family);
      transition: background 0.3s cubic-bezier(0, 0, 0.3, 1);
    }

    #guides a:hover,
    #guides a:focus {
      background: var(--bb-ui-100);
    }

    #guides .title {
      font: 400 var(--bb-title-small) / var(--bb-title-line-height-small)
        var(--bb-font-family);
      color: var(--bb-neutral-800);
    }

    #guides .description {
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
      color: var(--bb-neutral-600);
    }

    #guides #doc-link {
      display: flex;
      justify-content: flex-end;
    }

    #guides #see-all-docs {
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
      display: flex;
      align-items: center;
      height: 20px;
      padding-left: 24px;
      text-decoration: none;
      background: var(--bb-icon-open-new) left center / 20px 20px no-repeat;
      color: var(--bb-neutral-700);
      margin-top: var(--bb-grid-size-4);
    }

    #guides #see-all-docs:hover,
    #guides #see-all-docs:focus {
      color: var(--bb-neutral-900);
    }

    footer {
      display: flex;
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
      border-top: 1px solid var(--bb-neutral-300);
      padding: var(--bb-grid-size-2) var(--bb-grid-size-2);
      margin-top: var(--bb-grid-size-12);
    }

    footer > * {
      display: flex;
      align-items: center;
      height: 20px;
    }

    footer #file-a-bug {
      padding-left: 24px;
      text-decoration: none;
      background: var(--bb-icon-bug) left center / 20px 20px no-repeat;
      color: var(--bb-neutral-700);
    }

    footer #file-a-bug:hover,
    footer #file-a-bug:focus {
      color: var(--bb-neutral-900);
    }

    footer #version {
      flex: 1;
      justify-content: flex-end;
      color: var(--bb-neutral-500);
      user-select: auto;
    }
  `;

  render() {
    return html` <header>
        <h1>Breadboard Visual Editor</h1>
        <button
          id="new-board"
          @click=${() => {
            this.dispatchEvent(new GraphProviderBlankBoardEvent());
          }}
        >
          New board
        </button>
      </header>
      <div id="contents">
        <section id="recent-boards">
          <h1>Recent boards</h1>
          ${this.recentBoards.length
            ? html`<ul>
                ${map(this.recentBoards, (board) => {
                  return html`<li>
                    <button
                      @click=${() => {
                        this.dispatchEvent(new StartEvent(board.url));
                      }}
                    >
                      <span class="title">${board.title}</span>
                      <span class="url">${board.url}</span>
                    </button>
                  </li>`;
                })}
              </ul>`
            : html`<div id="no-recent-boards">No recent boards</div>`}
        </section>
        <section id="guides">
          <h1>Guides</h1>
          <ul>
            ${map(this.guides, (guide) => {
              return html`<li>
                <a href="${guide.url}">
                  <span class="title">${guide.title}</span>
                  <span class="description">${guide.description}</span>
                </a>
              </li>`;
            })}
          </ul>
          <div id="doc-link">
            <a
              id="see-all-docs"
              href="https://breadboard-ai.github.io/breadboard/docs/"
              target="_blank"
              >See all documentation</a
            >
          </div>
        </section>
      </div>
      <footer>
        <a
          id="file-a-bug"
          href="https://github.com/breadboard-ai/breadboard/issues/new"
          >Found a bug? Tell us!</a
        >
        <span id="version">Version: ${this.version}</span>
      </footer>`;
  }
}
