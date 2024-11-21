/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {SignalArray} from 'signal-utils/array';
import type {ToolProvider} from '../tools/tool-provider.js';
import type {BBRTTool} from '../tools/tool.js';
import type {BreadboardServer} from './breadboard-server.js';
import {BreadboardTool} from './breadboard-tool.js';

export class BreadboardToolProvider implements ToolProvider {
  readonly #server: BreadboardServer;
  readonly #tools = new SignalArray<BBRTTool>();
  #stale = true;

  constructor(server: BreadboardServer) {
    this.#server = server;
  }

  get name() {
    return new URL(this.#server.url).host;
  }

  tools(): SignalArray<BBRTTool> {
    if (this.#stale) {
      this.#stale = false;
      void this.#update();
    }
    return this.#tools;
  }

  async #update(): Promise<void> {
    const boards = await this.#server.boards();
    const tools = boards.map(
      (board) => new BreadboardTool(board, this.#server),
    );
    this.#tools.length = 0;
    this.#tools.push(...tools);
  }
}
