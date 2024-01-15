/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { run } from "@google-labs/breadboard/harness";
import { createRunConfig } from "./config";
import { createRef, ref, type Ref } from "lit/directives/ref.js";
import { customElement, property } from "lit/decorators.js";
import { LitElement, html, css } from "lit";
import * as BreadboardUI from "@google-labs/breadboard-ui";
import { InputResolveRequest } from "@google-labs/breadboard/remote";
import { Board } from "@google-labs/breadboard";

export const getBoardInfo = async (url: string) => {
  const runner = await Board.load(url);

  const { title, description, version } = runner;
  const diagram = runner.mermaid("TD", true);
  const nodes = runner.nodes;

  return { title, description, version, diagram, url, nodes };
};

// TODO: Remove once all elements are Lit-based.
BreadboardUI.register();

@customElement("bb-main")
export class Main extends LitElement {
  @property({ reflect: false })
  config: { boards: BreadboardUI.Types.Board[] };

  #uiRef: Ref<BreadboardUI.UI> = createRef();
  #boardId = 0;
  #delay = 0;
  #status = BreadboardUI.Types.STATUS.STOPPED;
  #statusObservers: Array<(value: BreadboardUI.Types.STATUS) => void> = [];
  #bootWithUrl: string | null = null;

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

    const currentUrl = new URL(window.location.href);
    const boardFromUrl = currentUrl.searchParams.get("board");
    if (!boardFromUrl) {
      return;
    }
    this.#bootWithUrl = boardFromUrl;
  }

  get status() {
    return this.#status;
  }

  set status(status: BreadboardUI.Types.STATUS) {
    this.#status = status;
    this.requestUpdate();
  }

  async #onStartBoard(startEvent: BreadboardUI.StartEvent) {
    this.#boardId++;
    this.#setActiveBreadboard(startEvent.url);

    this.status = BreadboardUI.Types.STATUS.RUNNING;

    if (!this.#uiRef.value) {
      console.warn("No UI found");
      return;
    }

    const ui = this.#uiRef.value;
    ui.url = startEvent.url;
    ui.load(await getBoardInfo(ui.url));

    const currentBoardId = this.#boardId;

    for await (const result of run(createRunConfig(startEvent.url))) {
      if (this.#delay !== 0) {
        await new Promise((r) => setTimeout(r, this.#delay));
      }

      if (currentBoardId !== this.#boardId) {
        return;
      }

      const answer = await ui.handleStateChange(result);
      await this.#waitIfPaused(answer);

      if (answer) {
        result.reply({ inputs: answer } as InputResolveRequest);
      }
    }

    this.status = BreadboardUI.Types.STATUS.STOPPED;
  }

  #waitIfPaused(answer: unknown) {
    // We can use the answer as a signal for whether or not to proceed. In cases
    // where user input is not required, the answer will be void/undefined, and
    // we should honor the pause signal. When a user submits an answer (which
    // they can only do for the most recent message going to the UI) then its
    // value will not be void/undefined, and we can treat that as a signal to
    // unpause.
    const shouldUnpause = typeof answer !== "undefined";
    if (shouldUnpause && this.status === BreadboardUI.Types.STATUS.PAUSED) {
      if (confirm("Are you sure you wish to resume?")) {
        this.status = BreadboardUI.Types.STATUS.RUNNING;
      }
    }

    if (this.status !== BreadboardUI.Types.STATUS.PAUSED) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      this.#statusObservers.push((status: BreadboardUI.Types.STATUS) => {
        if (status !== BreadboardUI.Types.STATUS.RUNNING) {
          return;
        }

        resolve();
      });
    });
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
      .status=${this.status}
      .bootWithUrl=${this.#bootWithUrl}
      @breadboardstart=${this.#onStartBoard}
      @breadboardmessagetraversal=${() => {
        if (this.status !== BreadboardUI.Types.STATUS.RUNNING) {
          return;
        }

        this.status = BreadboardUI.Types.STATUS.PAUSED;

        if (this.#uiRef.value) {
          this.#uiRef.value.toast(
            "Board paused",
            "information" as BreadboardUI.Events.ToastType
          );
        }
      }}
      @breadboardboardunload=${() => {
        this.#setActiveBreadboard(null);

        this.#boardId++;
        if (!this.#uiRef.value) {
          console.warn("Unable to find UI");
          return;
        }
        this.#uiRef.value.bootWithUrl = null;
        this.#uiRef.value.url = null;
      }}
      @breadboardtoast=${(toastEvent: BreadboardUI.ToastEvent) => {
        if (!this.#uiRef.value) {
          return;
        }

        this.#uiRef.value.toast(toastEvent.message, toastEvent.toastType);
      }}
      @breadboarddelay=${(delayEvent: BreadboardUI.DelayEvent) => {
        this.#delay = delayEvent.duration;
      }}
      .boards=${this.config.boards}
    ></bb-ui-manager>`;
  }
}
