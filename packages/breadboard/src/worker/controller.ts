/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { InputValues } from "../types.js";
import { type ControllerMessage, VALID_MESSAGE_TYPES } from "./protocol.js";

type ResolveFunction<T extends ControllerMessage = ControllerMessage> = (
  value: T
) => void;

type MessageHandler = (e: ControllerMessage) => void;

export interface MessageControllerTransport {
  setMessageHandler(messageHandler: MessageHandler): void;
  sendMessage<T extends ControllerMessage>(message: T): void;
}

export class WorkerTransport implements MessageControllerTransport {
  worker: Worker;
  #direction: string;
  #messageHandler?: MessageHandler;

  constructor(worker: Worker) {
    this.worker = worker;
    this.worker.addEventListener("message", this.#onMessage.bind(this));
    // TODO: Remove this later. This is only used to illustrate communication
    // for demos.
    this.#direction = globalThis.window ? "<-" : "->";
  }

  setMessageHandler(messageHandler: MessageHandler) {
    this.#messageHandler = messageHandler;
  }

  sendMessage<T extends ControllerMessage>(message: T) {
    this.worker.postMessage(message, message.data as InputValues);
  }

  #onMessage(e: MessageEvent) {
    const message = e.data as ControllerMessage;
    if (!message) {
      console.debug(`[${this.#direction}]`, "unknown message", e);
      return;
    }
    console.debug(`[${this.#direction}]`, message.type, message.data);
    this.#messageHandler && this.#messageHandler(message);
  }
}

export class MessageController {
  receivedMessages: ControllerMessage[] = [];
  #listener?: ResolveFunction;
  #transport: MessageControllerTransport;

  /**
   * This class establishes structured communication between
   * a worker and its host.
   * It is used both by the host and the worker.
   *
   * @param worker The worker to communicate with.
   */
  constructor(transport: MessageControllerTransport) {
    this.#transport = transport;
    transport.setMessageHandler(this.#onMessage.bind(this));
  }

  #onMessage(message: ControllerMessage) {
    if (!message.type || !VALID_MESSAGE_TYPES.includes(message.type)) {
      return;
    }
    if (this.#listener) {
      this.#listener(message);
    } else {
      this.receivedMessages.push(message);
    }
  }

  async listen(): Promise<ControllerMessage> {
    const message = this.receivedMessages.shift();
    if (message) return Promise.resolve(message);

    return new Promise((resolve) => {
      this.#listener = (message: ControllerMessage) => {
        resolve(message);
        this.#listener = undefined;
      };
    });
  }

  inform<T extends ControllerMessage>(data: T["data"], type: T["type"]) {
    this.#transport.sendMessage({ type, data });
  }
}
