/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { OutputValues } from "../types.js";
import { MessageController } from "../worker/controller.js";
import { ControllerMessageType } from "../worker/protocol.js";
import { AnyResult, HarnessRunResult } from "./types.js";

export class LocalRunResult implements HarnessRunResult {
  message: AnyResult;
  response?: unknown;

  constructor(message: AnyResult) {
    this.message = message;
  }

  reply(reply: unknown) {
    this.response = reply;
  }
}

export class WorkerRunResult implements HarnessRunResult {
  #controller: MessageController;
  message: AnyResult;

  constructor(controller: MessageController, message: AnyResult) {
    this.#controller = controller;
    this.message = message;
  }

  reply(reply: unknown) {
    if (!this.message.id) return;
    const { id, type } = this.message;
    this.#controller.reply(
      id,
      reply as OutputValues,
      type as ControllerMessageType
    );
  }
}
