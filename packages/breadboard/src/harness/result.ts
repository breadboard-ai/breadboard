/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { OutputValues } from "../types.js";
import { MessageController } from "../worker/controller.js";
import { ControllerMessageType } from "../worker/protocol.js";
import { AnyRunResult, HarnessResult } from "./types.js";

export class LocalResult<R extends AnyRunResult> implements HarnessResult<R> {
  message: R;
  response?: unknown;

  constructor(message: R) {
    this.message = message;
  }

  reply(reply: unknown) {
    this.response = reply;
  }
}

export class WorkerResult<R extends AnyRunResult> implements HarnessResult<R> {
  #controller: MessageController;
  message: R;

  constructor(controller: MessageController, message: R) {
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
