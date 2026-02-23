/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { baseColors } from "../../styles/host/base-colors.js";
import { type } from "../../styles/host/type.js";
import { GraphDescriptor } from "@breadboard-ai/types";
import {
  OverflowAction,
  MultiGraphSelectionStateWithChangeId,
} from "../../types/types.js";
import { MAIN_BOARD_ID } from "../../../sca/constants.js";
import { icons } from "../../styles/icons.js";
import { OverflowMenuActionEvent } from "../../events/events.js";

@customElement("bb-item-modal")
export class ItemModal extends LitElement {
  @property()
  accessor graph: GraphDescriptor | null = null;

  @property()
  accessor selectionState: MultiGraphSelectionStateWithChangeId | null = null;

  static styles = [
    icons,
    type,
    baseColors,
    css`
      :host {
        display: block;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 1;
      }

      ul {
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        max-height: min(320px, 50vh);
        overflow: scroll;
        scrollbar-width: none;
        gap: var(--bb-grid-size-2);

        & li {
          width: 100%;
          padding: 0;
          margin: 0;

          & button {
            display: flex;
            align-items: center;
            border: 1px solid var(--light-dark-n-95);
            padding: 0 var(--bb-grid-size-2);
            height: var(--bb-grid-size-10);
            background: var(--light-dark-n-100);
            width: 100%;
            border-radius: var(--bb-grid-size-16);
            text-align: left;
            min-width: 320px;

            & .g-icon {
              margin-right: var(--bb-grid-size-2);
            }

            &:not([disabled]) {
              cursor: pointer;

              &:hover,
              &:focus {
                border: 1px solid var(--light-dark-n-90);
                background: var(--light-dark-n-98);
              }
            }
          }
        }
      }

      #create-new {
        display: flex;
        align-items: center;
        background: var(--light-dark-n-0, var(--light-dark-n-98));
        color: var(--light-dark-n-100, var(--light-dark-n-40));
        border-radius: var(--bb-grid-size-16);
        border: none;
        padding: 0 var(--bb-grid-size-4);
        height: var(--bb-grid-size-10);
        margin-top: var(--bb-grid-size-6);

        & .g-icon {
          margin-right: var(--bb-grid-size-2);
        }

        &:not([disabled]) {
          cursor: pointer;
        }
      }
    `,
  ];

  #createItemList() {
    const list: OverflowAction[] = [];

    const hasNoGraphsSelected =
      this.selectionState?.selectionState.graphs.size === 0;
    const hasMainGraphSelected =
      this.selectionState?.selectionState.graphs.has(MAIN_BOARD_ID);

    list.unshift({
      name: "flow",
      icon: "flowchart",
      title: "Flow",
      disabled: hasNoGraphsSelected || hasMainGraphSelected,
    });

    return list;
  }

  render() {
    return html`<bb-modal
      .modalTitle=${"Choose an item"}
      .showCloseButton=${true}
    >
      <ul>
        ${this.#createItemList().map((item) => {
          return html`<li>
            <button
              ?disabled=${item.disabled}
              @click=${() => {
                this.dispatchEvent(
                  new OverflowMenuActionEvent(item.name, item.value)
                );
              }}
            >
              <span class="g-icon filled round">${item.icon}</span>
              <span class="sans-flex md-body-large round w-400"
                >${item.title}</span
              >
            </button>
          </li>`;
        })}
      </ul>
      <div>
        <button
          id="create-new"
          @click=${() => {
            this.dispatchEvent(new OverflowMenuActionEvent("new-item"));
          }}
        >
          <span class="g-icon filled round">add_circle</span>
          <span class="sans-flex md-body-large round w-400">Create new</span>
        </button>
      </div>
    </bb-modal>`;
  }
}
