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

type MessageHandler = (e: ControllerMessage) => void;

export interface MessageControllerTransport {
  setMessageHandler(messageHandler: MessageHandler): void;
  sendMessage<T extends ControllerMessage>(message: T): void;
  sendRoundTripMessage<T extends RoundTripControllerMessage>(message: T): void;
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

  sendRoundTripMessage<T extends RoundTripControllerMessage>(message: T) {
    this.worker.postMessage(message);
  }

  sendMessage<T extends ControllerMessage>(message: T) {
    this.worker.postMessage(message);
  }

  #onMessage(e: MessageEvent) {
    const message = e.data as ControllerMessage;
    console.log(`[${this.#direction}]`, message.type, message.data);
    this.#messageHandler && this.#messageHandler(message);
  }
}

export class MessageController {
  mailboxes: Record<string, ResolveFunction<RoundTripControllerMessage>> = {};
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
      throw new Error(`Invalid message type "${message.type}"`);
    }
    if (message.id) {
      const roundTripMessage = message as RoundTripControllerMessage;
      const resolve = this.mailboxes[message.id];
      if (resolve) {
        // Since resolve exists, this is a response.
        resolve(roundTripMessage);
        return;
      }
    }
    if (this.#listener) {
      this.#listener(message);
    } else {
      this.receivedMessages.push(message);
    }
  }

  async ask<
    T extends RoundTripControllerMessage,
    Res extends RoundTripControllerMessage
  >(data: T["data"], type: T["type"]): Promise<Res> {
    const id = Math.random().toString(36).substring(2, 9);
    this.#transport.sendRoundTripMessage({ id, type, data });
    return new Promise((resolve) => {
      this.mailboxes[id] =
        resolve as ResolveFunction<RoundTripControllerMessage>;
    });
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

  reply<T extends ControllerMessage>(
    id: string,
    data: T["data"],
    type: T["type"]
  ) {
    this.#transport.sendRoundTripMessage({ id, type, data });
  }
}
