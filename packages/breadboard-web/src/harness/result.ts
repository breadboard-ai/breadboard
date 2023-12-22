/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { HarnessRunResult, Result } from "./types.js";

export class MainThreadRunResult<MessageType extends Result = Result>
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
