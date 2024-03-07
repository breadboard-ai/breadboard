/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ErrorObject, InspectableRunEvent } from "@google-labs/breadboard";
import { LitElement, html, css, HTMLTemplateResult, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";

@customElement("bb-activity-log")
export class ActivityLog extends LitElement {
  @property({ reflect: false })
  events: InspectableRunEvent[] | null = null;

  @property({ reflect: true })
  eventPosition = 0;

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

    pre {
      display: inline-block;
    }
  `;

  render() {
    return html`
      <h1>Activity Log</h1>
      ${this.events
        ? this.events.map((event, idx) => {
            let content: HTMLTemplateResult | symbol = nothing;
            switch (event.type) {
              case "node": {
                const { node, end, inputs, outputs } = event;
                // `end` is null if the node is still running
                // that is, the `nodeend` for this node hasn't yet
                // been received.
                if (end === null) {
                  // TODO: Figure out why this doesn't work.
                  // if (idx !== this.eventPosition) {
                  //   return nothing;
                  // }
                  content = html`${node.type === "input"
                    ? "Waiting..."
                    : // prettier-ignore
                      html`Working: (<pre>${node.id}</pre>)`}`;
                } else {
                  // This is fiddly. Output nodes don't have any outputs.
                  const result = node.type === "output" ? inputs : outputs;
                  content = html`<section>
                    <h1 data-message-idx=${idx}>${node.type}</h1>
                    ${node.type === "output" || node.type === "input"
                      ? html` <aside class="node-output">
                          <details open>
                            <summary>text</summary>
                            <bb-json-tree .json=${result}></bb-json-tree>
                          </details>
                        </aside>`
                      : nothing}
                  </section>`;
                  break;
                }
                break;
              }
              case "secret": {
                // can ask for secret here. Use
                // `event.result` to get to the `HarnessRunResult`.
                return nothing;
              }
              case "error": {
                const { error } = event;
                let output = "";
                if (typeof error === "string") {
                  output = error;
                } else {
                  let messageOutput = "";
                  let errorData = error.error;
                  while (typeof errorData === "object") {
                    if (error && "message" in error) {
                      messageOutput += `${error.message}\n`;
                    }

                    errorData = error.error as ErrorObject;
                  }

                  output = messageOutput;
                }

                content = html`${output}`;
                break;
              }

              default: {
                return nothing;
              }
            }

            const classes: Record<string, boolean> = {
              "activity-entry": true,
              [event.type]: true,
            };

            if (event.type === "node" && event.end) {
              classes[event.node.type] = true;
            }

            return html`<div class="${classMap(classes)}">
              <div class="content">${content}</div>
            </div>`;
          })
        : html`No activity yet`}
    `;
  }
}
