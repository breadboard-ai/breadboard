/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { type UITheme, styles } from "../styles/default.js";
import { Orientation } from "../../types/types.js";
import { classMap } from "lit/directives/class-map.js";
import { merge } from "../styles/utils.js";

import "./card.js";
import "./hero-image.js";

@customElement("ui-list")
export class List extends LitElement {
  @property()
  accessor theme: UITheme | null = null;

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
    if (!this.theme) {
      return nothing;
    }

    return html` <ui-card class=${classMap(this.theme.components.card)}>
        <ui-hero-image class=${classMap(this.theme.components.heroImage)}>
          <img
            src="images/img.jpg"
            slot="hero"
            class=${classMap(this.theme.modifiers.cover)}
          />
          <h1
            slot="headline"
            class=${classMap(
              merge(this.theme.elements.h1, this.theme.modifiers.headline)
            )}
          >
            Meow
          </h1>
        </ui-hero-image>
        <div class=${classMap(this.theme.layouts.verticalPadded)}>
          <input
            id="title"
            class=${classMap(
              merge(this.theme.elements.input, this.theme.modifiers.hero)
            )}
            type="text"
            .value=${"Title"}
          />
          <textarea
            id="description"
            class=${classMap(this.theme.elements.textarea)}
            .value=${"Description"}
          ></textarea>
          <input
            id="dueDate"
            class=${classMap(this.theme.elements.input)}
            type="date"
          /></div
      ></ui-card>

      <ui-card
        class=${classMap(this.theme.components.card)}
        .segments=${[1, "min-content"]}
        .orientation=${Orientation.VERTICAL}
      >
        <div class=${classMap(this.theme.layouts.verticalPadded)}>
          <input
            id="title"
            class=${classMap(this.theme.elements.input)}
            type="text"
            .value=${"Title"}
          />
          <textarea
            id="description"
            class=${classMap(this.theme.elements.textarea)}
            .value=${"Description"}
          ></textarea>
          <input
            id="dueDate"
            class=${classMap(this.theme.elements.input)}
            type="date"
          />
        </div>
        <div
          class=${classMap(
            merge(
              this.theme.layouts.verticalPadded,
              this.theme.modifiers.borderTop
            )
          )}
        >
          <div class=${classMap(this.theme.layouts.horizontal)}>
            <button
              class=${classMap(
                merge(this.theme.elements.button, { "layout-mr-2": true })
              )}
            >
              Done
            </button>
            <button class=${classMap(this.theme.elements.button)}>
              Remove
            </button>
          </div>
        </div>
      </ui-card>

      <ui-card
        class=${classMap(this.theme.components.card)}
        .disabled=${true}
        .segments=${[1, 2]}
        .orientation=${Orientation.HORIZONTAL}
      >
        <ui-hero-image class=${classMap(this.theme.components.heroImage)}>
          <img
            src="images/img.jpg"
            slot="hero"
            class=${classMap(this.theme.modifiers.cover)}
          />
        </ui-hero-image>

        <div class=${classMap(this.theme.layouts.verticalPadded)}>
          <h1 class=${classMap(this.theme.elements.h1)}>Title</h1>
          <p class=${classMap(this.theme.elements.body)}>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Proin vitae
            tempus dolor. Praesent pretium risus sit amet ultricies tristique.
            Pellentesque sed euismod leo, vel facilisis tellus. Nunc quam nisi,
            condimentum eu accumsan at, rhoncus at sapien.
          </p>
        </div></ui-card
      >

      <ui-card
        class=${classMap(this.theme.components.card)}
        .orientation=${Orientation.VERTICAL}
        .segments=${[1, "fit-content", "fit-content"]}
      >
        <ui-hero-image class=${classMap(this.theme.components.heroImage)}>
          <img
            src="images/img.jpg"
            slot="hero"
            class=${classMap(this.theme.modifiers.cover)}
          />
          <h1
            slot="headline"
            class=${classMap(
              merge(this.theme.elements.h1, this.theme.modifiers.headline)
            )}
          >
            Meow
          </h1>
        </ui-hero-image>
        <div class=${classMap(this.theme.layouts.verticalPadded)}>
          <h1 class=${classMap(this.theme.elements.h1)}>
            This is a cat in space
          </h1>
          <p class=${classMap(this.theme.elements.body)}>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Proin vitae
            tempus dolor. Praesent pretium risus sit amet ultricies tristique.
            Pellentesque sed euismod leo, vel facilisis tellus. Nunc quam nisi,
            condimentum eu accumsan at, rhoncus at sapien.
          </p>
          <input
            id="title"
            class=${classMap(this.theme.elements.input)}
            type="text"
            .value=${"Title"}
          />
          <textarea
            id="description"
            class=${classMap(this.theme.elements.textarea)}
            .value=${"Description"}
          ></textarea>
          <input
            id="dueDate"
            class=${classMap(this.theme.elements.input)}
            type="date"
          />
        </div>
        <div
          class=${classMap(
            merge(
              this.theme.layouts.horizontalPadded,
              this.theme.modifiers.borderTop
            )
          )}
        >
          <button
            class=${classMap(
              merge(this.theme.elements.button, { "layout-mr-2": true })
            )}
          >
            Done
          </button>
          <button class=${classMap(this.theme.elements.button)}>Remove</button>
        </div>
      </ui-card>`;
  }
}
