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
import { iconButtonStyle } from "../style/icon-button.js";
import { loadingEllipsisStyle } from "../style/loading-ellipsis.js";
import "./error-message.js";

@customElement("bbrt-tool-call")
export class BBRTToolCallEl extends SignalWatcher(LitElement) {
  @property({ attribute: false })
  accessor toolCall: ReactiveFunctionCallState | undefined = undefined;

  @consume({ context: artifactStoreContext })
  @property({ attribute: false })
  accessor artifacts!: ArtifactStore;

  @property({ reflect: true })
  accessor mode: "collapsed" | "expanded" = "collapsed";

  static override styles = [
    iconButtonStyle,
    loadingEllipsisStyle,
    css`
      #header {
        display: flex;
        justify-content: space-between;
      }
      #summary-container {
        cursor: pointer;
      }
      #summary {
        opacity: 80%;
        min-width: 0;
        flex: 1;
      }
      #summary-status {
        color: #868686;
        font-style: italic;
      }
      :host(:hover) #summary-status {
        color: #585858;
      }
      #summary-container #error {
        margin-bottom: 20px;
        margin: 5px 10px 20px -15px;
        border-radius: 8px;
      }

      #toggle-expand-button {
        --bb-button-background: transparent;
        border: none;
        margin: -6px 0 0 0;
        opacity: 20%;
      }
      :host(:hover) #toggle-expand-button {
        opacity: 100%;
      }
      .expanded #toggle-expand-button {
        --bb-icon: var(--bb-icon-expand);
      }
      .collapsed #toggle-expand-button {
        --bb-icon: var(--bb-icon-collapse);
      }

      #summary #error {
        margin: 20px -0 20px -10px;
      }

      #expanded,
      #custom-widget {
        padding: 15px;
        margin: 5px 10px 20px -15px;
        border: 1px solid #e4e4e4;
        border-radius: 8px;
        box-shadow: inset rgb(0 0 0 / 5%) 1px 1px 5px;
        background: #fff;
      }
      #expanded {
        overflow-x: auto;
      }
      .error #expanded {
        border-color: red;
      }
      #custom-widget {
        margin-top: 8px;
      }

      #expanded pre {
        white-space: pre-wrap;
        max-height: 200px;
        overflow-y: auto;
        color: #6b6b6b;
        border: 1px solid #e4e4e4;
        border-radius: 8px;
        padding: 8px;
        margin: 0;
      }

      ::part(error) {
        border: 1px solid red;
        border-radius: 8px;
        max-height: 10em;
        overflow: auto;
      }

      .status-success {
        color: green;
      }
      .status-error {
        color: red;
      }
      .status-executing {
        color: blue;
      }

      #artifacts img {
        max-width: 800px;
        max-height: 400px;
        object-fit: contain;
        box-shadow: rgb(0 0 0 / 11%) 3px 3px 5px;
        border: 1px solid #bababa;
        border-radius: 6px;
        margin: 20px auto;
      }

      h5 {
        margin-bottom: 6px;
      }
      h5:first-of-type {
        margin-top: 0;
      }
    `,
  ];

  override render() {
    const toolCall = this.toolCall;
    if (toolCall === undefined) {
      return nothing;
    }
    return html`
      <div id="container" class="${this.mode} ${toolCall.response.status}">
        <div id="summary-container" @click=${this.#toggleExpanded}>
          <div id="header">
            <div id="summary">${this.#renderSummary()}</div>
            <button
              id="toggle-expand-button"
              class="bb-icon-button"
              title=${this.mode === "collapsed" ? "Expand" : "Collapse"}
            ></button>
          </div>
          ${this.mode === "collapsed" ? this.#renderError() : nothing}
        </div>

        ${this.mode === "expanded" ? this.#renderExpanded() : nothing}
        <div id="artifacts">${this.#renderArtifacts()}</div>
        ${this.#renderCustomWidget()}
      </div>
    `;
  }

  #toggleExpanded() {
    this.mode = this.mode === "collapsed" ? "expanded" : "collapsed";
  }

  #renderSummary() {
    const toolCall = this.toolCall!;
    return html`
      <div id="summary-status">
        <code>${toolCall.functionId}</code>
        ${this.#loadingEllipsisIfExecuting}
      </div>
    `;
  }

  get #loadingEllipsisIfExecuting() {
    return this.toolCall?.response?.status === "executing"
      ? html`<span class="loading-ellipsis"></span>`
      : nothing;
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

  #renderExpanded() {
    const toolCall = this.toolCall!;
    // prettier-ignore
    return html`
      <div id="expanded">
        <h5>Status</h5>
        <div class="expanded-status">${this.#renderStatus()}</div>

        <h5>Tool ID</h5>
        <code>${toolCall.functionId}</code>

        <h5>Arguments</h5>
        ${this.#renderJsonArgs()}
        ${this.#renderJsonResult()}
        ${
          toolCall.response.status === "error"
            ? html`<h5>Error</h5>${this.#renderError()}`
            : nothing
        }
      </div>
    `;
  }

  #renderStatus() {
    const status = this.toolCall?.response?.status;
    if (!status) {
      return nothing;
    }
    return html`
      <code class="status-${status}">
        ${status}
        ${status == "executing" ? this.#loadingEllipsisIfExecuting : nothing}
      </code>
    `;
  }

  #renderJsonArgs() {
    const toolCall = this.toolCall!;
    return html`<pre>${JSON.stringify(toolCall.args, null, 2)}</pre>`;
  }

  #renderJsonResult() {
    const response = this.toolCall?.response;
    return response?.status === "success"
      ? html`
          <h5>Result</h5>
          <pre>${JSON.stringify(response.result, null, 2)}</pre>
        `
      : nothing;
  }

  #renderCustomWidget() {
    if (this.toolCall?.render) {
      return html`<div id="custom-widget">${this.toolCall.render()}</div>`;
    }
    return nothing;
  }

  #renderError() {
    if (this.toolCall?.response?.status !== "error") {
      return nothing;
    }
    return html`
      <bbrt-error-message
        id="error"
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
