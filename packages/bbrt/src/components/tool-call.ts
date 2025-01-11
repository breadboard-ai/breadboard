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
import type { FunctionCallState } from "../state/function-call.js";
import "./error-message.js";

@customElement("bbrt-tool-call")
export class BBRTToolCallEl extends SignalWatcher(LitElement) {
  @property({ attribute: false })
  accessor toolCall: FunctionCallState | undefined = undefined;

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
    .json-args,
    .json-result {
      overflow: auto;
      max-height: 200px;
      background: rgba(0, 0, 0, 2%);
      padding: 12px;
      border-radius: 8px;
      border: 1px solid var(--bb-neutral-300);
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
    if (this.toolCall === undefined) {
      return nothing;
    }
    const status = (() => {
      const response = this.toolCall.response;
      switch (response.status) {
        case "unstarted": {
          return html`Status: <em>Unstarted</em>`;
        }
        case "executing": {
          return html`Status: <em>Executing...</em>`;
        }
        case "success": {
          return [
            html`Status: <em>Success</em>`,
            html`<pre class="json-result">
${JSON.stringify(response.result, null, 2)}</pre
            >`,
          ];
        }
        case "error": {
          return html`Status: <em>Error</em><br />
            <bbrt-error-message .error=${response.error}></bbrt-error-message>`;
        }
        default: {
          response satisfies never;
          console.error("Unexpected state", response);
          return "Internal error";
        }
      }
    })();
    return html`
      <div part="tool-call-content">
        <span
          >Calling <code>${this.toolCall.functionId}</code> with
          arguments:</span
        >
        <pre class="json-args">
${JSON.stringify(this.toolCall.args, null, 2)}</pre
        >
        <div>${status}</div>
        ${this.#renderArtifacts()}
      </div>
    `;
  }

  #renderArtifacts() {
    if (this.toolCall === undefined || this.artifacts === undefined) {
      return nothing;
    }
    const response = this.toolCall.response;
    if (response.status !== "success") {
      return nothing;
    }
    if (!response.artifacts.length) {
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
}

declare global {
  interface HTMLElementTagNameMap {
    "bbrt-tool-call": BBRTToolCallEl;
  }
}
