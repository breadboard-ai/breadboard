/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SignalWatcher } from "@lit-labs/signals";
import { consume } from "@lit/context";
import { LitElement, css, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import {
  artifactStoreContext,
  type ArtifactStore,
} from "../artifacts/artifact-store.js";
import type { ReactiveFunctionCallState } from "../state/function-call.js";
import "./error-message.js";

@customElement("bbrt-tool-call")
export class BBRTToolCallEl extends SignalWatcher(LitElement) {
  @property({ attribute: false })
  accessor toolCall: ReactiveFunctionCallState | undefined = undefined;

  @consume({ context: artifactStoreContext })
  @property({ attribute: false })
  accessor artifacts!: ArtifactStore;

  static override styles = css`
    :host {
      background: #fff;
      display: block;
      align-items: flex-start;
      font-family: Helvetica, sans-serif;
      border-radius: 8px;
      padding: 16px;
      border: 1px solid #d9d9d9;
      box-shadow: rgba(0, 0, 0, 0.1) 1px 1px 5px;
    }
    :host::part(tool-call-content) {
      display: flex;
      flex-direction: column;
      line-height: 1.4;
    }
    [part~="tool-call-content"] > :last-child {
      margin-bottom: 0;
    }
    pre {
      white-space: pre-wrap;
      overflow-wrap: break-word;
    }
    * {
      margin: 8px 0 0 0;
    }
    :first-child {
      margin-top: 0;
    }
    .status {
      margin-top: 20px;
    }
    .json-args,
    .json-result,
    .custom-widget {
      overflow: auto;
      padding: 12px;
      border-radius: 8px;
      border: 1px solid var(--bb-neutral-300);
    }
    .json-args,
    .json-result {
      background: rgba(0, 0, 0, 2%);
      max-height: 200px;
    }
    .custom-widget {
      margin: 20px 0;
      box-shadow: 1px 2px 4px rgba(0, 0, 0, 0.1);
    }
    bbrt-error-message {
      border-radius: 8px;
      border: 1px solid var(--bb-error-color);
    }
    img {
      max-width: 800px;
      max-height: 450px;
      object-fit: contain;
      padding: 32px 16px 16px 16px;
    }
  `;

  override render() {
    const toolCall = this.toolCall;
    if (toolCall === undefined) {
      return nothing;
    }
    // prettier-ignore
    return html`
      <div part="tool-call-content">
        <span>Calling <code>${toolCall.functionId}</code> with arguments:</span>
        <pre class="json-args">${JSON.stringify(toolCall.args, null, 2)}</pre>
        <div class="status">Status: ${this.#renderStatus()}</div>
        ${this.#renderCustomWidget()}
        ${this.#renderJsonResult()}
        ${this.#renderError()}
        ${this.#renderArtifacts()}
      </div>
    `;
  }

  #renderStatus() {
    if (this.toolCall === undefined) {
      return nothing;
    }
    const response = this.toolCall.response;
    switch (response.status) {
      case "unstarted": {
        return html`<em>Unstarted</em>`;
      }
      case "executing": {
        return html`<em>Executing...</em>`;
      }
      case "success": {
        return [html`<em>Success</em>`];
      }
      case "error": {
        return html`<em>Error</em>`;
      }
      default: {
        response satisfies never;
        console.error("Unexpected state", response);
        return "Internal error";
      }
    }
  }

  #renderCustomWidget() {
    if (this.toolCall?.render) {
      return html`<div class="custom-widget">${this.toolCall.render()}</div>`;
    }
    return nothing;
  }

  #renderJsonResult() {
    const response = this.toolCall?.response;
    if (response?.status !== "success") {
      return nothing;
    }
    const indented = JSON.stringify(response.result, null, 2);
    return html` <pre class="json-result">${indented}</pre>`;
  }

  #renderArtifacts() {
    const response = this.toolCall?.response;
    if (
      response?.status !== "success" ||
      this.artifacts === undefined ||
      !response.artifacts.length
    ) {
      return nothing;
    }
    const artifacts = [];
    for (const { id, mimeType } of response.artifacts) {
      const entry = this.artifacts.entry(id);
      if (mimeType.startsWith("image/")) {
        artifacts.push(html`<img src=${entry.url.value ?? ""} />`);
      } else if (mimeType.startsWith("audio/")) {
        artifacts.push(
          html`<audio controls src=${entry.url.value ?? ""}></audio>`
        );
      } else {
        console.error(
          "Could not display artifact with unsupported MIME type",
          mimeType
        );
      }
    }
    return artifacts;
  }

  #renderError() {
    if (this.toolCall?.response?.status !== "error") {
      return nothing;
    }
    return html`
      <bbrt-error-message
        .error=${this.toolCall.response.error}
      ></bbrt-error-message>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bbrt-tool-call": BBRTToolCallEl;
  }
}
