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
      display: inline-flex;
      align-items: flex-start;
      font-family: Helvetica, sans-serif;
      border-radius: 8px;
      padding: 10px 14px;
      border: 1px solid #d9d9d9;
      box-shadow: rgba(0, 0, 0, 0.1) 1px 1px 5px;
    }
    img {
      width: 40px;
      max-height: 100%;
    }
    :host::part(tool-call-content) {
      display: flex;
      flex-direction: column;
      padding: 0 0 0 16px;
      line-height: 1.4;
    }
    [part~="tool-call-content"] > :last-child {
      margin-bottom: 0;
    }
    pre {
      white-space: pre-wrap;
      overflow-wrap: break-word;
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
          return "Unstarted";
        }
        case "executing": {
          return "Executing...";
        }
        case "success": {
          return [
            "Success",
            html`<pre>${JSON.stringify(response.result)}</pre>`,
          ];
        }
        case "error": {
          return ["Error", html`<pre>${JSON.stringify(response.error)}</pre>`];
        }
        default: {
          response satisfies never;
          console.error("Unexpected state", response);
          return "Internal error";
        }
      }
    })();
    return html`
      <img src="/bbrt/images/tool.svg" />
      <div part="tool-call-content">
        <span>${this.toolCall.functionId}</span>
        <pre>${JSON.stringify(this.toolCall.args)}</pre>
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
        console.log(
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
