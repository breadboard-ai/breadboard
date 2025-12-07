/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { css, html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { map } from "lit/directives/map.js";
import { FinalChainReport } from "../../../collate-context.js";
import { DataPart, LLMContent, TextCapabilityPart } from "@breadboard-ai/types";
import { markdown } from "../../../../src/ui/directives/markdown.js";
import "../../../../src/ui/elements/json-tree/json-tree.js";

export { ContextsViewer };

@customElement("ui-contexts-viewer")
class ContextsViewer extends LitElement {
  @property()
  accessor contexts: FinalChainReport[] = [];

  static styles = css`
    :host {
      display: block;
    }

    details.item > summary {
      padding: var(--bb-grid-size-2);
    }

    details {
      border: 1px solid var(--border-color);
      border-radius: var(--bb-grid-size-2);
      margin-bottom: var(--bb-grid-size-2);

      summary {
        cursor: pointer;
        list-style: none;
        user-select: none;
      }
    }

    .content {
      background: var(--light-dark-n-100);
      color: var(--light-dark-n-0);

      .stats {
        padding: var(--bb-grid-size-2);
        background-color: var(--light-dark-n-95);
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--bb-grid-size-2);
        font-size: 12px;
      }

      .config {
        padding: var(--bb-grid-size-2);
      }

      ul.turns {
        list-style: none;
        padding: 0;
        margin-bottom: var(--bb-grid-size-2);

        li {
          padding: var(--bb-grid-size-2);
          list-style: none;

          &.model,
          &.unknown {
            background-color: var(--light-dark-n-95);
          }

          ul {
            padding: 0;

            & li.part {
              border-radius: var(--bb-grid-size-2);
              border: 1px solid var(--light-dark-n-90);
            }
          }
        }
      }
    }
  `;

  render() {
    return map(this.contexts, (context, idx) => {
      const isJsonOutput =
        context.config?.generationConfig?.responseMimeType ===
        "application/json";
      const { generationConfig, systemInstruction } = context.config || {};
      const systemInstructionText = (
        systemInstruction?.parts?.[0] as TextCapabilityPart
      )?.text;
      return html`<details class="item" ?open=${idx === 0}>
        <summary>
          Context ${idx + 1} (${context.turnCount} turns,
          ${Math.round(context.totalDurationMs / 1000)}s)
        </summary>
        <div class="content">
          <div class="config">
            <details>
              <summary>System Instruction</summary>
              <div>${markdown(systemInstructionText)}</div>
            </details>
            <details>
              <summary>Generation Config</summary>
              <bb-json-tree .json=${generationConfig}></bb-json-tree>
            </details>
          </div>
          <div class="stats">
            <div>
              Started:
              ${new Date(context.startedDateTime).toLocaleString(
                Intl.DateTimeFormat().resolvedOptions().locale,
                {
                  dateStyle: "short",
                  timeStyle: "medium",
                }
              )}
            </div>
            <div>
              Request Time: ${Math.round(context.totalRequestTimeMs / 1000)}s
            </div>
            <div>Thoughts: ${context.totalThoughts}</div>
            <div>Function Calls: ${context.totalFunctionCalls}</div>
          </div>
          <ul class="turns">
            ${map(context.context, (turn) =>
              this.#renderTurn(turn, isJsonOutput)
            )}
          </ul>
        </div>
      </details>`;
    });
  }

  #renderTurn(turn: LLMContent, isJsonOutput: boolean) {
    const role = turn.role || "unknown";
    return html`<li class="${role}">
      <details open>
        <summary>${role}</summary>
        <ul class="parts">
          ${map(turn.parts || [], (part: DataPart) =>
            this.#renderPart(part, role === "model" && isJsonOutput)
          )}
        </ul>
      </details>
    </li>`;
  }

  #renderPart(part: DataPart, isJsonOutput: boolean) {
    if (part.thought && "text" in part) {
      return html`<li class="part thought">
        <strong>Thought:</strong>${markdown(part.text)}
      </li>`;
    }

    if ("functionCall" in part) {
      return html`<li class="part function-call">
        <div class="name">call ${part.functionCall.name}</div>
        <bb-json-tree .json=${part.functionCall.args}></bb-json-tree>
      </li>`;
    }

    if ("functionResponse" in part) {
      return html`<li class="part function-response">
        <div class="name">response ${part.functionResponse.name}</div>
        <bb-json-tree .json=${part.functionResponse.response}></bb-json-tree>
      </li>`;
    }

    if ("text" in part) {
      if (isJsonOutput) {
        return html`<li class="part text">
          <bb-json-tree .json=${JSON.parse(part.text)}></bb-json-tree>
        </li>`;
      }
      return html`<li class="part text">${markdown(part.text)}</li>`;
    }

    return html`<li>${JSON.stringify(part, null, 2)}</li>`;
  }
}
