/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Outcome } from "@breadboard-ai/types/data.js";
import { ok } from "@breadboard-ai/utils";
import { html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { OutcomeData } from "../../../../src/types/types.js";

import "../../../../src/ui/elements/json-tree/json-tree.js";
import "./llm-content-viewer.js";
import { map } from "lit/directives/map.js";

export { OutcomeViewer };

@customElement("ui-outcome-viewer")
class OutcomeViewer extends LitElement {
  @property()
  accessor outcome: Outcome<OutcomeData> | null = null;

  render() {
    if (!this.outcome) {
      return html`No outcomes`;
    }
    if (!ok(this.outcome)) {
      return html`Error: ${this.outcome.$error}`;
    }
    const { success, href, outcomes, intermediate } = this.outcome;
    return html`<dl>
      <dt>success</dt>
      <dd>${success}</dt>
      <dt>href</dt>
      <dd>${href}</dt>
      <dt>outcomes</dt>
      <dd><ui-llm-content-viewer .content=${outcomes}></ui-llm-content-viewer></dd>
      <dt>intermediate</dt>
      <dd><dl>${map(intermediate, (item) => {
        return html`<dt>${item.path}</dt>
          <dd>
            <ui-llm-content-viewer
              .content=${item.content}
            ></ui-llm-content-viewer>
          </dd>`;
      })}</dl></dd>
    </dl>`;
  }
}
