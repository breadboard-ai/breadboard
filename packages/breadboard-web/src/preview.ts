/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { HarnessRunResult, run } from "@google-labs/breadboard/harness";
import { createRunConfig } from "./config";
import { customElement, property, state } from "lit/decorators.js";
import { HTMLTemplateResult, LitElement, css, html, nothing } from "lit";
import * as BreadboardUI from "@google-labs/breadboard-ui";
import {
  Board,
  Schema,
  type InputValues,
  clone,
  StreamCapabilityType,
  OutputValues,
  NodeStartResponse,
} from "@google-labs/breadboard";
import { until } from "lit/directives/until.js";
import { classMap } from "lit/directives/class-map.js";
import { Ref, createRef, ref } from "lit-html/directives/ref.js";

type ChunkOutputs = OutputValues & { chunk: string };

export const getBoardInfo = async (url: string) => {
  const runner = await Board.load(url, { base: new URL(window.location.href) });
  const { title, description, version } = runner;
  return { title, description, version };
};

// TODO: Remove once all elements are Lit-based.
BreadboardUI.register();

@customElement("bb-preview")
export class Preview extends LitElement {
  @property({ reflect: true })
  embed = false;

  @state()
  uiElement: HTMLTemplateResult | symbol = nothing;

  @state()
  showContinueButton = false;

  @state()
  boardInfo: Awaited<ReturnType<typeof getBoardInfo>> | null = null;

