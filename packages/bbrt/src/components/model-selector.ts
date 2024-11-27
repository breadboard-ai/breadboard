/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {SignalWatcher} from '@lit-labs/signals';
import {LitElement, css, html, nothing} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import type {Signal} from 'signal-polyfill';
import type {BBRTModel} from '../llm/model.js';

@customElement('bbrt-model-selector')
export class BBRTModelSelector extends SignalWatcher(LitElement) {
  @property({attribute: false})
  model?: Signal.State<BBRTModel>;

  static override styles = css`
    :host {
      display: inline-flex;
      align-items: center;
      margin-right: 16px;
    }
    button {
      cursor: pointer;
      background: inherit;
      border: none;
      margin: 0;
      padding: 0;
    }
    img {
      width: 24px;
      max-height: 24px;
    }
  `;

  override render() {
    if (this.model === undefined) {
      return nothing;
    }
    const model = this.model.get();
    return html`
      <button
        @click=${this.#cycleModel}
        title="Using ${model}. Click to cycle models."
      >
        <img alt="Using model ${model}" src="/images/${model}-logomark.svg" />
      </button>
    `;
  }

  #cycleModel() {
    if (this.model === undefined) {
      return;
    }
    // TODO(aomarks) Make this more configurable.
    this.model.set(this.model.get() === 'openai' ? 'gemini' : 'openai');
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'bbrt-model-selector': BBRTModelSelector;
  }
}
