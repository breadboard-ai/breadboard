/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css, TemplateResult, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { cache } from "lit/directives/cache.js";

import Core from "@google-labs/core-kit";
import JSONKit from "@google-labs/json-kit";
import TemplateKit from "@google-labs/template-kit";
import GeminiKit from "@google-labs/gemini-kit";
import AgentKit from "@google-labs/agent-kit/agent.kit.json" assert { type: "json" };

import "@google-labs/breadboard-ui/editor";

import {
  KitManifest,
  asRuntimeKit,
  createLoader,
} from "@google-labs/breadboard";
import { until } from "lit/directives/until.js";
import { fromManifest } from "@google-labs/breadboard/kits";

const UPDATE_USER_TIMEOUT = 1_000;

@customElement("bb-board-embed")
export class BoardEmbed extends LitElement {
  @property({ reflect: true })
  url: string | null = null;

  @property({ reflect: true })
  collapseNodesByDefault = "true";

  @property({ reflect: true })
  active = false;

  #data: Promise<TemplateResult> | null = null;
  #observer = new IntersectionObserver(
    (entries) => {
      this.active = false;

      if (entries.length === 0) {
        return;
      }

      this.active = entries[0].isIntersecting;
    },
    { rootMargin: "80px", threshold: 0 }
  );

  static styles = css`
    :host {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 400px;
      margin: 20px 0 40px 0;
      border-radius: 8px;
      background: var(--bb-ui-50);
      box-shadow:
        0px 25px 13.1px rgba(0, 0, 0, 0.05),
        0px 45px 50px rgba(0, 0, 0, 0.15);
      position: relative;
    }

    bb-editor {
      border-radius: 8px;
      aspect-ratio: 4/3;
      display: block;
    }

    #see-in-ve {
      position: absolute;
      bottom: var(--bb-grid-size-2);
      left: var(--bb-grid-size-2);
      border-radius: var(--bb-grid-size-8);
      background: var(--bb-neutral-0);
      padding: var(--bb-grid-size-2) var(--bb-grid-size-4);
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
      color: var(--bb-neutral-700);
      z-index: 100;
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();

    this.#observer.observe(this);
    this.#data = this.loadBoard();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();

    this.#observer.unobserve(this);
  }

  async loadBoard() {
    if (!this.url) {
      return html`Unable to load - no URL provided`;
    }

    const response = await fetch(this.url);
    const graph = await response.json();
    const kits = [
      asRuntimeKit(Core),
      asRuntimeKit(JSONKit),
      asRuntimeKit(TemplateKit),
      asRuntimeKit(GeminiKit),
      fromManifest(AgentKit as KitManifest),
    ];

    const collapseNodesByDefault = this.collapseNodesByDefault === "true";

    return html`<bb-editor
        .loader=${createLoader([])}
        .kits=${kits}
        .assetPrefix=${"/breadboard/static"}
        .graph=${graph}
        .boardId=${1}
        .editable=${false}
        .showControls=${false}
        .mode=${"minimal"}
        .collapseNodesByDefault=${collapseNodesByDefault}
        .hideSubboardSelectorWhenEmpty=${true}
        .readOnly=${true}
      ></bb-editor>
      ${this.url
        ? html`<a
            id="see-in-ve"
            href="http://breadboard-ai.web.app/?board=${encodeURIComponent(
              `${location.origin}${this.url}`
            )}&embed=false"
            >See in Visual Editor</a
          >`
        : nothing} `;
  }

  render() {
    const updateUser = new Promise((r) =>
      setTimeout(r, UPDATE_USER_TIMEOUT)
    ).then(() => html`🤖 Getting there... Hang on...`);

    return this.active
      ? cache(html`${until(this.#data, updateUser)}`)
      : nothing;
  }
}
