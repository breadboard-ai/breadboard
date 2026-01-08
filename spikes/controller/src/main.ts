/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { Controller } from "./controller/controller.js";
import { SignalWatcher } from "@lit-labs/signals";
import { controllerContext } from "./controller/context/context.js";
import { provide } from "@lit/context";
import { WindowDecorator } from "./host/decorator.js";
import * as Styles from "./styles/styles.js";

import "./elements/drawable-canvas/drawable-canvas.js";
import "./elements/splitter/splitter.js";
import "./elements/text-editor/text-editor.js";
import "./elements/theme-switch/theme-switch.js";

@customElement("bb-main")
export class Main extends SignalWatcher(LitElement) {
  @property()
  @provide({ context: controllerContext })
  accessor controller: Controller = new Controller();

  #decorator = new WindowDecorator(this.controller);

  static styles = [
    Styles.Theme.colorScheme,
    css`
      * {
        box-sizing: border-box;
      }

      :host {
        display: flex;
        flex-direction: column;
        gap: 8px;
        background: light-dark(#fff, #222);
        color: light-dark(#333, #fff);
        width: 100%;
        height: 100%;
        padding: 8px;
      }

      ui-splitter {
        height: 100%;
        flex: 1;
        overflow: hidden;

        & > div {
          height: 95%;
        }

        #controls {
          margin-bottom: 16px;
        }
      }
    `,
  ];

  connectedCallback(): void {
    super.connectedCallback();

    this.#decorator.connect();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();

    this.#decorator.disconnect();
  }

  #renderThemeSwitch() {
    return html`<theme-switch></heme-switch>`;
  }

  #renderTextEditor() {
    return html` <div slot="s0">
      <div id="controls">
        <button
          @click=${() => {
            const textValue = this.controller.text.textValue;
            this.controller.text.setTextValue(
              textValue + `{{chip:${Date.now()}}}`
            );
          }}
        >
          Add a chip
        </button>
      </div>
      <text-editor></text-editor>
    </div>`;
  }

  #renderOtherItem() {
    return html`<div slot="s1"><drawable-canvas></drawable-canvas></div>`;
  }

  #renderControls() {
    return html`<ui-splitter>
      ${[this.#renderTextEditor(), this.#renderOtherItem()]}
    </ui-splitter>`;
  }

  render() {
    return [this.#renderThemeSwitch(), this.#renderControls()];
  }
}