  #config: ReturnType<typeof createRunConfig> | null = null;
  #url: string | null = null;
  #hasOutputs = false;
  #outputs: HTMLTemplateResult[] = [];
  #nodesVisited: Array<{ data: NodeStartResponse }> = [];
  #inputRef: Ref<BreadboardUI.Elements.Input> = createRef();

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
      flex: 1 0 auto;
      display: flex;
      flex-direction: column;
    }

    #continue {
      border-radius: 32px;
      background: var(--bb-accent-color);
      border: none;
      padding: calc(var(--bb-grid-size) * 2) calc(var(--bb-grid-size) * 4);
      margin: 0 calc(var(--bb-grid-size) * 3) calc(var(--bb-grid-size) * 3) 0;
      position: relative;
      font-size: var(--bb-text-medium);
      color: #fff;
      align-self: flex-end;
    }

    h1 {
      font-size: 24px;
      margin: 0;
      padding: 42px calc(var(--bb-grid-size) * 2) 24px;
      font-weight: normal;
      text-align: center;
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

    .ui {
      padding: 0 32px;
      max-width: 960px;
      margin: 0 auto;
      width: 100%;
      display: flex;
      flex-direction: column;
    }

    .outputs {
      padding: 32px;
      flex: 1 0 auto;
      padding-bottom: 100px;
      overflow-y: scroll;
      mask-image: linear-gradient(
        rgba(0, 0, 0, 0),
        rgba(0, 0, 0, 1) 32px,
        rgba(0, 0, 0, 1) calc(100% - 32px),
        rgba(0, 0, 0, 0)
      );
      /* Set so we get the overflow scroll behavior */
      height: 0px;
    }

    .output-item {
      line-height: 1.5;
      font-size: var(--bb-text-medium);
      max-width: 960px;
      margin: 0 auto;
      margin-bottom: 32px;
      width: 100%;
    }

    .output-item h1 {
      padding: 0;
      margin: 0 0 8px;
      font-size: var(--bb-text-large);
      text-align: left;
    }

    .working {
      display: flex;
      flex-direction: column;
      align-items: center;
      margin: 0 auto;
      margin-bottom: 60px;
      position: relative;
      width: 60%;
      box-sizing: border-box;
      padding: 0 32px;

      --size: 16px;
    }

    .working h1 {
      font-size: var(--bb-text-default);
      margin: 0;
      padding: 0 0 16px 0;
    }

    .working .container {
      height: 80px;
      width: 100%;
      background: #fff;
      border-radius: 50px;
      box-shadow: 0 30px 32px rgba(0, 0, 0, 0.1), 0 10px 12px rgba(0, 0, 0, 0.1),
        0 2px 2px rgba(0, 0, 0, 0.1);
    }

    .working ol {
      list-style: none;
      padding: 0;
      margin: 20px 40px;
      overflow: hidden;
      font-size: var(--bb-text-pico);
      white-space: nowrap;
      display: flex;
      justify-content: flex-end;
      mask-image: linear-gradient(
        to right,
        rgba(0, 0, 0, 0),
        rgb(0, 0, 0) 40px
      );
    }

    .working ol li {
      display: inline-block;
      flex: 0 0 auto;
      position: relative;
      width: 20%;
      height: 42px;
      color: rgb(119, 119, 119);
      overflow-x: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      padding-top: 25px;
    }

    .working ol li:before {
      content: "";
      position: absolute;
      top: calc((var(--size) - 4px) * 0.5);
      left: 0;
      height: 4px;
      background: rgb(218, 218, 218);
      width: 100%;
    }

    .working ol li:last-of-type::before {
      width: 50%;
    }

    .working ol li:first-child:before {
      width: 50%;
      left: 50%;
    }

    .working ol li:only-child:before {
      display: none;
    }

    .working ol li:after {
      box-sizing: border-box;
      font-size: var(--bb-text-small);
      font-weight: bold;
      content: "";
      width: var(--size);
      height: var(--size);
      display: block;
      border-radius: 50%;
      position: absolute;
      left: 50%;
      top: 0;
      translate: -50% 0;
      border: 1px solid hsl(33.6, 100%, 52.5%);
      background: hsl(44.7, 100%, 80%);
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
    }

    .working ol li.error::after {
      background: #cc0000;
      border: 1px solid #cc0000;
    }

    .working ol li.result::after {
      background: #ffa500;
      border: 1px solid #ffa500;
    }

    .working ol li.input::after {
      background: #c9daf8ff;
      border: 1px solid #3c78d8;
    }

    .working ol li.secrets::after {
      background: #f4cccc;
      border: 1px solid #db4437;
    }

    .working ol li.output::after {
      background: #b6d7a8ff;
      border: 1px solid #38761d;
    }

    .working ol li.load::after,
    .working ol li.end::after {
      background: var(--bb-done-color);
      border: 1px solid var(--bb-done-color);
    }

    .working ol li:last-of-type::after {
      background: radial-gradient(
          var(--bb-progress-color) 0%,
          var(--bb-progress-color) 30%,
          var(--bb-progress-color-faded) 30%,
          var(--bb-progress-color-faded) 50%,
          transparent 50%,
          transparent 100%
        ),
        conic-gradient(transparent 0deg, var(--bb-progress-color) 360deg),
        linear-gradient(
          var(--bb-progress-color-faded),
          var(--bb-progress-color-faded)
        );

      box-shadow: none;
      border: none;
      animation: rotate 0.5s linear infinite;
    }

    @keyframes rotate {
      from {
        transform: rotate(0);
      }

      to {
        transform: rotate(360deg);
      }
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
      }

      to {
        opacity: 1;
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
    this.#nodesVisited.length = 0;

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
    this.showContinueButton = false;
    switch (result.type) {
      case "secret": {
        this.showContinueButton = true;

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
                ${ref(this.#inputRef)}
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
        this.showContinueButton = true;

        return new Promise((resolve) => {
          this.uiElement = html`<bb-input
            id="${result.data.node.id}"
            ${ref(this.#inputRef)}
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
        } else {
          this.uiElement = nothing;
        }
        return Promise.resolve(void 0);

      case "nodestart":
        this.#nodesVisited.push(result);
        this.uiElement = html`<div class="working">
          <h1>Working...</h1>
          <div class="container">
            <ol>
              ${this.#nodesVisited.map((node) => {
                return html`<li
                  class="${classMap({ [node.data.node.type]: true })}"
                >
                  ${node.data.node.id}
                </li>`;
              })}
            </ol>
          </div>
        </div> `;
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
      this.showContinueButton = false;

      if (answer) {
        await result.reply({ inputs: answer });
      }
    }
  }

  #continue() {
    if (!this.#inputRef.value) {
      return;
    }

    this.#inputRef.value.processInput();
  }

  render() {
    if (!this.#url) {
      return nothing;
    }

    const continueButton = this.showContinueButton
      ? html`<button @click=${this.#continue} id="continue">Continue</button>`
      : nothing;

    return html`<main>
        <h1>${this.boardInfo?.title}</h1>
        <section class="ui">${this.uiElement} ${continueButton}</section>
        <section class="outputs">${this.#outputs}</section>
      </main>
      <footer>Made with Breadboard</footer>`;
  }
}
