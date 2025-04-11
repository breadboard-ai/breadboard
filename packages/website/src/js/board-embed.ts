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

import "@breadboard-ai/shared-ui/editor";

import {
  GraphDescriptor,
  StubFileSystem,
  asRuntimeKit,
  createGraphStore,
  createLoader,
} from "@google-labs/breadboard";
import { until } from "lit/directives/until.js";
import { kitFromGraphDescriptor } from "@google-labs/breadboard/kits";

const UPDATE_USER_TIMEOUT = 1_000;

@customElement("bb-board-embed")
export class BoardEmbed extends LitElement {
  @property({ reflect: true })
  url: string | null = null;

  @property({ reflect: true })
  collapseNodesByDefault = "true";

  @property({ reflect: true })
  active = false;

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

  #data: Promise<TemplateResult> | null = null;
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

    #overlay {
      border-radius: 8px;
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: transparent;
      z-index: 1;
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
    this.#observer.disconnect();
  }

  async loadBoard() {
    if (!this.url) {
      return html`Unable to load - no URL provided`;
    }
    const loader = createLoader([]);
    const kits = [
      asRuntimeKit(Core),
      asRuntimeKit(JSONKit),
      asRuntimeKit(TemplateKit),
      asRuntimeKit(GeminiKit),
    ];
    const agentKit = kitFromGraphDescriptor(AgentKit as GraphDescriptor);
    if (agentKit) {
      kits.push(agentKit);
    }

    const graphStore = createGraphStore({
      kits,
      loader,
      sandbox: {
        runModule: () => {
          throw new Error("TODO: Teach BoardEmbed about sandbox.");
        },
      },
      fileSystem: new StubFileSystem(),
    });

    const graph = await loader.load(this.url, {
      base: new URL(this.url, location.href),
    });

    if (!graph) {
      return html`Unable to load board`;
    }

    if (!graph.success) {
      return html`Unable to load board`;
    }

    const adding = graphStore.addByDescriptor(graph.graph);
    if (!adding.success) {
      return html`Unable to load board`;
    }
    const inspectableGraph = graphStore.inspect(adding.result, "");

    return html`<bb-renderer
        .graph=${inspectableGraph}
        .graphTopologyUpdateId=${1}
      ></bb-renderer>
      <div id="overlay"></div>
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
