/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {LitElement, css, html} from 'lit';
import {customElement} from 'lit/decorators.js';

@customElement('bbrt-artifacts')
export class BBRTArtifacts extends LitElement {
  static override styles = css`
    :host {
      border-left: 1px solid #ccc;
    }
  `;
  override render() {
    return html``;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'bbrt-artifacts': BBRTArtifacts;
  }
}
