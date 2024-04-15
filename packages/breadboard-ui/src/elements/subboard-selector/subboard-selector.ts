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
  BoardInfoUpdateRequestEvent,
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

    ul.subboards {
      padding-right: var(--bb-grid-size);
    }

    li.subboard {
      display: grid;
      grid-template-columns: 1fr auto auto;
      margin: var(--bb-grid-size) 0;
    }

    .subboard-headline {
      display: block;
      margin-bottom: var(--bb-grid-size);
      font-size: var(--bb-body-medium);
      line-height: var(--bb-body-line-height-medium);
    }

    .subboard-description {
      display: block;
      color: var(--bb-neutral-700);
      font-size: var(--bb-body-small);
      line-height: var(--bb-body-line-height-small);
    }

    button {
      margin: 0;
      padding: 0;
      font-size: var(--bb-label-large);
      font-weight: 500;
      background: none;

      border: 1px solid var(--bb-neutral-100);
      padding: var(--padding-y);
      border-radius: var(--bb-grid-size);
      color: var(--bb-output-700);
      cursor: pointer;
      text-align: left;
      width: 100%;
    }

    button[disabled] {
      border: 1px solid var(--bb-output-400);
      color: var(--bb-output-700);
      background: var(--bb-output-50);
      cursor: auto;
    }

    li.subboard button {
      margin-right: calc(var(--bb-grid-size) * 2);
    }

    li.subboard .edit-board,
    li.subboard .delete-board {
      border: none;
      align-self: center;
      justify-self: center;
      margin: 0 0 0 calc(var(--bb-grid-size) * 2);
    }

    .add-board,
    .edit-board,
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
    .edit-board:hover,
    .delete-board:hover {
      opacity: 1;
    }

    .add-board {
      background-image: var(--bb-icon-add-circle);
    }

    .edit-board {
      background-image: var(--bb-icon-edit);
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
    return html` <ul>
      <li>
        <button
          @click=${() => {
            this.dispatchEvent(new SubGraphChosenEvent(MAIN_BOARD_ID));
          }}
          ?disabled=${this.subGraphId === null}
        >
          <span class="subboard-headline"> ${MAIN_BOARD_ID} </span>
          <span class="subboard-description"
            >${this.graph.description || "No description"}</span
          >
        </button>
        <ul class="subboards">
          ${map(Object.entries(graphs), ([name, graph]) => {
            const descriptor = graph.raw();
            return html`<li class="subboard">
              <button
                @click=${() => {
                  this.dispatchEvent(new SubGraphChosenEvent(name));
                }}
                ?disabled=${this.subGraphId === name}
              >
                <span class="subboard-headline"
                  >${descriptor.title} (${name})</span
                >
                <span class="subboard-description"
                  >${descriptor.description || "No description"}</span
                >
              </button>
              <button
                @click=${() => {
                  this.dispatchEvent(
                    new BoardInfoUpdateRequestEvent(
                      descriptor.title,
                      descriptor.version,
                      descriptor.description,
                      name
                    )
                  );
                }}
                class="edit-board"
              >
                Edit
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
              @click=${() => this.#proposeNewSubGraph(Object.keys(graphs))}
            >
              Add new
            </button>
          </li>
        </ul>
      </li>
    </ul>`;
  }
}
