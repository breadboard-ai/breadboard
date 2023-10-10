/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  type ControllerMessage,
  type RoundTripControllerMessage,
  VALID_MESSAGE_TYPES,
} from "./protocol.js";

type ResolveFunction<T extends ControllerMessage = ControllerMessage> = (
  value: T
) => void;

export class MessageController {
  mailboxes: Record<string, ResolveFunction<RoundTripControllerMessage>> = {};
  #listener?: ResolveFunction;
  worker: Worker;
  #direction: string;

  /**
   * This class establishes structured communication between
   * a worker and its host.
   * It is used both by the host and the worker.
   *
   * @param worker The worker to communicate with.
   */
  constructor(worker: Worker) {
    this.worker = worker;
    this.worker.addEventListener("message", this.#onMessage.bind(this));

    // TODO: Remove this later. This is only used to illustrate communication
    // for demos.
    this.#direction = globalThis.window ? "<-" : "->";
  }

  #onMessage(e: MessageEvent) {
    const message = e.data as ControllerMessage;
    if (!message.type || !VALID_MESSAGE_TYPES.includes(message.type)) {
      console.error("Invalid message type. Message:", message);
      throw new Error(`Invalid message type "${message.type}"`);
    }
    console.log(`[${this.#direction}]`, message.type, message.data);
    if (message.id) {
      const roundTripMessage = message as RoundTripControllerMessage;
      const resolve = this.mailboxes[message.id];
      if (resolve) {
        // Since resolve exists, this is a response.
        resolve(roundTripMessage);
        return;
      }
    }
    this.#listener && this.#listener(message);
  }

  async ask<
    T extends RoundTripControllerMessage,
    Res extends RoundTripControllerMessage
  >(data: T["data"], type: T["type"]): Promise<Res> {
    const id = Math.random().toString(36).substring(2, 9);
    this.worker.postMessage({ id, type, data });
    return new Promise((resolve) => {
      this.mailboxes[id] =
        resolve as ResolveFunction<RoundTripControllerMessage>;
    });
  }

  async listen(): Promise<ControllerMessage> {
    return new Promise((resolve) => {
      this.#listener = (message: ControllerMessage) => {
        resolve(message);
        this.#listener = undefined;
      };
    });
  }

  inform<T extends ControllerMessage>(data: T["data"], type: T["type"]) {
    this.worker.postMessage({ type, data });
  }

  reply<T extends ControllerMessage>(
    id: string,
    data: T["data"],
    type: T["type"]
  ) {
    this.worker.postMessage({ id, type, data });
  }
}
