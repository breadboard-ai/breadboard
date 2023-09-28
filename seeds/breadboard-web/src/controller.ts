/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

type ControllerMessage = {
  id?: string;
  data: unknown;
};

type ResolveFunction = (value: unknown) => void;

export class MessageController {
  mailboxes: Record<string, ResolveFunction> = {};
  #listener?: ResolveFunction;
  worker: Worker;
  #direction: string;

  constructor(worker: Worker) {
    this.worker = worker;
    this.worker.addEventListener("message", this.#onMessage.bind(this));
    this.#direction = globalThis.window ? "<-" : "->";
  }

  #onMessage(e: MessageEvent) {
    const message = e.data as ControllerMessage;
    const { type = "input", ...rest } = message.data as { type: string };
    console.log(`[${this.#direction}]`, type, rest);
    if (message.id) {
      const resolve = this.mailboxes[message.id];
      if (resolve) {
        // Since resolve exists, this is a response.
        resolve(message);
        return;
      }
    }
    this.#listener && this.#listener(message);
  }

  async ask(data: unknown) {
    const id = Math.random().toString(36).substring(2, 9);
    this.worker.postMessage({ id, data });
    return new Promise((resolve) => {
      this.mailboxes[id] = resolve;
    });
  }

  async listen() {
    return new Promise((resolve) => {
      this.#listener = (message: unknown) => {
        resolve(message);
        this.#listener = undefined;
      };
    });
  }

  inform(data: unknown) {
    this.worker.postMessage({ data });
  }

  reply(id: string, data: unknown) {
    this.worker.postMessage({ id, data });
  }
}
