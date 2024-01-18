/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { HarnessRunResult, run } from "@google-labs/breadboard/harness";
import { createRunConfig } from "./config";
import { customElement, state } from "lit/decorators.js";
import { HTMLTemplateResult, LitElement, css, html, nothing } from "lit";
import * as BreadboardUI from "@google-labs/breadboard-ui";
import {
  Board,
  Schema,
  type InputValues,
  clone,
  StreamCapabilityType,
  OutputValues,
} from "@google-labs/breadboard";
import { until } from "lit/directives/until.js";

type ChunkOutputs = OutputValues & { chunk: string };

export const getBoardInfo = async (url: string) => {
  const runner = await Board.load(url);
  const { title, description, version } = runner;
  return { title, description, version };
};

// TODO: Remove once all elements are Lit-based.
BreadboardUI.register();

@customElement("bb-preview")
export class Preview extends LitElement {
  @state()
  uiElement: HTMLTemplateResult | symbol = nothing;

  @state()
  boardInfo: Awaited<ReturnType<typeof getBoardInfo>> | null = null;

  @state()
  embed = false;

  #config: ReturnType<typeof createRunConfig> | null = null;
  #url: string | null = null;
  #hasOutputs = false;
  #outputs: HTMLTemplateResult[] = [];

  static styles = css`
    :host {
      display: block;
      margin: 0;
      padding: 0;
      font-family: var(--bb-font-family);
      height: 100%;
      width: 100%;
    }

    * {
      box-sizing: border-box;
    }

    :host {
      display: flex;
      flex-direction: column;
      background: #f4f7fc url(/images/pattern.png);
    }

    main {
      padding: 32px;
      flex: 1 0 auto;
      max-width: 960px;
      margin: 0 auto;
      width: 100%;
    }

    h1 {
      font-size: 24px;
      margin: 0;
      padding: 24px calc(var(--bb-grid-size) * 2);
      font-weight: normal;
      text-transform: uppercase;
      color: var(--bb-accent-color);
    }

    footer {
      border-top: 1px solid rgba(0, 0, 0, 0.1);
      padding: 16px 36px;
      font-size: 0.75rem;
      text-transform: uppercase;
    }

    footer span {
      font-weight: bold;
    }

    @media (min-width: 600px) {
      h1 {
        padding: 32px calc(var(--bb-grid-size) * 2);
        font-size: 32px;
      }
    }

    @media (min-width: 900px) {
      h1 {
        padding: 40px calc(var(--bb-grid-size) * 2);
        font-size: 40px;
      }
    }

    .working,
    .error,
    .output {
      line-height: 1.5;
    }

    .working,
    .error {
      text-align: center;
    }

    .error {
      color: #cc0011;
    }

    .output-item {
      margin-bottom: 32px;
      font-size: var(--bb-text-medium);
    }

    .output-item h1 {
      padding: 0;
      margin: 0 0 8px;
      font-size: var(--bb-text-large);
    }

    .working {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding-bottom: 48px;
      position: relative;
    }

    .working::after {
      content: "";
      display: block;
      width: 12px;
      border-radius: 50%;
      background: var(--bb-accent-color);
      height: 12px;
      position: absolute;
      bottom: 23px;
      animation: sideToSide 0.6s cubic-bezier(0.75, 0, 0.25, 1) infinite
        alternate;
    }

    .working::before {
      content: "";
      display: block;
      width: 100px;
      border-radius: 32px;
      background: #fff;
      border: 1px solid rgb(209, 209, 209);
      height: 16px;
      position: absolute;
      bottom: 20px;
    }

    @keyframes sideToSide {
      0% {
        translate: calc(-50px + 6px + 2px) 0;
      }

      100% {
        translate: calc(50px - 6px - 2px) 0;
      }
    }
  `;

  constructor() {
    super();

    const currentUrl = new URL(window.location.href);
    const boardFromUrl = currentUrl.searchParams.get("board");
    const embedFromUrl = currentUrl.searchParams.get("embed") !== null;
    if (!boardFromUrl) {
      console.warn("No Board URL provided - exiting");
      return;
    }

    this.embed = embedFromUrl;

    this.#url = boardFromUrl;
    this.#config = createRunConfig(this.#url);
    // For non-debug cases, like the preview, ensure that the diagnostics are
    // switched off.
    this.#config.diagnostics = false;

    this.#runBoard();
  }

