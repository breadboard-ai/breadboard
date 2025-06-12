/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";
import { styles, defaultStyles } from "./styles/default.js";
import { Orientation } from "../types/types.js";
import { classMap } from "lit/directives/class-map.js";
import { merge } from "./styles/utils.js";

import "./card.js";

@customElement("ui-cards")
export class Cards extends LitElement {
  static styles = [
    styles,
    css`
      * {
        box-sizing: border-box;
      }

      :host {
        display: block;
        background: var(--n-95);
        padding: var(--g-4);
        border-radius: calc(var(--g-4) + var(--g-4));
        margin-bottom: var(--g-16);
      }

      ui-card {
        margin-bottom: var(--g-5);

        &:last-of-type {
          margin-bottom: 0;
        }
      }
    `,
  ];

  render() {
    return html` <ui-card class="border-radius-4">
        <div class="position-relative">
          <img src="images/img.jpg" class="cover border-radius-4" />
          <h1 class=${classMap(
            merge(defaultStyles.elements.h1, defaultStyles.extras.headline)
          )}>Meow</h1>
        </div>
        <div class="padding-3 flex-vertical">
          <input
            id="title"
            class=${classMap(merge(defaultStyles.elements.input, defaultStyles.extras.hero))}
            type="text"
            .value=${"Title"}
          />
          <textarea
            id="description"
            class=${classMap(defaultStyles.elements.textarea)}
            .value=${"Description"}
          ></textarea>
          <input
            id="dueDate"
            class=${classMap(defaultStyles.elements.input)}
            type="date"
          /></div
      ></ui-card>

      <ui-card
        .segments=${[1, "min-content"]}
        .orientation=${Orientation.HORIZONTAL}
        class="border-radius-4"
      >
        <div class="padding-3 flex-vertical">
          <input
            id="title"
            class=${classMap(defaultStyles.elements.input)}
            type="text"
            .value=${"Title"}
          />
          <textarea
            id="description"
            class=${classMap(defaultStyles.elements.textarea)}
            .value=${"Description"}
          ></textarea>
          <input
            id="dueDate"
            class=${classMap(defaultStyles.elements.input)}
            type="date"
          />
        </div>
        <div class="padding-top-3 padding-right-3 padding-bottom-3 flex-vertical">
          <div class="flex-horizontal space-evenly">
            <button
              class=${classMap(merge(defaultStyles.elements.button, { "margin-right-2": true }))}
            >
              Done
            </button>
            <button class=${classMap(defaultStyles.elements.button)}>Remove</button>
          </div>
        </div>
      </ui-card>

      <ui-card
        .segments=${[1, 2]}
        .orientation=${Orientation.HORIZONTAL}
        class="border-radius-4"
        ><img src="images/img.jpg" class="cover border-radius-4" /></div>
        <div class="padding-3">
          <h1 class=${classMap(defaultStyles.elements.h1)}>Title</h1>
          <p class=${classMap(defaultStyles.elements.body)}>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Proin vitae
            tempus dolor. Praesent pretium risus sit amet ultricies tristique.
            Pellentesque sed euismod leo, vel facilisis tellus. Nunc quam nisi,
            condimentum eu accumsan at, rhoncus at sapien.
          </p>
        </div></ui-card
      >

      <ui-card
        class="border-radius-4"
        .disabled=${true}
        .orientation=${Orientation.VERTICAL}
        .segments=${[1, "fit-content"]}
        >
        <div class="position-relative">
          <img src="images/img.jpg" class="cover border-radius-4" />
          <h1 class=${classMap(
            merge(defaultStyles.elements.h1, defaultStyles.extras.headline)
          )}>Meow</h1>
        </div>
        <div class="padding-3">
          <h1 class=${classMap(defaultStyles.elements.h1)}>This is a cat in space</h1>
          <p class=${classMap(defaultStyles.elements.body)}>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Proin vitae
            tempus dolor. Praesent pretium risus sit amet ultricies tristique.
            Pellentesque sed euismod leo, vel facilisis tellus. Nunc quam nisi,
            condimentum eu accumsan at, rhoncus at sapien.
          </p>
        </div></ui-card
      >`;
  }
}
