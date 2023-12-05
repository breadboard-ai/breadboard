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
import { Start, type StartArgs } from "./start.js";
import { StartEvent, type ToastType } from "./events.js";
import { Toast } from "./toast.js";
import { ResponseContainer } from "./response-container.js";
import { Done } from "./done.js";

const MERMAID_URL = "https://cdn.jsdelivr.net/npm/mermaid@10.6.1/+esm";
const MERMAID_STYLES = `.node.active > * {
  stroke-width: 4px;
  stroke: #666 !important;
}

.node.default > * {
  stroke: #ffab40;
  fill: #fff2ccff;
  color: #000;
}

.node.secrets > * {
  stroke: #db4437;
  fill: #f4cccc;
}

.node.input > * {
  stroke: #3c78d8;
  fill: #c9daf8ff;
}

.node.output > * {
  stroke: #38761d;
  fill: #b6d7a8ff;
}

.node.passthrough {
  stroke: #a64d79;
  fill: #ead1dcff;
}

.node.slot {
  stroke: #a64d79;
  fill: #ead1dcff;
}

.node.slotted {
  stroke: #a64d79;
}
`;

export interface UI {
  progress(message: string): void;
  output(values: OutputArgs): void;
  input(id: string, args: InputArgs): Promise<Record<string, unknown>>;
  error(message: string): void;
  done(): void;
}

const getBoardFromUrl = () => {
  return new URL(window.location.href).searchParams.get("board");
};

export class UIController extends HTMLElement implements UI {
  #start!: Start;
  #responseContainer = new ResponseContainer();
  #currentBoardDiagram = "";

  constructor() {
    super();

    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        :host {
          --grid-size: var(--bb-grid-size, 4px);

          display: grid;
          width: 100%;
          margin-bottom: calc(var(--grid-size) * 30);
        }

        :host * {
          box-sizing: border-box;
        }

        #intro {
          display: none;
        }

