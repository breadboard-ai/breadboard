/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  NodeDescriptor,
  NodeValue,
  OutputValues,
} from "@google-labs/graph-runner";

const VALID_MESSAGE_TYPES = [
  "start",
  "input",
  "output",
  "beforehandler",
  "proxy",
  "end",
  "error",
] as const;

export type ControllerMessageType = (typeof VALID_MESSAGE_TYPES)[number];

export type RoundTrip = {
  /**
   * The id of the message.
   */
  id: string;
};

export type ControllerMessageish = {
  /**
   * The id of the message.
   */
  id?: string;
  /**
   * The type of the message.
   */
  type: ControllerMessageType;
  /**
   * The data payload of the message.
   */
  data: unknown;
};

/**
 * The message format used to communicate between the worker and its host.
 */
export type ControllerMessage<
  Type extends ControllerMessageType,
  Payload,
  HasId extends RoundTrip | unknown = unknown
> = HasId & {
  /**
   * The type of the message.
   */
  type: `${Type}`;
  data: Payload;
};

export type StartMesssage = ControllerMessage<
  "start",
  {
    url: string;
    proxyNodes: string[];
  }
>;

export type InputRequestMessage = ControllerMessage<
  "input",
  { node: NodeDescriptor; inputArguments: NodeValue },
  RoundTrip
>;

export type InputResponseMessage = ControllerMessage<
  "input",
  NodeValue,
  RoundTrip
>;

export type BeforehandlerMessage = ControllerMessage<
  "beforehandler",
  { node: NodeDescriptor }
>;

export type OutputMessage = ControllerMessage<
  "output",
  { node: NodeDescriptor; outputs: NodeValue }
>;

export type ProxyRequestMessage = ControllerMessage<
  "proxy",
  { node: NodeDescriptor; inputs: NodeValue },
  RoundTrip
>;

export type ProxyResponseMessage = ControllerMessage<
  "proxy",
  OutputValues,
  RoundTrip
>;

export type EndMessage = ControllerMessage<"end", unknown>;

export type ErrorMessage = ControllerMessage<"error", { error: string }>;

type ResolveFunction = (value: unknown) => void;

export class MessageController {
  mailboxes: Record<string, ResolveFunction> = {};
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
    const message = e.data as ControllerMessageish;
    if (!message.type || !VALID_MESSAGE_TYPES.includes(message.type)) {
      console.error("Invalid message type. Message:", message);
      throw new Error(`Invalid message type "${message.type}"`);
    }
    console.log(`[${this.#direction}]`, message.type, message.data);
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

  async ask<T extends ControllerMessageish>(data: T["data"], type: T["type"]) {
    const id = Math.random().toString(36).substring(2, 9);
    this.worker.postMessage({ id, type, data });
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

  inform<T extends ControllerMessageish>(data: T["data"], type: T["type"]) {
    this.worker.postMessage({ type, data });
  }

  reply<T extends ControllerMessageish>(
    id: string,
    data: T["data"],
    type: T["type"]
  ) {
    this.worker.postMessage({ id, type, data });
  }
}
