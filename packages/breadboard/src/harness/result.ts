/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { MessageController } from "../worker/controller.js";
import { ControllerMessage } from "../worker/protocol.js";
import { HarnessRunResult, Result } from "./types.js";

export class LocalRunResult<MessageType extends Result = Result>
  implements HarnessRunResult
{
  message: MessageType;
  response?: unknown;

  constructor(message: MessageType) {
    this.message = message;
  }

  reply(reply: unknown) {
    this.response = reply;
  }
}

export class WorkerRunResult implements HarnessRunResult {
  controller: MessageController;
  message: ControllerMessage;

  constructor(controller: MessageController, message: ControllerMessage) {
    this.controller = controller;
    this.message = message;
  }

  reply<T extends ControllerMessage>(reply: unknown) {
    if (!this.message.id) return;
    const { id, type } = this.message;
    this.controller.reply<T>(id, reply as Record<string, unknown>, type);
  }
}
