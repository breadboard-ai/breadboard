/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import "../0.7/ui/ui.js";
import { DataModel } from "../0.7/data/model.js";
import { LitElement, html, css, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { icons } from "../0.7/utils/icons.js";
import { StateEvent } from "../0.7/events/events.js";

import { theme as uiTheme } from "./theme/theme.js";
import { themeContext } from "../0.7/ui/context/theme.js";
import { Theme } from "../0.7/types/types.js";
import { provide } from "@lit/context";
import * as Styles from "../0.7/ui/styles/index.js";

@customElement("gulf-main")
export class GulfMain extends LitElement {
  @provide({ context: themeContext })
  accessor theme: Theme = uiTheme;

  static styles = [
    Styles.all,
    icons,
    css`
      * {
        box-sizing: border-box;
      }

      :host {
        display: flex;
        width: 100%;
        max-width: 480px;
        margin: 0 auto;
        min-height: 100%;
        font-family: var(--font-family);
        align-items: center;
        padding: 32px 0;
      }

      form {
        display: flex;
        flex-direction: column;
        flex: 1;
        gap: 16px;
        align-items: center;
        padding: 16px 0;
        animation: fadeIn 1s cubic-bezier(0, 0, 0.3, 1) 1s backwards;

        & > div {
          display: flex;
          flex: 1;
          gap: 16px;
          align-items: center;
          width: 100%;

          & > input {
            display: block;
            flex: 1;
            border-radius: 32px;
            padding: 16px 24px;
            border: 1px solid var(--p-60);
            font-size: 16px;
          }

          & > button {
            display: flex;
            align-items: center;
            background: var(--p-40);
            color: var(--n-100);
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
      }

      gulf-root {
        width: 100%;
        animation: fadeIn 1s cubic-bezier(0, 0, 0.3, 1) 0.3s backwards;
      }

      .rotate {
        animation: rotate 1s linear infinite;
      }

      .pending {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: fadeIn 1s cubic-bezier(0, 0, 0.3, 1) 0.3s backwards;

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

      @keyframes fadeIn {
        from {
          opacity: 0;
        }

        to {
          opacity: 1;
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

    if (
      !this.#data.model ||
      !this.#data.model.current ||
      !this.#data.model.current.root
    ) {
      return nothing;
    }

    return [
      this.#data.model
        ? html`<gulf-root
            id=${this.#data.model.current.root.id}
            .model=${this.#data.model}
            .components=${[this.#data.model.current.root]}
            @gulfaction=${async (evt: StateEvent<"gulf.action">) => {
              if (!this.#data?.model) {
                return;
              }

              if (!evt.detail.action.context) {
                return;
              }

              const details: Record<string, unknown> = {};
              for (const item of evt.detail.action.context) {
                if (item.value.path) {
                  details[item.key] = await this.#data.model.getDataProperty(
                    item.value.path,
                    evt.detail.dataPrefix
                  );
                } else if (item.value.literalBoolean) {
                  details[item.key] = item.value.literalBoolean;
                } else if (item.value.literalNumber) {
                  details[item.key] = item.value.literalNumber;
                } else if (item.value.literalString) {
                  details[item.key] = item.value.literalString;
                }
              }

              const { action } = evt.detail.action;
              const message = { action, payload: details };

              this.#sendToRemote(JSON.stringify(message), {
                "Content-Type": "application/json",
              });
            }}
          ></gulf-root>`
        : nothing,
    ];
  }

  async #sendToRemote(body: BodyInit, headers: HeadersInit = {}) {
    this.#fetching = true;
    const response = await fetch("/a2a", {
      method: "POST",
      body,
      headers,
    });
    this.#fetching = false;

    try {
      const items = await response.json();
      if (Array.isArray(items)) {
        for (const item of items) {
          if (item.kind === "text") {
            this.#data = this.#data ?? {};
            this.#data.rawText = item.text;
          } else if (item.kind === "data" && item.data) {
            this.#data = this.#data ?? {};
            if (item.data.gulfMessages) {
              if (Array.isArray(item.data.gulfMessages)) {
                const streamHeader = item.data.gulfMessages.find(
                  (msg: { version?: string }) => {
                    return "version" in msg && msg.version;
                  }
                );
                if (!streamHeader) {
                  item.data.gulfMessages.unshift({ version: "0.7" });
                }
                this.#data.model = new DataModel();
                await this.#data.model.append(item.data.gulfMessages);
                this.#data.model.finalize();

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
    } catch (err) {
      console.warn(err);
      this.#error = "Unable to handle response.";
    }
  }

  render() {
    return [
      this.#data || this.#fetching
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

              this.#sendToRemote(body);
            }}
          >
            <h1
              class="typography-f-sf typography-v-r typography-w-400 color-c-p30"
            >
              Restaurant Finder
            </h1>
            <div>
              <input
                required
                value="Chinese restaurants in Mountain View."
                autocomplete="off"
                id="body"
                name="body"
                type="text"
                ?disabled=${this.#fetching}
              />
              <button type="submit" ?disabled=${this.#fetching}>
                <span class="g-icon filled-heavy">send</span>
              </button>
            </div>
          </form>`,
      this.#fetching
        ? html` <div class="pending">
            <span class="g-icon filled-heavy rotate">progress_activity</span>
            Awaiting an answer...
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
