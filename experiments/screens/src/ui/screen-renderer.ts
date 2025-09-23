/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { Screen, SchemaValidated } from "../types";

@customElement("screen-renderer")
export class ScreenRenderer extends LitElement {
  @property({ type: Object })
  screen?: Screen;

  @property({ type: Object })
  inputs: SchemaValidated = {};

  @property({ type: Object })
  vfs = new Map<string, string>();

  static styles = css`
    .screen {
      padding: 20px;
    }
    .inputs,
    .events {
      margin-bottom: 20px;
    }
    label {
      display: block;
      margin-bottom: 10px;
    }
    textarea {
      width: 100%;
    }
    img {
      max-width: 100%;
    }
  `;

  #onEvent(eventId: string, output?: Record<string, SchemaValidated>) {
    this.dispatchEvent(
      new CustomEvent("user-event", {
        detail: {
          screenId: this.screen?.screenId,
          eventId,
          output,
        },
        bubbles: true,
        composed: true,
      })
    );
  }

  render() {
    if (!this.screen) {
      return html`<p>No screen selected</p>`;
    }

    return html`
      <div class="screen">
        <div class="inputs">
          <h1>${this.screen.screenId}</h1>
          ${Object.entries(this.screen.inputSchema.properties ?? {}).map(
            ([key, schema]) => {
              const value = (this.inputs as Record<string, SchemaValidated>)[
                key
              ];
              const isVfsPath =
                typeof value === "string" && value.startsWith("/vfs/out/");
              const vfsUrl = isVfsPath ? this.vfs.get(value) : null;
              return html`
                <div>
                  <label>${key}: (${schema.description})</label>
                  ${vfsUrl
                    ? html`<img src="${vfsUrl}" />`
                    : html`<p>${String(value)}</p>`}
                </div>
              `;
            }
          )}
        </div>
        <div class="events">
          ${this.screen.events.map(
            (event) => html`
              <form
                @submit=${(e: Event) => {
                  e.preventDefault();
                  if (!event.outputSchema) return;
                  const formData = new FormData(e.target as HTMLFormElement);
                  const output: Record<string, SchemaValidated> = {};
                  for (const [key] of Object.entries(
                    event.outputSchema.properties ?? {}
                  )) {
                    output[key] = formData.get(key) as string;
                  }
                  this.#onEvent(event.eventId, output);
                }}
              >
                <fieldset>
                  <legend>${event.description}</legend>
                  ${Object.entries(event.outputSchema?.properties ?? {}).map(
                    ([key]) => html`
                      <label>
                        ${key}
                        <textarea name=${key}></textarea>
                      </label>
                    `
                  )}
                  <button
                    type=${event.outputSchema ? "submit" : "button"}
                    @click=${() => {
                      if (event.outputSchema) return;
                      this.#onEvent(event.eventId);
                    }}
                  >
                    ${event.eventId}
                  </button>
                </fieldset>
              </form>
            `
          )}
        </div>
      </div>
    `;
  }
}
