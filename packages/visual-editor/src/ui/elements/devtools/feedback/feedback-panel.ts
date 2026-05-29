/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css, TemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";
import { SignalWatcher } from "@lit-labs/signals";
import { icons } from "../../../styles/icons.js";
import type { FeedbackLogEntry } from "../../../../sca/controller/subcontrollers/global/feedback-controller.js";
import "../../json-tree/json-tree.js";

@customElement("bb-devtools-feedback-panel")
export class DevToolsFeedbackPanel extends SignalWatcher(LitElement) {
  @property({ type: Array })
  accessor entries: readonly FeedbackLogEntry[] = [];

  static styles = [
    icons,
    css`
      * {
        box-sizing: border-box;
      }

      :host {
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
        min-height: 0;
        gap: var(--bb-grid-size-3);
        overflow: hidden;
        font-family: var(--bb-font-family, sans-serif);
        color: var(--light-dark-n-10);
      }

      .scroll-container {
        flex: 1;
        overflow-y: auto;
        padding-right: var(--bb-grid-size);
      }

      .section {
        background: var(--light-dark-n-100);
        border: 1px solid var(--light-dark-n-90);
        border-radius: var(--bb-grid-size-2);
        padding: var(--bb-grid-size-4);
        display: flex;
        flex-direction: column;
        gap: var(--bb-grid-size-3);
        height: 100%;

        & h3 {
          margin: 0;
          font: 600 var(--bb-label-medium) / var(--bb-label-line-height-medium)
            var(--bb-font-family);
          color: var(--light-dark-n-20);
          display: flex;
          align-items: center;
          gap: var(--bb-grid-size-2);
          padding-bottom: var(--bb-grid-size-2);
          border-bottom: 1px solid var(--light-dark-n-95);
        }
      }

      .call-log {
        display: flex;
        flex-direction: column;
        gap: var(--bb-grid-size-3);
      }

      .call-entry {
        background: var(--light-dark-n-98);
        border: 1px solid var(--light-dark-n-90);
        border-radius: var(--bb-grid-size);
        overflow: hidden;

        &.pending {
          border-left: 4px solid var(--light-dark-p-40);
        }

        &.loaded {
          border-left: 4px solid var(--light-dark-s-40);
        }

        &.error {
          border-left: 4px solid var(--light-dark-e-40, var(--bb-error-color));
        }

        &.closed {
          border-left: 4px solid var(--light-dark-n-50);
        }

        & .call-header {
          background: var(--light-dark-n-95);
          padding: var(--bb-grid-size-2) var(--bb-grid-size-3);
          font: 600 var(--bb-label-small) / var(--bb-label-line-height-small)
            var(--bb-font-family-mono, monospace);
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid var(--light-dark-n-90);

          & .header-title {
            display: flex;
            align-items: center;
            gap: var(--bb-grid-size);
          }

          & .timestamp {
            font-size: var(--bb-body-small);
            color: var(--light-dark-n-40);
            font-weight: 400;
          }
        }

        & .call-details {
          padding: var(--bb-grid-size-3);
          display: flex;
          flex-direction: column;
          gap: var(--bb-grid-size-2);

          & .label {
            font: 600 var(--bb-label-small) / var(--bb-label-line-height-small)
              var(--bb-font-family);
            color: var(--light-dark-n-30);
            margin-bottom: 2px;
          }

          & .meta-row {
            display: flex;
            gap: var(--bb-grid-size-4);
            font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
              var(--bb-font-family);
            color: var(--light-dark-n-20);
          }

          & .error-message {
            color: var(--light-dark-e-40, var(--bb-error-color));
            background: var(--light-dark-e-95);
            padding: var(--bb-grid-size-2);
            border-radius: var(--bb-grid-size);
            font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
              var(--bb-font-family-mono, monospace);
            border: 1px solid var(--light-dark-e-80);
          }

          & pre,
          & bb-json-tree {
            margin: 0;
            background: var(--light-dark-n-100);
            border: 1px solid var(--light-dark-n-95);
            padding: var(--bb-grid-size-3);
            border-radius: var(--bb-grid-size);
            font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
              var(--bb-font-family-mono, monospace);
            overflow-x: auto;
          }
        }
      }

      .empty-state {
        color: var(--light-dark-n-50);
        font: 400 var(--bb-body-medium) / var(--bb-body-line-height-medium)
          var(--bb-font-family);
        text-align: center;
        padding: var(--bb-grid-size-6) 0;
      }
    `,
  ];

  render(): TemplateResult {
    const { entries } = this;
    return html`
      <div class="section">
        <h3><span class="g-icon">history</span> Feedback Log</h3>
        <div class="scroll-container">
          ${entries && entries.length > 0
            ? html`
                <div class="call-log">
                  ${entries.map((entry) => {
                    const date = new Date(entry.timestamp);
                    const timeString = date.toLocaleTimeString();
                    const statusClass = entry.status;
                    let statusIcon = "pending";
                    if (entry.status === "loaded") statusIcon = "check_circle";
                    if (entry.status === "error") statusIcon = "error";
                    if (entry.status === "closed") statusIcon = "cancel";

                    return html`
                      <div class="call-entry ${statusClass}">
                        <div class="call-header">
                          <span class="header-title">
                            <span class="g-icon header-icon">${statusIcon}</span>
                            Feedback Request (${entry.flow === "submit" ? "Silent" : "Interactive"})
                          </span>
                          <span class="timestamp">${timeString}</span>
                        </div>
                        <div class="call-details">
                          <div class="meta-row">
                            <div>
                              <span class="label">Status:</span> ${entry.status}
                            </div>
                            ${entry.bucketOverride
                              ? html`<div>
                                  <span class="label">Bucket Override:</span>
                                  ${entry.bucketOverride}
                                </div>`
                              : ""}
                          </div>

                          ${entry.errorMessage
                            ? html`<div class="error-message">
                                ${entry.errorMessage}
                              </div>`
                            : ""}

                          ${entry.productData &&
                          Object.keys(entry.productData).length > 0
                            ? html`<div>
                                <div class="label">Product Data (Payload):</div>
                                <bb-json-tree
                                  .json=${entry.productData}
                                ></bb-json-tree>
                              </div>`
                            : html`<div>
                                <div class="label">Product Data:</div>
                                <div class="empty-state" style="padding: var(--bb-grid-size-2);">No product data included.</div>
                              </div>`}
                        </div>
                      </div>
                    `;
                  })}
                </div>
              `
            : html`<div class="empty-state">No feedback sent yet in this session.</div>`}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bb-devtools-feedback-panel": DevToolsFeedbackPanel;
  }
}
