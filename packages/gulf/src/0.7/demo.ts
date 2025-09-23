/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import "./ui/ui.js";
import { DataModel } from "./data/model.js";
import { LitElement, html, css, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { markdown } from "./directives/markdown.js";
import { icons } from "./utils/icons.js";
import { StateEvent } from "./events/events.js";

@customElement("gulf-main")
export class GulfMain extends LitElement {
  static styles = [
    icons,
    css`
      :host {
        display: block;
        width: 100%;
        font-family: var(--font-family);
      }

      form {
        display: flex;
        gap: 16px;
        align-items: center;
        padding: 16px 0;

        & > input {
          display: block;
          flex: 1;
          border-radius: 32px;
          padding: 16px 24px;
          border: 1px solid #ccc;
          font-size: 16px;
        }

        & > button {
          background: #222;
          color: #fff;
          border: none;
          padding: 8px 16px;
          border-radius: 32px;
          opacity: 0.5;

          &:not([disabled]) {
            cursor: pointer;
            opacity: 1;
          }
        }
      }

      hr {
        border: none;
        height: 1px;
        background: #ccc;
      }

      gulf-root {
        margin: 32px 0;
      }

      .rotate {
        animation: rotate 1s linear infinite;
      }

      .pending {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;

        & .g-icon {
          margin-right: 8px;
        }
      }

      details {
        font-size: 14px;

        & summary {
          list-style: none;
          cursor: pointer;

          &::-webkit-details-marker {
            display: none;
          }
        }
      }

      @keyframes rotate {
        from {
          rotate: 0deg;
        }

        to {
          rotate: 360deg;
        }
      }
    `,
  ];

  @state()
  accessor #data: {
    rawText?: string;
    model?: DataModel;
  } | null = null;

  @state()
  accessor #fetching = false;

  @state()
  accessor #error: string | null = null;

  #renderData() {
    if (!this.#data) {
      return nothing;
    }

    return [
      this.#data.model
        ? html`<gulf-root
              id=${this.#data.model.data.root.id}
              .model=${this.#data.model}
              .components=${[this.#data.model.data.root]}
              @gulfaction=${async (evt: StateEvent<"gulf.action">) => {
                if (!this.#data?.model) {
                  return;
                }

                if (!evt.detail.action.context) {
                  return;
                }

                const payload: Record<string, unknown> = {};
                for (const item of evt.detail.action.context) {
                  if (item.value.path) {
                    payload[item.key] = await this.#data.model.getDataProperty(
                      item.value.path
                    );
                  } else if (item.value.literalBoolean) {
                    payload[item.key] = item.value.literalBoolean;
                  } else if (item.value.literalNumber) {
                    payload[item.key] = item.value.literalNumber;
                  } else if (item.value.literalString) {
                    payload[item.key] = item.value.literalString;
                  }
                }

                const { action } = evt.detail.action;
                const message = { action, payload };

                // TODO: Post back.
                console.log(JSON.stringify(message, null, 2));
              }}
            ></gulf-root>
            <hr />`
        : nothing,

      this.#data.rawText
        ? html`<details>
            <summary>Text response</summary>
            ${markdown(this.#data.rawText)}
          </details>`
        : nothing,
    ];
  }

  render() {
    return [
      this.#data
        ? nothing
        : html`<form
            @submit=${async (evt: Event) => {
              evt.preventDefault();
              if (!(evt.target instanceof HTMLFormElement)) {
                return;
              }

              const data = new FormData(evt.target);
              const body = data.get("body") ?? null;
              if (!body) {
                return;
              }

              this.#fetching = true;
              const response = await fetch("/a2a", { method: "POST", body });
              this.#fetching = false;

              const items = await response.json();
              if (Array.isArray(items)) {
                for (const item of items) {
                  if (item.kind === "text") {
                    this.#data = this.#data ?? {};
                    this.#data.rawText = item.text;
                  } else if (item.kind === "data") {
                    this.#data = this.#data ?? {};
                    if (item.data.gulfMessages) {
                      if (Array.isArray(item.data.gulfMessages)) {
                        this.#data.model = new DataModel(
                          item.data.gulfMessages
                        );

                        (window as unknown as { __model: DataModel }).__model =
                          this.#data.model;
                      } else {
                        this.#error = "Unable to retrieve.";
                      }
                    } else if (item.data.error) {
                      this.#error = item.data.error;
                    }
                  }
                }
              } else {
                this.#error = "Unable to retrieve.";
              }
            }}
          >
            <input
              required
              value="Show me a list of image cards with information about Italian restaurants in downtown New York."
              autocomplete="off"
              id="body"
              name="body"
              type="text"
              ?disabled=${this.#fetching}
            />
            <button type="submit" ?disabled=${this.#fetching}>Send</button>
          </form>`,
      this.#fetching
        ? html` <div class="pending">
            <span class="g-icon filled-heavy rotate">progress_activity</span>
            Awaiting response...
          </div>`
        : this.#data
          ? this.#renderData()
          : nothing,
      this.#error ? html`${this.#error}` : nothing,
    ];
  }
}

const main = new GulfMain();
document.body.appendChild(main);
