/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ErrorObject } from "@google-labs/breadboard";
import { HarnessRunResult } from "@google-labs/breadboard/harness";
import { LitElement, html, css, HTMLTemplateResult, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";

@customElement("bb-activity-log")
export class ActivityLog extends LitElement {
  @property({ reflect: false })
  messages: HarnessRunResult[] | null = null;

  @property({ reflect: true })
  messagePosition = 0;

  static styles = css`
    :host {
      display: block;
      background: #fff;
      width: 100%;
      height: 100%;
      overflow-y: scroll;
      scrollbar-gutter: stable;

      --padding-x: calc(var(--bb-grid-size) * 4);
      --padding-y: calc(var(--bb-grid-size) * 2);
    }

    :host > h1 {
      position: sticky;
      top: 0;
      font-size: var(--bb-font-medium);
      font-weight: normal;
      margin: 0 0 var(--bb-grid-size) 0;
      padding: var(--padding-x) var(--padding-x) var(--padding-y)
        var(--padding-x);
      background: white;
      z-index: 2;
    }

    :host > h1::after {
      content: "";
      width: calc(100% - var(--padding-x) * 2);
      height: 1px;
      position: absolute;
      bottom: var(--bb-grid-size);
      left: var(--padding-x);
      background: #f6f6f6;
    }

    .activity-entry {
      padding: var(--padding-y) var(--padding-x);
      position: relative;
      font-size: var(--bb-font-medium);
      user-select: none;
    }

    .activity-entry.error {
      color: #cc0000;
    }

    .activity-entry h1 {
      font-size: var(--bb-font-medium);
      margin: 0;
      font-weight: normal;
    }

    .activity-entry::after {
      content: "";
      width: calc(var(--bb-grid-size) * 2);
      height: calc(var(--bb-grid-size) * 2);
      border-radius: 50%;
      left: var(--padding-x);
      top: calc(var(--padding-y) + 5px);
      position: absolute;
      background: hsl(44.7, 100%, 80%);
    }

    .activity-entry::before {
      --top: calc(var(--padding-y) + 5px);
      content: "";
      width: 2px;
      height: 100%;
      left: calc(var(--padding-x) + 3px);
      top: 0;
      height: 100%;
      position: absolute;
      background: #d9d9d9;
    }

    .activity-entry.graphstart::after,
    .activity-entry.graphend::after {
      background: rgb(110, 84, 139);
    }

    .activity-entry.error::after {
      background: #cc0000;
    }

    .activity-entry.result::after {
      background: #ffa500;
    }

    .activity-entry.input::after {
      background: #c9daf8ff;
    }

    .activity-entry.secrets::after {
      background: #f4cccc;
    }

    .activity-entry.output::after {
      background: #b6d7a8ff;
    }

    .activity-entry:first-of-type::before {
      top: var(--top);
      height: calc(100% - var(--top));
    }

    .activity-entry:last-of-type::before {
      height: var(--top);
    }

    .activity-entry:first-of-type:last-of-type::before {
      display: none;
    }

    .activity-entry .content {
      padding-left: calc(var(--bb-grid-size) * 4);
    }

    section h1[data-message-idx] {
      cursor: pointer;
    }

    summary::-webkit-details-marker {
      display: none;
    }

    summary {
      list-style: none;
    }

    .node-output details {
      padding: calc(var(--bb-grid-size) * 2);
    }

    .node-output summary {
      font-size: var(--bb-text-small);
      margin: calc(var(--bb-grid-size) * 2) 0;
      font-weight: normal;
    }

    .node-output details div {
      font-size: var(--bb-text-nano);
      font-family: var(--bb-font-family-mono);
      line-height: 1.65;
    }
  `;

  render() {
    return html`
      <h1>Activity Log</h1>
      ${this.messages
        ? this.messages.map((message, idx) => {
            let content: HTMLTemplateResult | symbol = nothing;
            switch (message.type) {
              case "graphstart": {
                // TODO: Support subgraphs.
                if (message.data.path.length > 0) {
                  return nothing;
                }

                content = html`Board started`;
                break;
              }

              case "error": {
                let output = "";
                if (typeof message.data.error === "string") {
                  output = message.data.error.toString();
                } else {
                  let messageOutput = "";
                  let error = message.data.error;
                  while (typeof error === "object") {
                    if (error && "message" in error) {
                      messageOutput += `${error.message}\n`;
                    }

                    error = error.error as ErrorObject;
                  }

                  output = messageOutput;
                }

                content = html`${output}`;
                break;
              }

              case "output":
              case "nodeend": {
                // TODO: Support subgraphs.
                if (
                  message.type === "nodeend" &&
                  (message.data.path.length > 1 ||
                    message.data.node.type === "output")
                ) {
                  return nothing;
                }

                content = html`<section>
                  <h1 data-message-idx=${idx}>${message.data.node.type}</h1>
                  ${message.type === "output" ||
                  message.data.node.type === "input"
                    ? html` <aside class="node-output">
                        <details open>
                          <summary>text</summary>
                          <div>${message.data.outputs.text}</div>
                        </details>
                      </aside>`
                    : nothing}
                </section>`;
                break;
              }

              case "input":
              case "nodestart": {
                if (idx !== this.messagePosition) {
                  return nothing;
                }

                content = html`${message.type === "input"
                  ? "Waiting..."
                  : `Working: (${message.data.node.id})`}`;
                break;
              }

              default: {
                return nothing;
              }
            }

            const classes: Record<string, boolean> = {
              "activity-entry": true,
              [message.type]: true,
            };

            if (message.type === "nodeend") {
              classes[message.data.node.type] = true;
            }

            return html`<div class="${classMap(classes)}">
              <div class="content">${content}</div>
            </div>`;
          })
        : html`No activity yet`}
    `;
  }
}
