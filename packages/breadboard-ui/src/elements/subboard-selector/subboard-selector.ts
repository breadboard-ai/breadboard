/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GraphDescriptor,
  GraphLoader,
  Kit,
  inspect,
} from "@google-labs/breadboard";
import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { map } from "lit/directives/map.js";
import { MAIN_BOARD_ID } from "../../constants/constants.js";
import {
  SubGraphChosenEvent,
  SubGraphCreateEvent,
  SubGraphDeleteEvent,
} from "../../events/events.js";

@customElement("bb-subboard-selector")
export class SubBoardSelector extends LitElement {
  @property()
  graph: GraphDescriptor | null = null;

  @property()
  subGraphId: string | null = null;

  @property()
  kits: Kit[] = [];

  @property()
  loader: GraphLoader | null = null;

  static styles = css`
    :host {
      display: block;
      width: 100%;
      height: 100%;
      overflow-y: scroll;
      scrollbar-gutter: stable;
      --padding-x: calc(var(--bb-grid-size) * 4);
      --padding-y: calc(var(--bb-grid-size) * 2);
    }

    ul {
      list-style: none;
      margin: 0;
      padding: var(--padding-y) var(--padding-x);
    }

    ul.subgraphs {
      padding-top: 0;
    }

    li {
      height: calc(var(--bb-grid-size) * 6);
    }

    li.subboard {
      display: flex;
      justify-content: space-between;
    }

    button {
      margin: 0;
      margin-right: calc(var(--bb-grid-size) * 2);
      padding: 0;
      font-size: var(--bb-label-large);
      font-weight: 500;
      background: none;
      border: none;
      height: 100%;
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: center;
      color: var(--bb-output-700);
      cursor: pointer;
    }

    button[disabled] {
      font-weight: 700;
      color: var(--bb-neutral-700);
      cursor: auto;
    }

    .add-board,
    .delete-board {
      background: none;
      width: 16px;
      height: 16px;
      background-position: center center;
      background-repeat: no-repeat;
      background-size: 16px 16px;
      border: none;
      font-size: 0;
      opacity: 0.5;
      cursor: pointer;
    }

    .add-board:hover,
    .delete-board:hover {
      opacity: 1;
    }

    .add-board {
      background-image: var(--bb-icon-add-circle);
    }

    .delete-board {
      background-image: var(--bb-icon-delete);
    }

    #no-board-loaded {
      padding: var(--padding-y) var(--padding-x);
    }
  `;

  #proposeNewSubGraph(existingSubGraphNames: string[]) {
    let newSubGraphName;
    do {
      newSubGraphName = prompt("What would you like to call this sub board?");
      if (!newSubGraphName) {
        return;
      }
    } while (
      existingSubGraphNames.includes(newSubGraphName) ||
      !/^[a-z0-9_-]+$/i.test(newSubGraphName)
    );

    this.dispatchEvent(new SubGraphCreateEvent(newSubGraphName));
  }

  render() {
    if (!this.graph) {
      return html`<div id="no-board-loaded">No board loaded</div>`;
    }

    const breadboardGraph = inspect(this.graph, {
      kits: this.kits,
      loader: this.loader || undefined,
    });

    const graphs = breadboardGraph.graphs();
    const subGraphNames = Object.keys(graphs);
    return html` <ul>
      <li>
        <button
          @click=${() => {
            this.dispatchEvent(new SubGraphChosenEvent(MAIN_BOARD_ID));
          }}
          ?disabled=${this.subGraphId === null}
        >
          ${MAIN_BOARD_ID}
        </button>
        <ul class="subgraphs">
          ${map(subGraphNames, (name) => {
            return html`<li class="subboard">
              <button
                @click=${() => {
                  this.dispatchEvent(new SubGraphChosenEvent(name));
                }}
                ?disabled=${this.subGraphId === name}
              >
                ${name}
              </button>
              <button
                @click=${() => {
                  if (
                    !confirm("Are you sure you wish to delete this sub board?")
                  ) {
                    return;
                  }

                  this.dispatchEvent(new SubGraphDeleteEvent(name));
                }}
                class="delete-board"
              >
                Delete
              </button>
            </li>`;
          })}
          <li>
            <button
              class="add-board"
              @click=${() => this.#proposeNewSubGraph(subGraphNames)}
            >
              Add new
            </button>
          </li>
        </ul>
      </li>
    </ul>`;
  }
}
