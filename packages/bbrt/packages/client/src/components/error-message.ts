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
    }
    :host::part(error) {
      background: #fff0ef;
      padding: 12px 16px;
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
    pre {
      white-space: pre-wrap;
      overflow-wrap: break-word;
    }
  `;

  override render() {
    return this.#renderError(this.error);
  }

  #renderError(error: unknown): unknown {
    if (error instanceof AggregateError && error.errors.length > 0) {
      return error.errors.map((subError) => this.#renderError(subError));
    } else if (error instanceof Error) {
      let message = error.message ?? '';
      let stack = error.stack ?? '';
      const prefixedMessage = `Error: ${message}`;
      if (stack.startsWith(`${prefixedMessage}\n`)) {
        // Often times the stack trace contains a full copy of the message, with
        // an Error: prefix. Remove the redundancy.
        stack = stack.slice(prefixedMessage.length /* for the \n */ + 1);
        message = prefixedMessage;
      }
      return html`
        <div part="error">
          <pre part="message">${message ?? 'Unknown error'}</pre>
          ${stack // prettier-ignore
            ? html`<pre part="stack">${stack}</pre>`
            : ''}
        </div>
      `;
    } else if (
      // An error-like object (anything with a truthy "message" property).
      typeof error === 'object' &&
      error !== null &&
      'message' in error &&
      error.message
    ) {
      // prettier-ignore
      return html`<pre part="error message">${error.message}</pre>`;
    } else if (
      // A nested error (anything with a truthy "error" property).
      typeof error === 'object' &&
      error !== null &&
      'error' in error &&
      error.error
    ) {
      return this.#renderError(error.error);
    } else if (typeof error === 'string') {
      // prettier-ignore
      return html`<pre part="error message">${error}</pre>`;
    } else {
      // prettier-ignore
      return html`<pre part="error message">${JSON.stringify(this.error, null, 2)}</pre>`;
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'bbrt-error-message': BBRTErrorMessage;
  }
}
