/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { customElement, property } from "lit/decorators.js";
import { LitElement, css, html, nothing } from "lit";

import { asRuntimeKit } from "@google-labs/breadboard";

export { PreviewRun } from "./preview-run.js";

import Core from "@google-labs/core-kit";
import JSONKit from "@google-labs/json-kit";
import TemplateKit from "@google-labs/template-kit";
import PaLMKit from "@google-labs/palm-kit";
import GeminiKit from "@google-labs/gemini-kit";
import AgentKit from "@google-labs/agent-kit";
import PythonWasmKit from "@breadboard-ai/python-wasm";

const kits = [
  TemplateKit,
  Core,
  PaLMKit,
  GeminiKit,
  JSONKit,
  AgentKit,
  PythonWasmKit,
].map((kitConstructor) => asRuntimeKit(kitConstructor));

@customElement("bb-embed")
export class Embed extends LitElement {
  @property()
  url: string = "";

  static styles = css`
    :host {
      display: block;
      margin: 0;
      padding: 0;
      height: 100%;
      width: 100%;

      --bb-grid-size: 4px;
      --bb-font-family-header: "FiraCode";
      --bb-font-family-mono: "FiraCode", "Courier New", Courier, monospace;
      --bb-font-family: "FiraCode", "Helvetica Neue", Helvetica, Arial,
        sans-serif;
      --bb-font-color: rgb(23, 23, 23);
      --bb-font-color-faded: rgb(59, 59, 59);
      --bb-main-bg: rgb(244, 247, 252);
      --bb-highlight-color: rgb(211, 170, 255);
      --bb-result-color: rgb(103, 179, 252);
      --bb-progress-color: rgb(85, 144, 202);
      --bb-progress-color-faded: rgb(207, 231, 255);
      --bb-warning-color: rgb(251, 137, 3);
      --bb-error-color: rgb(251, 3, 3);
      --bb-output-color: rgb(51, 235, 168);
      --bb-done-color: rgb(3, 190, 122);
      --bb-text-baseline: calc(var(--bb-grid-size) * 4);
      --bb-text-xx-large: 3rem;
      --bb-text-x-large: 2rem;
      --bb-text-large: 1.5rem;
      --bb-text-default: 1rem;
      --bb-text-medium: 0.875rem;
      --bb-text-small: 0.75rem;
      --bb-text-nano: 0.7rem;
      --bb-text-pico: 0.65rem;
      --bb-easing: cubic-bezier(0, 0, 0.3, 1);
      --bb-easing-duration-in: 0.15s;
      --bb-easing-duration-out: 0.3s;
      --bb-icon-add-note: url(/third_party/icons/add-note.svg);
      --bb-icon-add-image: url(/third_party/icons/add-image.svg);
      --bb-icon-arrow: url(/third_party/icons/arrow.svg);
      --bb-icon-arrow-back-white: url(/third_party/icons/arrow-back-white.svg);
      --bb-icon-before: url(/third_party/icons/before.svg);
      --bb-icon-board: url(/third_party/icons/board.svg);
      --bb-icon-close: url(/third_party/icons/close.svg);
      --bb-icon-collapse: url(/third_party/icons/collapse.svg);
      --bb-icon-copy-to-clipboard: url(/third_party/icons/copy-to-clipboard.svg);
      --bb-icon-delay: url(/third_party/icons/delay.svg);
      --bb-icon-delete: url(/third_party/icons/delete.svg);
      --bb-icon-download: url(/third_party/icons/download.svg);
      --bb-icon-error: url(/third_party/icons/error.svg);
      --bb-icon-expand: url(/third_party/icons/expand.svg);
      --bb-icon-fit: url(/third_party/icons/fit.svg);
      --bb-icon-frame-reload: url(/third_party/icons/frame-reload.svg);
      --bb-icon-history: url(/third_party/icons/history.svg);
      --bb-icon-info: url(/third_party/icons/info.svg);
      --bb-icon-input: url(/third_party/icons/input.svg);
      --bb-icon-next: url(/third_party/icons/next.svg);
      --bb-icon-output: url(/third_party/icons/output.svg);
      --bb-icon-pan: url(/third_party/icons/pan.svg);
      --bb-icon-preview: url(/third_party/icons/preview.svg);
      --bb-icon-reset-image: url(/third_party/icons/reset-image.svg);
      --bb-icon-start: url(/third_party/icons/start.svg);
      --bb-icon-warning: url(/third_party/icons/warning.svg);
      --bb-icon-zoom-in: url(/third_party/icons/zoom-in.svg);
      --bb-icon-zoom-out: url(/third_party/icons/zoom-out.svg);
      --bb-grid-pattern: url(/images/pattern.png);

      --bb-submit-input-text-transform: uppercase;
      --bb-input-font-size: 16px;
      --bb-input-padding: 16px 24px;
      --bb-input-border-radius: 32px;
      --bb-accent-color: #6b5484;
      --bb-input-legend-display: none;
      --bb-input-fieldset-border: none;
    }

    bb-preview-run {
      border-radius: 32px;
    }
  `;

  #loadBoardServerContents() {
    if (!this.url) {
      return nothing;
    }

    return html`<bb-preview-run
      url=${this.url}
      .kits=${kits}
    ></bb-preview-run>`;
  }
}
