/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { DataPart, LLMContent } from "@breadboard-ai/types";
import { css, html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { markdown } from "../../../../src/ui/directives/markdown.js";
import { map } from "lit/directives/map.js";

export { LLMContentViewer };

@customElement("ui-llm-content-viewer")
class LLMContentViewer extends LitElement {
  @property()
  accessor content: LLMContent | null = null;

  @property()
  accessor isJsonOutput = false;

  static styles = css`
    ul {
      list-style: none;

      padding: 0;

      & li.part {
        border-radius: var(--bb-grid-size-2);
        border: 1px solid var(--light-dark-n-90);
        padding: var(--bb-grid-size-2);
      }
    }
  `;

  render() {
    const { content } = this;
    if (!content) {
      return html`No content`;
    }
    const role = content.role || "unknown";
    return html`
      <ul class="parts">
        ${map(content.parts || [], (part: DataPart) =>
          this.#renderPart(part, role === "model" && this.isJsonOutput)
        )}
      </ul>
    `;
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
