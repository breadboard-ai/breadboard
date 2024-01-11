/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { createHarness } from "@google-labs/breadboard/harness";
import { createHarnessConfig } from "./config";
import { createRef, ref, type Ref } from "lit/directives/ref.js";
import { customElement, property } from "lit/decorators.js";
import { LitElement, html, css } from "lit";
import * as BreadboardUI from "@google-labs/breadboard-ui";

// TODO: Remove once all elements are Lit-based.
BreadboardUI.register();

@customElement("bb-main")
export class Main extends LitElement {
  @property({ reflect: false })
  config: { boards: BreadboardUI.Types.Board[] };

  #uiRef: Ref<BreadboardUI.UI> = createRef();
  #boardId = 0;
  #delay = 0;

  static styles = css`
    :host {
      display: block;
    }
  `;

  constructor(config: { boards: BreadboardUI.Types.Board[] }) {
    super();

    // Remove boards that are still works-in-progress from production builds.
    // These boards will have either no version or a version of "0.0.1".
    if (import.meta.env.MODE === "production") {
      config.boards = config.boards.filter(
        (board) => board.version && board.version !== "0.0.1"
      );
    }
    config.boards.sort((a, b) => a.title.localeCompare(b.title));
    this.config = config;

    document.body.addEventListener(
      BreadboardUI.StartEvent.eventName,
      async (evt: Event) => {
        const ui = this.#uiRef.value;
        if (!ui) {
          return;
        }

        this.#boardId++;

        const startEvent = evt as BreadboardUI.StartEvent;
        this.#setActiveBreadboard(startEvent.url);

        const harness = createHarness(createHarnessConfig(startEvent.url));
        ui.url = startEvent.url;
        ui.load(await harness.load());

        const currentBoardId = this.#boardId;
        for await (const result of harness.run()) {
          if (this.#delay !== 0) {
            await new Promise((r) => setTimeout(r, this.#delay));
          }

          if (currentBoardId !== this.#boardId) {
            return;
          }

          const answer = await ui.handleStateChange(result.message);
          if (answer) {
            result.reply(answer);
          }
        }
      }
    );
  }

  protected firstUpdated(): void {
    const currentUrl = new URL(window.location.href);
    const boardFromUrl = currentUrl.searchParams.get("board");
    if (boardFromUrl) {
      document.body.dispatchEvent(new BreadboardUI.StartEvent(boardFromUrl));
    }
  }

  #setActiveBreadboard(url: string | null) {
    const pageUrl = new URL(window.location.href);
    if (url === null) {
      pageUrl.searchParams.delete("board");
    } else {
      pageUrl.searchParams.set("board", url);
    }
    window.history.replaceState(null, "", pageUrl);
  }

  render() {
    return html`<bb-ui-manager
      ${ref(this.#uiRef)}
      @breadboardboardunloadevent=${() => {
        this.#setActiveBreadboard(null);
        this.#boardId++;
      }}
      @breadboardtoastevent=${(toastEvent: BreadboardUI.ToastEvent) => {
        if (!this.#uiRef.value) {
          return;
        }

        this.#uiRef.value.toast(toastEvent.message, toastEvent.toastType);
      }}
      @breadboarddelayevent=${(delayEvent: BreadboardUI.DelayEvent) => {
        this.#delay = delayEvent.duration;
      }}
      .boards=${this.config.boards}
    ></bb-ui-manager>`;
  }
}
