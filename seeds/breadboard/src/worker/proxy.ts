/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { NodeTypeIdentifier } from "@google-labs/graph-runner";
import { ProbeEvent } from "@google-labs/breadboard";

import type { ProxyRequestMessage, ProxyResponseMessage } from "./protocol.js";
import { MessageController } from "./controller.js";

export class NodeProxy extends EventTarget {
  controller: MessageController;
  proxies: NodeTypeIdentifier[] = [];

  constructor(controller: MessageController, proxies: NodeTypeIdentifier[]) {
    super();
    this.controller = controller;
    this.addEventListener("beforehandler", this.#onBeforeHandler.bind(this));
    this.invokeProxy = this.invokeProxy.bind(this);
    this.proxies = proxies;
  }

  #onBeforeHandler(event: Event) {
    const e = event as ProbeEvent;
    if (!this.proxies.includes(e.detail.descriptor.type)) return;
    e.preventDefault();
    e.detail.outputs = this.invokeProxy(e);
  }

  async invokeProxy(event: ProbeEvent) {
    const e = event as ProbeEvent;
    const { descriptor, inputs } = e.detail;
    const message = { type: "proxy", node: descriptor, inputs };
    const result = (await this.controller.ask<
      ProxyRequestMessage,
      ProxyResponseMessage
    >(message, "proxy")) as ProxyResponseMessage;
    return result.data;
  }
}