  #renderOutput(output: Record<string, unknown>) {
    const schema = output.schema as Schema;
    if (!schema || !schema.properties) {
      return html`<bb-json-tree
        .json=${output}
        .autoExpand=${true}
      ></bb-json-tree>`;
    }

    return html`${Object.entries(schema.properties).map(
      ([property, schema]) => {
        const value = output[property];
        let valueTmpl;
        if (schema.format === "stream") {
          let value = "";
          const streamedValue = clone(output[property] as StreamCapabilityType)
            .pipeTo(
              new WritableStream({
                write(chunk) {
                  // For now, presume that the chunk is an `OutputValues` object
                  // and the relevant item is keyed as `chunk`.
                  const outputs = chunk as ChunkOutputs;
                  value += outputs.chunk;
                },
              })
            )
            .then(() => html`${value}`);

          valueTmpl = html`${until(streamedValue, html`Loading...`)}`;
        } else {
          valueTmpl =
            typeof value === "object"
              ? html`<bb-json-tree
                  .json=${value}
                  .autoExpand=${true}
                ></bb-json-tree>`
              : html`${value}`;
        }

        return html`<section class="output-item">
          <h1 title="${schema.description || "Undescribed property"}">
            ${schema.title || "Untitled property"}
          </h1>
          <div>${valueTmpl}</div>
        </section>`;
      }
    )}`;
  }

  async #handleStateChange(
    result: HarnessRunResult
  ): Promise<void | InputValues> {
    switch (result.type) {
      case "secret": {
        // Set up a placeholder for the secrets.
        const secrets: HTMLTemplateResult[] = [];
        this.uiElement = html`${secrets}`;

        // By setting the uiElement above we have requested a render, but before
        // that we step through each secret and create inputs. We await each
        // input that we create here.
        const values = await Promise.all(
          result.data.keys.map((key) => {
            return new Promise<[string, string]>((secretResolve) => {
              const id = key;
              const configuration = {
                schema: {
                  properties: {
                    secret: {
                      title: id,
                      description: `Enter ${id}`,
                      type: "string",
                    },
                  },
                },
              };

              const secret = html`<bb-input
                id=${id}
                .secret=${true}
                .remember=${true}
                .configuration=${configuration}
                @breadboardinputenter=${(
                  event: BreadboardUI.Events.InputEnterEvent
                ) => {
                  secretResolve([key, event.data.secret as string]);
                }}
              ></bb-input>`;
              secrets.push(secret);
            });
          })
        );

        // Once all the secrets are resolved we can remove the UI element and
        // return the secrets.
        this.uiElement = nothing;

        return Object.fromEntries(values);
      }

      case "input":
        return new Promise((resolve) => {
          this.uiElement = html`<bb-input
            id="${result.data.node.id}"
            .configuration=${result.data.inputArguments}
            @breadboardinputenter=${(
              event: BreadboardUI.Events.InputEnterEvent
            ) => {
              this.uiElement = nothing;
              resolve(event.data as InputValues);
            }}
          ></bb-input>`;
        });

      case "error":
        this.uiElement = html`<div class="error">😩 ${result.data.error}</div>`;
        return Promise.resolve(void 0);

      case "output":
        this.uiElement = nothing;
        this.#hasOutputs = true;
        this.#outputs.unshift(this.#renderOutput(result.data.outputs));
        this.requestUpdate();
        return Promise.resolve(void 0);

      case "graphstart":
      case "graphend":
      case "nodeend":
      case "skip":
        return Promise.resolve(void 0);

      case "end":
        if (!this.#hasOutputs) {
          this.uiElement = html`<div class="output">All done!</div>`;
        }
        return Promise.resolve(void 0);

      case "nodestart":
        this.uiElement = html`<div class="working">Working...</div>`;
        return Promise.resolve(void 0);
    }
  }

  async #runBoard() {
    if (!this.#config || !this.#url) {
      return;
    }

    this.boardInfo = await getBoardInfo(this.#url);

    for await (const result of run(this.#config)) {
      const answer = await this.#handleStateChange(result);

      if (answer) {
        await result.reply({ inputs: answer });
      }
    }
  }

  render() {
    if (!this.#url) {
      return nothing;
    }

    return html`<main>
        <h1>${this.boardInfo?.title}</h1>
        ${this.uiElement} ${this.#outputs}
      </main>
      <footer>Made with Breadboard</footer>`;
  }
}
