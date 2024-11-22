/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {LitElement, css, html} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import {Signal} from 'signal-polyfill';
import {SignalArray} from 'signal-utils/array';
import {SignalSet} from 'signal-utils/set';
import {BreadboardServer} from '../breadboard/breadboard-server.js';
import {BreadboardToolProvider} from '../breadboard/breadboard-tool-provider.js';
import type {Config} from '../config.js';
import {BBRTConversation} from '../llm/conversation.js';
import type {BBRTModel} from '../llm/model.js';
import {BREADBOARD_SERVER} from '../secrets.js';
import {IndexedDBSettingsSecrets} from '../secrets/indexed-db-secrets.js';
import {ToolProvider} from '../tools/tool-provider.js';
import type {BBRTTool} from '../tools/tool.js';
import './chat.js';
import './model-selector.js';
import './prompt.js';
import './tool-palette.js';

@customElement('bbrt-main')
export class BBRTMain extends LitElement {
  @property({type: Object})
  config?: Config;

  #model = new Signal.State<BBRTModel>('openai');
  #activeTools = new SignalSet<BBRTTool>();
  #secrets = new IndexedDBSettingsSecrets();
  #conversation = new BBRTConversation(
    this.#model,
    this.#activeTools,
    this.#secrets,
  );

  #toolProviders = new SignalArray<ToolProvider>([
    // TODO(aomarks) Support having multiple breadboard servers active.
    new BreadboardToolProvider(
      new BreadboardServer(BREADBOARD_SERVER),
      this.#secrets,
    ),
  ]);

  static override styles = css`
    :host {
      width: 100vw;
      height: 100vh;
      display: grid;
      grid-template-columns: 2fr 1fr;
      grid-template-rows: 1fr auto;
    }
    bbrt-chat {
      grid-column: 1;
      grid-row: 1 / 2;
    }
    #bottom {
      padding: 24px;
      border-top: 1px solid #ccc;
      grid-column: 1;
      grid-row: 2;
    }
    #inputs {
      display: flex;
    }
    bbrt-prompt {
      flex-grow: 1;
    }
    #sidebar {
      grid-column: 2;
      grid-row: 1 / 3;
      border-left: 1px solid #ccc;
      overflow-y: auto;
    }
  `;

  override render() {
    return html`
      <bbrt-chat
        .conversation=${this.#conversation}
        .secrets=${this.#secrets}
      ></bbrt-chat>
      <div id="bottom">
        <div id="inputs">
          <bbrt-model-selector .model=${this.#model}></bbrt-model-selector>
          <bbrt-prompt .conversation=${this.#conversation}></bbrt-prompt>
        </div>
      </div>
      <div id="sidebar">
        <bbrt-tool-palette
          .toolProviders=${this.#toolProviders}
          .activeTools=${this.#activeTools}
        ></bbrt-tool-palette>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'bbrt-main': BBRTMain;
  }
}
