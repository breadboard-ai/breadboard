/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Schema, BoardRunner } from "@google-labs/breadboard";
import { LitElement, PropertyValues, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { WizardCompleteEvent } from "../events/events.js";
import { Template } from "../../types/types.js";

@customElement("bb-board-wizard")
export class BoardWizard extends LitElement {
  @property({ attribute: false })
  board: BoardRunner | null = null;

  @state()
  configuration: Record<string, unknown> = {};

  static styles = css`
    :host {
      --default-bb-grid-size: 4px;
      --default-bb-font-family: monospace;
      --default-bb-accent-color: #6b5484;

      --default-bb-input-border-radius: 32px;
      --default-bb-input-background-color: #6b5484;
      --default-bb-input-border: none;
      --default-bb-input-padding: 8px 24px;
      --default-bb-input-color: #fff;

      --default-bb-submit-input-text-transform: none;
      --default-bb-line-height: 1.5;
      --default-bb-input-box-shadow: 0 6px 9px 0 rgba(0, 0, 0, 0.12),
        0 2px 3px 0 rgba(0, 0, 0, 0.23);

      line-height: var(--bb-line-height, var(--default-bb-line-height));

      display: grid;
      grid-template-columns: max(300px, 25vw) auto;
      column-gap: calc(var(--bb-grid-size, var(--bb-default-grid-size)) * 4);
      row-gap: 16px;
      flex: 1;
      height: 100%;
    }

    #options {
      padding: 16px;
      background: #fff;
      box-shadow: var(
        --bb-input-box-shadow,
        var(--default-bb-input-box-shadow)
      );
      font-size: 12px;
    }

    form {
      display: grid;
      row-gap: 16px;
    }

    fieldset {
      border-radius: 8px;
      border: 1px solid #ddd;
      display: grid;
      row-gap: 8px;
    }

    fieldset section,
    fieldset section > div {
      display: grid;
      grid-template-columns: 1fr 1fr;
      justify-content: start;
      row-gap: 8px;
    }

    fieldset section > div {
      grid-column: 1/3;
    }

    fieldset section > * {
      margin: 0;
    }

    legend {
      font-weight: bold;
    }

    a {
      color: var(--bb-accent-color, var(--default-bb-accent-color));
      text-decoration: none;
      margin-bottom: 24px;
      display: block;
    }

    h1 {
      font-size: 24px;
      margin: 0;
      padding: 24px 36px 0 36px;
      font-weight: normal;
      text-transform: uppercase;
    }

    h2 {
      font-size: 14px;
      margin: 0;
      padding: 24px 36px 0 36px;
      font-weight: normal;
      text-transform: uppercase;
    }

    input[type="submit"] {
      display: block;
      width: auto;
      max-width: 140px;
      cursor: pointer;

      background-color: var(
        --bb-input-background-color,
        var(--default-bb-input-background-color)
      );

      border: var(--bb-input-border, var(--default-bb-input-border));
      border-radius: var(
        --bb-input-border-radius,
        var(--default-bb-input-border-radius)
      );

      color: var(--bb-input-color, var(--default-bb-input-color));
      font-family: var(--bb-font-family, var(--default-bb-font-family));
      padding: var(--bb-input-padding, var(--default-bb-input-padding));
      text-transform: var(
        --bb-submit-input-text-transform,
        var(--default-bb-submit-input-text-transform)
      );
    }
  `;

  protected willUpdate(changedProperties: PropertyValues<this>): void {
    // When the board changes, empty the configuration.
    if (changedProperties.has("board")) {
      this.configuration = {};
    }
  }

  render() {
    if (!this.board) {
      return html`No board provided`;
    }

    const inputs = [];
    const secrets = [];

    for (const node of this.board.nodes) {
      switch (node.type) {
        case "input":
          inputs.push(node);
          break;

        case "secrets":
          secrets.push(node);
          break;
      }
    }

    return html`
      <section id="options">
        <a href="/"><- Home</a>
        <form @submit="${this.#onSubmit}">
          <fieldset>
            <legend>App Options</legend>
            <section>
              <label for="__board_title">Title</label>
              <input
                type="text"
                id="__board_title"
                name="__board_title"
                value="${this.board.title || ""}"
              />
            </section>

            <section>
              <label for="__board_version">Version</label>
              <input
                type="text"
                id="__board_version"
                name="__board_version"
                value="${this.board.version || ""}"
              />
            </section>

            <section>
              <label for="__board_version">Description</label>
              <input
                type="text"
                id="__board_description"
                name="__board_description"
                value="${this.board.description || ""}"
              />
            </section>

            <section>
              <label for="template">Template</label>
              <select id="template" name="template">
                ${Object.values(Template).map((templateName) => {
                  const displayName =
                    templateName[0].toLocaleUpperCase() +
                    templateName.substring(1);
                  return html`<option value="${templateName}">
                    ${displayName}
                  </option>`;
                })}
              </select>
            </section>

            <section>
              <label for="__board::general::retain-inputs">Retain Inputs</label>
              <input
                type="checkbox"
                id="__board::general::retain-inputs"
                name="__board::general::retain-inputs"
              />
            </section>
          </fieldset>

          ${inputs.map((node) => {
            const configuration = node.configuration;
            if (!configuration) {
              return;
            }
            const schema = configuration.schema as Schema;
            const properties = schema.properties;
            if (!properties) {
              return;
            }

            return html`
              ${Object.entries(properties).map((property) => {
                const [name, schema] = property;
                let tmpl;
                switch (schema.type) {
                  case `image/png`:
                    tmpl = html`No options available`;
                    break;

                  case `string`:
                    tmpl = html` <div>
                        <label for="${node.id}::${name}::default-value"
                          >Default value</label
                        >
                        <input
                          type="input"
                          name="${node.id}::${name}::default-value"
                          id="${node.id}::${name}::default-value"
                          value="${schema.examples ? schema.examples[0] : ""}"
                        />
                      </div>

                      <div>
                        <label for="${node.id}::${name}::configurable"
                          >Allow user to fill</label
                        >
                        <input
                          type="checkbox"
                          id="${node.id}::${name}::configurable"
                          name="${node.id}::${name}::configurable"
                          checked
                        />
                      </div>`;
                    break;

                  default:
                    tmpl = html`Unknown type`;
                    break;
                }

                return html` <fieldset>
                  <legend>Input: ${name}</legend>
                  <section>${tmpl}</section>
                </fieldset>`;
              })}
            `;
          })}

          <fieldset>
            <legend>Secrets</legend>
            ${secrets.map((node) => {
              if (!node.configuration) {
                return;
              }

              const keys = node.configuration.keys;
              if (!Array.isArray(keys)) {
                return;
              }

              return html`${keys.map((secretKey) => {
                return html` <section>
                  <label for="${secretKey}">${secretKey}</label>
                  <input
                    type="password"
                    autocomplete="off"
                    required
                    id="${secretKey}"
                    name="env::${secretKey}"
                    placeholder="${secretKey}"
                  />
                </section>`;
              })}`;
            })}
          </fieldset>

          <input type="submit" />
        </form>
      </section>
      <section id="preview">
        <div id="wrapper">
          <h1>Preview</h1>
          <h2>Eventually...</h2>
        </div>
      </section>
    `;
  }

  #onSubmit(evt: Event) {
    evt.preventDefault();

    if (!(evt.target instanceof HTMLFormElement) || !this.board) {
      return;
    }

    const data = new FormData(evt.target);
    for (const [key, value] of data) {
      this.configuration[key] = value;
    }

    // Set a few final bits on the config.
    const title = this.board.title || "Untitled board";
    const version = this.board.version || "0.0.1";
    const description = this.board.description || "";

    this.configuration["title"] = title;
    this.configuration["version"] = version;
    this.configuration["description"] = description;
    this.configuration["packageName"] = title
      .toLocaleLowerCase()
      .replace(/\W/gim, "-");

    this.dispatchEvent(new WizardCompleteEvent(this.configuration));
  }
}
