/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {SignalArray} from 'signal-utils/array';
import type {SecretsProvider} from '../secrets/secrets-provider.js';
import type {ToolProvider} from '../tools/tool-provider.js';
import type {BBRTTool} from '../tools/tool.js';
import type {BreadboardServer} from './breadboard-server.js';
import {BreadboardTool} from './breadboard-tool.js';

export class BreadboardToolProvider implements ToolProvider {
  readonly #server: BreadboardServer;
  readonly #tools = new SignalArray<BBRTTool>();
  readonly #secrets: SecretsProvider;
  #stale = true;

  constructor(server: BreadboardServer, secrets: SecretsProvider) {
    this.#server = server;
    this.#secrets = secrets;
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
      (board) => new BreadboardTool(board, this.#server, this.#secrets),
    );
    this.#tools.length = 0;
    this.#tools.push(...tools);
  }
}
