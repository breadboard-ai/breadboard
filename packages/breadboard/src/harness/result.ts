/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

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
