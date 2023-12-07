/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ErrorMessage } from "./error.js";
import { Input, type InputArgs } from "./input.js";
import { Load, type LoadArgs } from "./load.js";
import { Output, type OutputArgs } from "./output.js";
import { Progress } from "./progress.js";
import { Result, ResultArgs } from "./result.js";
import { DelayEvent, StartEvent, type ToastType } from "./events.js";
import { Toast } from "./toast.js";
import { ResponseContainer } from "./response-container.js";
import { Done } from "./done.js";
import { Diagram } from "./diagram.js";
import {
  assertHTMLElement,
  assertRoot,
  assertSelectElement,
} from "./utils/assertions.js";

export interface UI {
  progress(message: string): void;
  output(values: OutputArgs): void;
  input(id: string, args: InputArgs): Promise<Record<string, unknown>>;
  error(message: string): void;
  done(): void;
}

export class UIController extends HTMLElement implements UI {
  #responseContainer = new ResponseContainer();
  #currentBoardDiagram = "";
  #diagram = new Diagram();

  constructor() {
    super();

    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        :host {
          display: flex;
          flex-direction: column;
          padding: calc(var(--bb-grid-size) * 4) calc(var(--bb-grid-size) * 8)
              calc(var(--bb-grid-size) * 8) calc(var(--bb-grid-size) * 8);
          box-sizing: border-box;
          overflow: hidden;
        }

        :host * {
          box-sizing: border-box;
        }

        #wrapper {
          border-radius: calc(var(--bb-grid-size) * 9);
          border: 2px solid #E3E7ED;
          width: 100%;
          height: 100%;
          display: grid;
          grid-template-columns: 65fr 35fr;
          overflow: hidden;
        }

