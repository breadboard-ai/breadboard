/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {LitElement, css, html} from 'lit';
import {customElement, property} from 'lit/decorators.js';

@customElement('bbrt-error-message')
export class BBRTErrorMessage extends LitElement {
  @property({type: Object})
  error?: unknown;

  static override styles = css`
    :host {
      display: block;
      background: #fff0ef;
      padding: 12px 12px 24px 16px;
      border-radius: 8px;
    }
    :host::part(message) {
      color: #960023;
    }
    :host::part(stack) {
      color: #5c5c5c;
    }
    :first-child {
      margin-top: 0;
    }
    :last-child {
      margin-bottom: 0;
    }
  `;

  override render() {
    let message =
      (this.error as {message?: unknown}).message ?? `Unknown error`;
    let stack = (this.error as {stack?: unknown}).stack;
    if (
      typeof message === 'string' &&
      typeof stack === 'string' &&
      stack &&
      stack.startsWith(`Error: ${message}\n`)
    ) {
      // Often times the stack trace contains a full copy of the message, with
      // an Error: prefix. Remove the redundancy.
      stack = stack.slice(`Error: ${message}\n`.length);
      message = `Error: ${message}`;
    }
    return html`
      <pre part="message">${message}</pre>
      ${stack ? html`<pre part="stack">${stack}</pre>` : ''}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'bbrt-error-message': BBRTErrorMessage;
  }
}
