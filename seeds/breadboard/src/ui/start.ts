/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export type StartArgs = {
  boards: {
    title: string;
    url: string;
  }[];
};

export class Start extends HTMLElement {
  constructor({ boards }: StartArgs) {
    super();
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        :host {
          display: block;
        }
      
        select, button, input {
          font-family: var(--bb-font-family, Fira Code,monospace);
          font-size: var(--bb-font-size, 1rem);
        }
        
        select, button {
          padding: 0.2rem 0.4rem;
        }

        div {
          padding-bottom: 1rem;
        }

        input {
          width: var(--bb-input-width, 80%);
        }

      </style>
      <form>
        <div>
        <label for="sample">Select from one of the sample boards</label>
        <select name="sample" id="sample">
          <option value>- Select -</option>
          ${boards
            .map(({ title, url }) => {
              return `<option value="${url}">${title}</option>`;
            })
            .join("")}
        </select>
        </div>
        <div><label>Or enter your own board URL: 
          <input name="board" id="board">
        </label></div>
        <button type="submit" disabled>Run</button></div>
      </form>
    `;
  }

  disable() {
    const form = this.shadowRoot?.querySelector("form");
    const button = form?.querySelector("button");
    form?.sample.setAttribute("disabled", "");
    form?.board.setAttribute("disabled", "");
    button?.setAttribute("disabled", "");
  }

  enable() {
    const form = this.shadowRoot?.querySelector("form");
    const button = form?.querySelector("button");
    form?.sample.removeAttribute("disabled");
    form?.board.removeAttribute("disabled");
    button?.removeAttribute("disabled");
  }

  async selectBoard() {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const root = this.shadowRoot!;
    const form = root.querySelector("form");
    const button = form?.querySelector("button");

    return new Promise((resolve) => {
      form?.sample?.addEventListener("change", () => {
        const sample = form.sample.value;
        form.board.value = sample;
        if (sample) button?.removeAttribute("disabled");
      });
      form?.board?.addEventListener("input", () => {
        const board = form.board.value;
        if (board) button?.removeAttribute("disabled");
      });
      form?.addEventListener("submit", (e) => {
        e.preventDefault();
        const board = form.board.value;
        resolve(board);
      });
    });
  }
}