        #diagram {
          background-color: rgb(244, 247, 252);
          background-image: var(--bb-grid-pattern);
          border-radius: calc(var(--bb-grid-size) * 9);
          overflow: hidden;
          outline: 2px solid #E3E7ED;
          display: none;
          position: relative;
        }

        #diagram.active {
          display: block;
        }

        :host(.paused) #diagram::after {
          height: calc(var(--bb-grid-size) * 8);
          line-height: calc(var(--bb-grid-size) * 8);
          text-align: center;
          background: rgb(255, 242, 204);
          border-bottom: 1px solid rgb(255, 195, 115);
          content: 'This board is paused';
          position: absolute;
          width: 100%;
          top: 0;
          left: 0;
          font-size: var(--bb-text-small);
        }

        #diagram-container {
          width: 100%;
          height: 100%;
          overflow: auto;
        }

        #intro {
          display: none;
          grid-column: 1/3;
          background: rgb(244, 247, 252);
          border-radius: calc(var(--bb-grid-size) * 9);
          padding: calc(var(--bb-grid-size) * 8);
        }

        #intro > #contents {
          max-width: 600px;
        }

        #intro p {
          line-height: 1.5;
        }

        #intro.active {
          display: block;
        }

        #sidebar {
          display: none;
        }

        #sidebar.active {
          display: grid;
          grid-template-rows: calc(var(--bb-grid-size) * 14) 2fr 3fr;
          height: 100%;
          overflow: hidden;
        }

        #controls {
          display: flex;
          flex-direction: row;
          align-items: center;
          justify-content: flex-end;
          border-bottom: 1px solid rgb(227, 231, 237);
          padding-right: calc(var(--bb-grid-size) * 6);
        }

        #history {
          background: red;
        }

        #output {
          display: flex;
          flex-direction: column;
          overflow: hidden;
          grid-row: 2/4;
          padding: calc(var(--bb-grid-size) * 5);
        }

        #output h1 {
          font-size: var(--bb-text-medium);
          margin: 0;
          font-weight: 400;
          padding: 0 0 calc(var(--bb-grid-size) * 5) calc(var(--bb-grid-size) * 8);
          background: var(--bb-icon-output) 0 0 no-repeat;
          line-height: calc(var(--bb-grid-size) * 6);
        }

        #output-list {
          overflow-y: scroll;
        }

        #output-list > * {
          padding: calc(var(--bb-grid-size) * 2);
        }

        #output-list:empty::before {
          content: 'No board outputs received yet';
          font-size: var(--bb-text-small);
        }

        #response-container > #intro > h1 {
          font-size: var(--bb-text-xx-large);
          margin: 0 0 calc(var(--bb-grid-size) * 6) 0;
          display: inline-block;
          background: linear-gradient(
            45deg,
            rgb(90, 64, 119), 
            rgb(144, 68, 228)
          );
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        #response-container > #intro > p {
          max-width: calc(var(--bb-grid-size) * 125);
          margin: 0 0 calc(var(--bb-grid-size) * 5) 0;
          line-height: 1.5;
        }

        #response-container a {
          color: var(--bb-font-color);
          font-weight: 700;
        }

        #new-here {
          font-size: var(--bb-text-small);
        }

        #url-input-container {
          margin-top: calc(var(--bb-grid-size) * 10);
          position: relative;
        }

        #url-input {
          border-radius: calc(var(--bb-grid-size) * 10);
          background: rgb(255, 255, 255);
          height: calc(var(--bb-grid-size) * 12);
          padding: 0 calc(var(--bb-grid-size) * 10) 0 calc(var(--bb-grid-size) * 4);
          width: 100%;
          border: 1px solid rgb(209, 209, 209);
        }

        #url-submit {
          font-size: 0;
          width: calc(var(--bb-grid-size) * 8);
          height: calc(var(--bb-grid-size) * 8);
          position: absolute;
          right: calc(var(--bb-grid-size) * 2);
          top: calc(var(--bb-grid-size) * 2);
          border-radius: 50%;
          background: #FFF var(--bb-icon-start) center center no-repeat;
          border: none;
        }

        #input {
          position: absolute;
          bottom: calc(var(--bb-grid-size) * 8);
          width: calc(100% - var(--bb-grid-size) * 16);
          border-radius: calc(var(--bb-grid-size) * 6);
          background: rgba(255, 255, 255, 0.7);
          padding: calc(var(--bb-grid-size) * 4);
          border: 1px solid rgb(204, 204, 204);
          box-shadow: 0 2px 3px 0 rgba(0,0,0,0.13),
            0 7px 9px 0 rgba(0,0,0,0.16);
          display: none;
          left: 50%;
          translate: -50% 0;
        }

        #input.active {
          display: block;
        }

        #delay {
          width: auto;
          max-width: calc(var(--bb-grid-size) * 50);
          padding: calc(var(--bb-grid-size) * 2) calc(var(--bb-grid-size) * 4);
          padding-left: 30px;
          border-radius: 30px;
          background: rgb(255, 255, 255) var(--bb-icon-delay) 5px 4px no-repeat;
          border: 1px solid rgb(200, 200, 200);
        }
      </style>
      <!-- Load info -->
      <div id="load-container">  
        <slot name="load"></slot>
      </div>

      <div id="wrapper">
        <!-- Intro -->
        <div id="intro">
          <div id="contents">
            <h1>Hello there!</h1>
            <p>This is the <strong>Breadboard Playground</strong> running in the browser. Here you can either try out one of the sample boards, or you can enter the URL for your own board below.</p>

            <p id="new-here">New here? Read more about the <a href="https://github.com/google/labs-prototypes/tree/main">Breadboard project on Github</a>.</p>

            <form>
              <div id="url-input-container">
                <input required id="url-input" type="url" name="url" placeholder="Enter a Board URL" />
                <input id="url-submit" type="submit" />
              </div>
            </form>
          </div>
        </div>

        <!-- Diagram -->
        <div id="diagram">
          <div id="diagram-container"></div>

          <!-- Inputs -->
          <div id="input">
            <slot></slot>
          </div>
        </div>

        <!-- Sidebar -->
        <div id="sidebar">
          <div id="controls">
            <select id="delay">
              <option>No delay</option>
              <option>250ms delay</option>
              <option>500ms delay</option>
              <option>1000ms delay</option>
              <option>1500ms delay</option>
            </select>
          </div>
          <!-- <div id="history">
             <h1>History</h1>
          </div> -->
          <div id="output">
            <h1>Output</h1>
            <div id="output-list">No outputs received</div>
          </div>
        </div>
      </div>
    `;

    this.appendChild(this.#responseContainer);

    const diagramContainer = root.querySelector("#diagram-container");
    const delay = root.querySelector("#delay");
    assertHTMLElement(diagramContainer);
    assertSelectElement(delay);

    diagramContainer.appendChild(this.#diagram);
    delay.addEventListener("change", () => {
      this.dispatchEvent(new DelayEvent(parseFloat(delay.value)));
    });
  }

  toast(message: string, type: ToastType) {
    const toast = new Toast(message, type);
    document.body.appendChild(toast);
  }

  showPaused() {
    this.classList.add("paused");
  }

  hidePaused() {
    this.classList.remove("paused");
  }

  #clearBoardContents() {
    this.#responseContainer.clearContents();

    const root = this.shadowRoot;
    if (!root) {
      throw new Error("Unable to locate shadow root in UI Controller");
    }

    const children = Array.from(this.children);
    for (const child of children) {
      if (child.tagName === "HEADER" || child === this.#responseContainer) {
        continue;
      }
      child.remove();
    }

    const outputs = Array.from(
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.shadowRoot!.querySelector("#output-list")?.childNodes || []
    );

    for (const child of outputs) {
      child.remove();
    }
  }

  showIntroContent() {
    const root = this.shadowRoot;
    if (!root) {
      throw new Error("Unable to locate shadow root in UI Controller");
    }

    root.querySelector("#intro")?.classList.add("active");

    const form = root.querySelector("form");
    form?.addEventListener("submit", (evt: Event) => {
      evt.preventDefault();
      const data = new FormData(form);
      const url = data.get("url");
      if (!url) {
        throw new Error("Unable to located url in form data");
      }

      this.dispatchEvent(new StartEvent(url.toString()));
    });
  }

  #hideIntroContent() {
    const root = this.shadowRoot;
    if (!root) {
      throw new Error("Unable to locate shadow root in UI Controller");
    }

    root.querySelector("#intro")?.classList.remove("active");
  }

  #showBoardContainer() {
    const root = this.shadowRoot;
    if (!root) {
      throw new Error("Unable to locate shadow root in UI Controller");
    }

    root.querySelector("#sidebar")?.classList.add("active");
    root.querySelector("#diagram")?.classList.add("active");
  }

  #showInputContainer() {
    const root = this.shadowRoot;
    assertRoot(root);

    root.querySelector("#input")?.classList.add("active");
  }

  #hideInputContainer() {
    const root = this.shadowRoot;
    assertRoot(root);

    root.querySelector("#input")?.classList.remove("active");
  }

  load(info: LoadArgs) {
    this.#currentBoardDiagram = info.diagram || "";

    this.#hideIntroContent();
    this.#clearBoardContents();
    this.#showBoardContainer();
    this.#hideInputContainer();

    const load = new Load(info);
    load.slot = "load";
    this.appendChild(load);
    this.#diagram.reset();
  }

  async renderDiagram(highlightNode = "") {
    if (!this.#currentBoardDiagram) {
      return;
    }

    return this.#diagram.render(this.#currentBoardDiagram, highlightNode);
  }

  progress(message: string) {
    this.#responseContainer.clearContents();
    this.#showInputContainer();

    const progress = new Progress(message);
    this.#responseContainer.appendChild(progress);
  }

  async output(values: OutputArgs) {
    this.#responseContainer.clearContents();
    this.#showInputContainer();

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const outputContainer = this.shadowRoot!.querySelector("#output-list");
    const output = new Output();
    outputContainer?.appendChild(output);

    await output.display(values);
  }

  async secret(id: string): Promise<string> {
    const input = new Input(
      id,
      {
        schema: {
          properties: {
            secret: {
              title: id,
              description: `Enter ${id}`,
              type: "string",
            },
          },
        },
      },
      { remember: true, secret: true }
    );
    this.#responseContainer.appendChild(input);
    const data = (await input.ask()) as Record<string, string>;
    input.remove();
    return data.secret;
  }

  result(value: ResultArgs) {
    const before = this.querySelector("bb-progress");
    const result = new Result(value);
    before
      ? before.before(result)
      : this.#responseContainer.appendChild(result);
  }

  async input(id: string, args: InputArgs): Promise<Record<string, unknown>> {
    this.#showInputContainer();
    this.#responseContainer.clearContents();
    const input = new Input(id, args);
    this.#responseContainer.appendChild(input);
    return (await input.ask()) as Record<string, unknown>;
  }

  error(message: string) {
    const error = new ErrorMessage(message);
    this.#showInputContainer();
    this.#responseContainer.clearContents();
    this.#responseContainer.appendChild(error);
  }

  done() {
    const done = new Done("Board finished.");
    this.#showInputContainer();
    this.#responseContainer.clearContents();
    this.#responseContainer.appendChild(done);
  }
}
