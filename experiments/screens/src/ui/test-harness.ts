/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { Screen, ScreenInput } from "../types";
import "./screen-renderer";
import "./console-view";

@customElement("test-harness")
export class TestHarness extends LitElement {
  @property({ type: Array })
  screens: Screen[] = [];

  @property({ type: Object })
  screenStates = new Map<string, ScreenInput>();

  @property({ type: Array })
  log: unknown[][] = [];

  @property({ type: Object })
  vfs = new Map<string, string>();

  @state()
  activeScreen: string | null = null;

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100vh;
      font-family: sans-serif;
    }

    .tabs {
      display: flex;
      border-bottom: 1px solid #ccc;
    }

    .tab {
      padding: 10px;
      cursor: pointer;
      border: 1px solid #ccc;
      border-bottom: none;
      margin-right: 5px;
      position: relative;
    }

    .tab.active {
      background-color: #eee;
    }

    .tab.updated::after {
      content: "";
      position: absolute;
      top: 5px;
      right: 5px;
      width: 10px;
      height: 10px;
      background-color: red;
      border-radius: 50%;
    }

    .content {
      flex: 1;
      overflow-y: auto;
    }
  `;

  willUpdate(changedProperties: Map<string, unknown>) {
    if (changedProperties.has("screens") && this.screens.length > 0) {
      this.activeScreen = this.screens[0].screenId;
    }
  }

  #onTabClick(e: Event) {
    const target = e.target as HTMLElement;
    const screenId = target.dataset.screenId;
    if (screenId) {
      this.activeScreen = screenId;
      target.classList.remove("updated");
    }
  }

  render() {
    const activeScreenState = this.activeScreen
      ? this.screenStates.get(this.activeScreen)
      : undefined;

    return html`
      <div class="tabs">
        ${this.screens.map(
          (screen) => html`
            <button
              class="tab ${this.activeScreen === screen.screenId
                ? "active"
                : ""} ${this.screenStates.has(screen.screenId)
                ? "updated"
                : ""}"
              data-screen-id=${screen.screenId}
              @click=${this.#onTabClick}
            >
              ${screen.screenId}
            </button>
          `
        )}
      </div>
      <div class="content">
        ${activeScreenState
          ? html`<screen-renderer
              .screen=${this.screens.find(
                (s) => s.screenId === this.activeScreen
              )}
              .inputs=${activeScreenState.inputs}
              .vfs=${this.vfs}
            ></screen-renderer>`
          : html`<p>No active screen</p>`}
      </div>
      <console-view .log=${this.log}></console-view>
    `;
  }
}
