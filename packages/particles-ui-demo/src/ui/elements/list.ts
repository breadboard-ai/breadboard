/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";
import { styles, defaultStyles } from "../styles/default.js";
import { Orientation } from "../../types/types.js";
import { classMap } from "lit/directives/class-map.js";
import { merge } from "../styles/utils.js";

import "./card.js";
import "./hero-image.js";

@customElement("ui-list")
export class List extends LitElement {
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
    return html` <ui-card class=${classMap(defaultStyles.components.card)}>
        <ui-hero-image class=${classMap(defaultStyles.components.heroImage)}>
          <img
            src="images/img.jpg"
            slot="hero"
            class=${classMap(defaultStyles.modifiers.cover)}
          />
          <h1
            slot="headline"
            class=${classMap(
              merge(defaultStyles.elements.h1, defaultStyles.modifiers.headline)
            )}
          >
            Meow
          </h1>
        </ui-hero-image>
        <div class=${classMap(defaultStyles.layouts.verticalPadded)}>
          <input
            id="title"
            class=${classMap(
              merge(defaultStyles.elements.input, defaultStyles.modifiers.hero)
            )}
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
        class=${classMap(defaultStyles.components.card)}
        .segments=${[1, "min-content"]}
        .orientation=${Orientation.VERTICAL}
      >
        <div class=${classMap(defaultStyles.layouts.verticalPadded)}>
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
        <div
          class=${classMap(
            merge(
              defaultStyles.layouts.verticalPadded,
              defaultStyles.modifiers.borderTop
            )
          )}
        >
          <div class=${classMap(defaultStyles.layouts.horizontal)}>
            <button
              class=${classMap(
                merge(defaultStyles.elements.button, { "layout-mr-2": true })
              )}
            >
              Done
            </button>
            <button class=${classMap(defaultStyles.elements.button)}>
              Remove
            </button>
          </div>
        </div>
      </ui-card>

      <ui-card
        class=${classMap(defaultStyles.components.card)}
        .disabled=${true}
        .segments=${[1, 2]}
        .orientation=${Orientation.HORIZONTAL}
      >
        <ui-hero-image class=${classMap(defaultStyles.components.heroImage)}>
          <img
            src="images/img.jpg"
            slot="hero"
            class=${classMap(defaultStyles.modifiers.cover)}
          />
        </ui-hero-image>

        <div class=${classMap(defaultStyles.layouts.verticalPadded)}>
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
        class=${classMap(defaultStyles.components.card)}
        .orientation=${Orientation.VERTICAL}
        .segments=${[1, "fit-content", "fit-content"]}
      >
        <ui-hero-image class=${classMap(defaultStyles.components.heroImage)}>
          <img
            src="images/img.jpg"
            slot="hero"
            class=${classMap(defaultStyles.modifiers.cover)}
          />
          <h1
            slot="headline"
            class=${classMap(
              merge(defaultStyles.elements.h1, defaultStyles.modifiers.headline)
            )}
          >
            Meow
          </h1>
        </ui-hero-image>
        <div class=${classMap(defaultStyles.layouts.verticalPadded)}>
          <h1 class=${classMap(defaultStyles.elements.h1)}>
            This is a cat in space
          </h1>
          <p class=${classMap(defaultStyles.elements.body)}>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Proin vitae
            tempus dolor. Praesent pretium risus sit amet ultricies tristique.
            Pellentesque sed euismod leo, vel facilisis tellus. Nunc quam nisi,
            condimentum eu accumsan at, rhoncus at sapien.
          </p>
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
        <div
          class=${classMap(
            merge(
              defaultStyles.layouts.horizontalPadded,
              defaultStyles.modifiers.borderTop
            )
          )}
        >
          <button
            class=${classMap(
              merge(defaultStyles.elements.button, { "layout-mr-2": true })
            )}
          >
            Done
          </button>
          <button class=${classMap(defaultStyles.elements.button)}>
            Remove
          </button>
        </div>
      </ui-card>`;
  }
}
