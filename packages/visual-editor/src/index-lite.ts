/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";
import { SignalWatcher } from "@lit-labs/signals";
import { MainArguments } from "./types/types";

import * as BBLite from "@breadboard-ai/shared-ui/lite";

@customElement("bb-lite")
export class LiteMain extends SignalWatcher(LitElement) {
  static styles = [
    BBLite.Styles.HostIcons.icons,
    BBLite.Styles.HostBehavior.behavior,
    BBLite.Styles.HostColors.baseColors,
    BBLite.Styles.HostType.type,
    css`
      * {
        box-sizing: border-box;
      }

      :host {
        display: block;
        flex: 1;
      }

      #lite-shell {
        display: block;
        height: 100%;
        width: 100%;
        padding: var(--bb-grid-size-3);

        & #app-view {
          margin: 0 0 0 var(--bb-grid-size-3);
        }

        & bb-splitter {
          height: 100%;
          width: 100%;
        }
      }
    `,
  ];

  constructor(_args: MainArguments) {
    super();
  }

  #renderList() {
    return html`<div id="controls-view" slot="slot-0">
      <bb-step-list-view
        .listTitle=${"Running 5 Steps..."}
        .listDescription=${`I will be running the following steps to create an app that generates a newsletter with multimedia assets based on a topic that a user gives it.`}
        .listItems=${[
          {
            title: "Ask user about topic",
            icon: "chat_mirror",
            status: "complete",
            content: "Precious stones",
          },

          {
            status: "complete",
            title: "Generate newsletter text",
            content: "Generating content...",
            icon: "spark",
          },

          {
            status: "working",
            title: "Generate image header for newsletter",
            content: "Generating content...",
            icon: "spark",
          },

          {
            status: "working",
            title: "Generate video header for newsletter",
            content: "Generating content...",
            icon: "spark",
          },

          {
            status: "working",
            title: "Display in newsletter format",
            content: "Generated content",
            icon: "responsive_layout",
          },
        ]}
      ></bb-step-list-view>
    </div>`;
  }

  #renderApp() {
    return html`<div id="app-view" slot="slot-1">App</div>`;
  }

  render() {
    return html`<section id="lite-shell">
      <bb-splitter
        direction=${"horizontal"}
        name="layout-main"
        split="[0.70, 0.30]"
      >
        ${[this.#renderList(), this.#renderApp()]}
      </bb-splitter>
    </section>`;
  }
}