        #intro.active {
          display: block;
        }

        header {
          width: 100%;
          display: flex;
          min-height: calc(var(--bb-grid-size) * 20);
          align-items: center;
          padding: 0 calc(var(--grid-size) * 4);
        }

        #header-container {
          flex: 1;
        }

        #response-container {
          background: rgb(244, 247, 252);
          border: 2px solid rgb(244, 247, 252);
          padding: calc(var(--grid-size) * 4);
          display: flex;
          flex-direction: column;
        }

        @media(min-width: 640px) {
          :host {
            padding: 0 calc(var(--grid-size) * 6) 0 calc(var(--grid-size) * 6);
          }

          header {
            padding: 0;
          }

          #response-container-wrapper {
            overflow: hidden;
            border-radius: calc(var(--grid-size) * 8);
          }

          #response-container {
            padding: calc(var(--grid-size) * 6);
            margin-top: 0;
            overflow-y: scroll;
            overflow-y: overflow;
            scrollbar-gutter: stable;
          }
        }

        #response-container > #intro > h1 {
          font-size: var(--bb-text-xx-large);
          margin: 0 0 calc(var(--grid-size) * 6) 0;
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
          max-width: calc(var(--grid-size) * 125);
          margin: 0 0 calc(var(--grid-size) * 5) 0;
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
          margin-top: calc(var(--grid-size) * 10);
          position: relative;
        }

        #url-input {
          border-radius: calc(var(--grid-size) * 10);
          background: rgb(255, 255, 255);
          height: calc(var(--grid-size) * 12);
          padding: 0 calc(var(--grid-size) * 10) 0 calc(var(--grid-size) * 4);
          width: 100%;
          border: 1px solid rgb(209, 209, 209);
        }

        #url-submit {
          font-size: 0;
          width: calc(var(--grid-size) * 8);
          height: calc(var(--grid-size) * 8);
          position: absolute;
          right: calc(var(--grid-size) * 2);
          top: calc(var(--grid-size) * 2);
          border-radius: 50%;
          background: #FFF var(--bb-icon-start) center center no-repeat;
          border: none;
        }

        #board-content {
          border-radius: calc(var(--grid-size) * 8);
          padding: calc(var(--grid-size) * 8);
          background: rgb(255, 255, 255);
          opacity: 0;
          position: relative;
          flex: 1;
        }

        #board-content.active {
          opacity: 1;
        }

        #diagram,
        #diagram svg {
          max-height: 60vh;
        }

        #mermaid {
          display: flex;
        }

        #input {
          position: absolute;
          bottom: calc(var(--bb-grid-size) * 8);
          width: calc(100% - var(--bb-grid-size) * 16);
          border-radius: calc(var(--bb-grid-size) * 6);
          background: rgb(255, 255, 255);
          padding: calc(var(--bb-grid-size) * 4);
          border: 1px solid rgb(204, 204, 204);
          box-shadow: 0 2px 3px 0 rgba(0,0,0,0.13),
            0 7px 9px 0 rgba(0,0,0,0.16);
          display: none;
        }

        #input.active {
          display: block;
        }

        #temp-output {
          position: fixed;
          bottom: 100px;
          right: 32px;
          padding: 20px;
          background: rgba(255, 255, 255, 0.8);
          border-radius: 20px;
          box-shadow: 0 2px 3px 0 rgba(0,0,0,0.13),
            0 7px 9px 0 rgba(0,0,0,0.16);
          width: 50vw;
          max-height: 80vh;
          overflow-y: scroll;
        }

        #temp-output.collapsed {
          width: 30px;
          height: 30px;
          overflow: hidden;
        }

        #temp-output > * {
          margin-bottom: 20px;
        }

        @media(min-width: 740px) {
          :host {
            padding: 0 calc(var(--bb-grid-size) * 8);
            margin: 0;
          }

          #response-container {
            padding: calc(var(--grid-size) * 8);
            height: 85vh;
          }
        }
      </style>
      <header>
        <div id="header-container">
          <slot name="header"></slot>
        </div>
        <div id="start-container">
          <slot name="start"></slot>
        </div>
      </header>
      <div id="response-container-wrapper">
        <div id="response-container">
          <div id="intro">
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
          
          <slot name="load"></slot>
          
          <div id="board-content">
            <div id="diagram">
              <div id="mermaid"></div>
            </div>

            <div id="input">
              <slot></slot>
            </div>
          </div>
        </div>
      </div>

      <!-- Just here to collect outputs for now -->
      <div id="temp-output"></div>
    `;

    this.appendChild(this.#responseContainer);

    if (!root) {
      throw new Error("Unable to locate shadow root in UI Controller");
    }

    root.querySelector("#temp-output")?.addEventListener("click", (evt) => {
      (evt.target as HTMLElement).classList.toggle("collapsed");
    });
  }

  setActiveBreadboard(url: string) {
    if (!this.#start) {
      return;
    }

    const pageUrl = new URL(window.location.href);
    pageUrl.searchParams.set("board", url);
    window.history.replaceState(null, "", pageUrl);

    this.#start.setAttribute("url", url);
  }

  async start(args: StartArgs) {
    this.#start = new Start(args);
    this.#start.slot = "start";
    this.append(this.#start);

    const boardFromUrl = getBoardFromUrl();
    if (boardFromUrl) {
      this.dispatchEvent(new StartEvent(boardFromUrl));
    } else {
      this.#showIntroContent();
    }
  }

  toast(message: string, type: ToastType) {
    const toast = new Toast(message, type);
    document.body.appendChild(toast);
  }

  #clearBoardContents() {
    this.#responseContainer.clearContents();

    const root = this.shadowRoot;
    if (!root) {
      throw new Error("Unable to locate shadow root in UI Controller");
    }

    const children = Array.from(this.children);
    for (const child of children) {
      if (
        child.tagName === "HEADER" ||
        child === this.#start ||
        child === this.#responseContainer
      ) {
        continue;
      }
      child.remove();
    }

    const tempChildren = Array.from(
      this.shadowRoot!.querySelector("#temp-output")?.childNodes || []
    );
    for (const child of tempChildren) {
      child.remove();
    }
  }

  #showIntroContent() {
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

    root.querySelector("#board-content")?.classList.add("active");
  }

  #showInputContainer() {
    const root = this.shadowRoot;
    if (!root) {
      throw new Error("Unable to locate shadow root in UI Controller");
    }

    root.querySelector("#input")?.classList.add("active");
  }

  load(info: LoadArgs) {
    this.#currentBoardDiagram = info.diagram || "";

    this.#hideIntroContent();
    this.#clearBoardContents();
    this.#showBoardContainer();
    const load = new Load(info);
    load.slot = "load";
    this.appendChild(load);
  }

  async renderDiagram(highlightNode = "") {
    if (!this.#currentBoardDiagram) {
      return;
    }

    highlightNode = highlightNode.replace(/-/g, "");
    let diagram = this.#currentBoardDiagram;
    if (highlightNode) {
      diagram += `\nclass ${highlightNode} active`;
    }

    const module = await import(MERMAID_URL);
    const mermaid = module.default;
    mermaid.initialize({ startOnLoad: false, themeCSS: MERMAID_STYLES });
    const { svg } = await mermaid.render("graphDiv", diagram);
    const root = this.shadowRoot;
    if (!root) {
      throw new Error("Unable to find shadow root");
    }

    const mermaidElement = root.querySelector("#mermaid");
    if (!mermaidElement) {
      return;
    }
    mermaidElement.innerHTML = svg;
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

    const tempOutput = this.shadowRoot!.querySelector("#temp-output");

    const output = new Output();
    tempOutput?.appendChild(output);
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
