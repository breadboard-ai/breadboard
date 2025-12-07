/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { map } from "lit/directives/map.js";
import { FinalChainReport } from "../../../collate-context.js";
import { DataPart, LLMContent } from "@breadboard-ai/types";

export { ContextsViewer };

@customElement("ui-contexts-viewer")
class ContextsViewer extends LitElement {
  @property()
  accessor contexts: FinalChainReport[] = [];

  render() {
    return map(this.contexts, (context, idx) => {
      return html`<details class="item" ?open=${idx === 0}>
        <summary>
          Context ${idx + 1} (${context.turnCount} turns,
          ${Math.round(context.totalDurationMs / 1000)}s)
        </summary>
        <div class="content">
          <div class="stats">
            <div>
              Started: ${new Date(context.startedDateTime).toLocaleString()}
            </div>
            <div>
              Request Time: ${Math.round(context.totalRequestTimeMs / 1000)}s
            </div>
            <div>Thoughts: ${context.totalThoughts}</div>
            <div>Function Calls: ${context.totalFunctionCalls}</div>
          </div>
          <div class="turns">
            ${map(context.context, (turn) => this.#renderTurn(turn))}
          </div>
        </div>
      </details>`;
    });
  }

  #renderTurn(turn: LLMContent) {
    const role = turn.role || "unknown";
    return html`<div class="context-turn ${role}">
      <div class="turn-header">${role}</div>
      ${map(turn.parts || [], (part: DataPart) => this.#renderPart(part))}
    </div>`;
  }

  #renderPart(part: DataPart) {
    if (part.thought && "text" in part) {
      return html`<div class="part-thought">
        <strong>Thought:</strong> ${part.text}
      </div>`;
    }

    if ("functionCall" in part) {
      return html`<div class="part-function-call">
        <div class="name">call ${part.functionCall.name}</div>
        <pre>${JSON.stringify(part.functionCall.args, null, 2)}</pre>
      </div>`;
    }

    if ("functionResponse" in part) {
      return html`<div class="part-function-response">
        <div class="name">response ${part.functionResponse.name}</div>
        <pre>${JSON.stringify(part.functionResponse.response, null, 2)}</pre>
      </div>`;
    }

    if ("text" in part) {
      return html`<div class="part-text">${part.text}</div>`;
    }

    return html`<pre>${JSON.stringify(part, null, 2)}</pre>`;
  }
}
