/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css, svg } from "lit";
import { customElement, property } from "lit/decorators.js";
import { Controller } from "./controller/controller.js";
import { SignalWatcher } from "@lit-labs/signals";
import { controllerContext } from "./controller/context/context.js";
import { provide } from "@lit/context";
import { WindowDecorator } from "./host/decorator.js";
import * as Styles from "./styles/styles.js";
import {
  maybeRemoveDebugControls,
  maybeAddDebugControls,
} from "./debug/debug.js";

import { ref } from "lit/directives/ref.js";
import { guard } from "lit/directives/guard.js";

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

      #num-readout {
        width: 100%;
        height: 200px;

        svg {
          width: 100%;
          height: 100%;
        }
      }

      #debug-container {
        width: 400px;
        position: fixed;
        top: 12px;
        right: 12px;
        height: 10px;
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

  #renderCircle() {
    const color = this.controller.nested.simple.color;
    const colorStr = `rgb(${color.r.toFixed(0)}, ${color.g.toFixed(0)}, ${color.b.toFixed(0)})`;
    return html` ${colorStr} ${svg`
      <svg
        viewBox="0 0 100 100"
      >
        <circle cx="50" cy="50" fill=${colorStr} r=${this.controller.nested.simple.num}></circle>
        <text alignment-baseline="middle"
          text-anchor="middle"
          x="50" y="50"
          fill=${
            this.controller.nested.simple.boolean ? "white" : "black"
          }>${this.controller.nested.simple.num}</text>

      </svg>
    `}`;
  }

  #renderTextEditor() {
    return html` <div slot="s0">
      <div>
        <div id="num-readout">${this.#renderCircle()}</div>

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
      </div>
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

  #renderDebugContainer() {
    return guard(
      [],
      () =>
        html`<div
          ${ref((el?: Element) => {
            if (el) {
              if (!(el instanceof HTMLElement)) return;
              maybeAddDebugControls(this.controller, el);
              return;
            }

            maybeRemoveDebugControls();
          })}
          id="debug-container"
        ></div>`
    );
  }

  render() {
    return [
      this.#renderThemeSwitch(),
      this.#renderControls(),
      this.#renderDebugContainer(),
    ];
  }
}
