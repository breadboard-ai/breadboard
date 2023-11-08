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
import { Diagram } from "./diagram.js";

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
  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        :host {
          display: block;
        }
        ::slotted(*) {
          padding-bottom: var(--bb-item-spacing, 0.4rem);
        }
      </style>
      <slot></slot>
    `;
  }

  async start(args: StartArgs) {
    const boardFromUrl = getBoardFromUrl();
    if (boardFromUrl) return boardFromUrl;

    const start = new Start(args);
    this.append(start);
    const board = await start.selectBoard();
    start.disable();
    return board;
  }

  load(info: LoadArgs) {
    this.append(new Load(info));
    this.append(new Diagram(info));
  }

  progress(message: string) {
    this.removeProgress();
    this.append(new Progress(message));
  }

  output(values: OutputArgs) {
    this.removeProgress();
    this.append(new Output(values));
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
    this.append(input);
    const data = (await input.ask()) as Record<string, string>;
    input.remove();
    return data.secret;
  }

  result(value: ResultArgs) {
    const before = this.querySelector("bb-progress");
    const result = new Result(value);
    before ? before.before(result) : this.append(result);
  }

  async input(id: string, args: InputArgs): Promise<Record<string, unknown>> {
    this.removeProgress();
    const input = new Input(id, args);
    this.append(input);
    return (await input.ask()) as Record<string, unknown>;
  }

  error(message: string) {
    this.removeProgress();
    this.append(new ErrorMessage(message));
  }

  done() {
    this.progress("Done. Reload this page to restart.");
  }

  removeProgress() {
    this.querySelector("bb-progress")?.remove();
  }
}
