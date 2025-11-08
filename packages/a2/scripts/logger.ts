/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export { Logger };

class Logger {
  readonly messages: unknown[][] = [];

  constructor() {
    this.log = this.log.bind(this);
  }

  log(...args: unknown[]) {
    this.messages.push(args);
  }

  getAll() {
    return this.messages.map((entry) => JSON.stringify(entry)).join("\n");
  }
}
