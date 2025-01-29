/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SignalWatcher } from "@lit-labs/signals";
import { html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { FastAccess } from "../../state";
import { GraphIdentifier, NodeIdentifier } from "@breadboard-ai/types";

@customElement("bb-fast-access-menu")
export class FastAccessMenu extends SignalWatcher(LitElement) {
  @property()
  accessor state: FastAccess | null = null;

  @property()
  accessor graphId: GraphIdentifier | null = null;

  @property()
  accessor nodeId: NodeIdentifier | null = null;

  render() {
    const graphId = this.graphId || "";
    const assets = [...(this.state?.graphAssets.values() || [])];
    const tools = [...(this.state?.tools.values() || [])];
    const components = [
      ...(this.state?.components.get(graphId)?.values() || []),
    ];
    return html`<h3>Assets</h3>
      <ul>
        ${assets.map((asset) => {
          return html`<li
            @click=${() => {
              if (!this.state) return;

              const result = this.state.components.get(asset.path);
              console.log("ASSET SELECTED", result);
            }}
          >
            ${asset.metadata?.title}
          </li>`;
        })}
      </ul>
      <h3>Tools</h3>
      <ul>
        ${tools.map((tool) => {
          return html`<li>${tool.title}</li>`;
        })}
      </ul>
      <h3>Outputs</h3>
      <ul>
        ${components.map((component) => {
          return html`<li
            @click=${async () => {
              console.log("COMPONENT", component);
            }}
          >
            ${component.title}
          </li>`;
        })}
      </ul> `;
  }
}
