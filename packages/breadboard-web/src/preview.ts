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
import { Board, type InputValues } from "@google-labs/breadboard";

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

  #config: ReturnType<typeof createRunConfig> | null = null;
  #url: string | null = null;

  static styles = css`
    :host {
      display: block;
    }
  `;

  constructor() {
    super();

    const currentUrl = new URL(window.location.href);
    const boardFromUrl = currentUrl.searchParams.get("board");
    if (!boardFromUrl) {
      console.warn("No Board URL provided - exiting");
      return;
    }

    this.#url = boardFromUrl;
    this.#config = createRunConfig(this.#url);
    // For non-debug cases, like the preview, ensure that the diagnostics are
    // switched off.
    this.#config.diagnostics = false;

    this.#runBoard();
  }

  async #handleStateChange(
    result: HarnessRunResult
  ): Promise<void | InputValues> {
    console.log(result);
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
        this.uiElement = html`${result.data.error}`;
        return Promise.resolve(void 0);

      case "output":
        this.uiElement = html`${result.data.outputs.text}`;
        return Promise.resolve(void 0);

      case "graphstart":
      case "graphend":
      case "nodeend":
      case "skip":
      case "end":
        return Promise.resolve(void 0);

      case "nodestart":
        this.uiElement = html`Working...`;
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

    return html`<h1>${this.boardInfo?.title}</h1>
      ${this.uiElement}`;
  }
}
