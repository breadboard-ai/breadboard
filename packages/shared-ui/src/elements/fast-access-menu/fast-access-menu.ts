/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { SignalWatcher } from "@lit-labs/signals";
import { css, html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { FastAccess } from "../../state";
import { GraphIdentifier, NodeIdentifier } from "@breadboard-ai/types";
import { FastAccessSelectEvent } from "../../events/events";

@customElement("bb-fast-access-menu")
export class FastAccessMenu extends SignalWatcher(LitElement) {
  @property()
  accessor state: FastAccess | null = null;

  @property()
  accessor graphId: GraphIdentifier | null = null;

  @property()
  accessor nodeId: NodeIdentifier | null = null;

  static styles = css`
    :host {
      display: block;
      width: 240px;
      background: var(--bb-neutral-0);
      height: 300px;
      overflow: scroll;
      scrollbar-width: none;
      border: 1px solid var(--bb-neutral-300);
      border-radius: var(--bb-grid-size-2);
      box-shadow: var(--bb-elevation-6);
      padding: var(--bb-grid-size-2) var(--bb-grid-size-3);
      white-space: normal;
    }

    #assets,
    #tools,
    #outputs {
      & h3 {
        font: 400 var(--bb-body-x-small) / var(--bb-body-line-height-x-small)
          var(--bb-font-family);
        text-transform: uppercase;
        color: var(--bb-neutral-500);
        margin: 0 0 var(--bb-grid-size-2) 0;
      }

      & menu {
        display: block;
        width: 100%;
        padding: 0;
        margin: 0 0 var(--bb-grid-size-2) 0;
        list-style: none;

        & button {
          display: flex;
          align-items: center;
          justify-content: flex-start;
          background-color: var(--bb-neutral-0);
          border: none;
          color: var(--bb-neutral-900);
          margin: var(--bb-grid-size-2) 0;
          height: var(--bb-grid-size-6);
          padding: 0 0 0 var(--bb-grid-size-7);
          width: 100%;
          font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
            var(--bb-font-family);
          transition: background-color 0.2s cubic-bezier(0, 0, 0.3, 1);

          &:not([disabled]) {
            cursor: pointer;

            &:hover {
              background-color: var(--bb-neutral-50);
            }
          }
        }
      }
    }

    #assets menu button {
      background: var(--bb-icon-text) 4px center / 20px 20px no-repeat;
    }

    #tools menu button {
      background: var(--bb-icon-tool) 4px center / 20px 20px no-repeat;
    }

    #outputs menu button {
      background: var(--bb-icon-output) 4px center / 20px 20px no-repeat;
    }
  `;

  render() {
    const graphId = this.graphId || "";
    const assets = [...(this.state?.graphAssets.values() || [])];
    const tools = [...(this.state?.tools.values() || [])];
    const components = [
      ...(this.state?.components.get(graphId)?.values() || []),
    ];
    return html` <section id="assets">
        <h3>Assets</h3>
        <menu>
          ${assets.map((asset) => {
            return html`<li>
              <button
                @click=${() => {
                  this.dispatchEvent(
                    new FastAccessSelectEvent(
                      asset.path,
                      asset.metadata?.title ?? "Untitled asset",
                      "asset"
                    )
                  );
                }}
              >
                ${asset.metadata?.title}
              </button>
            </li>`;
          })}
        </menu>
      </section>

      <section id="tools">
        <h3>Tools</h3>
        <menu>
          ${tools.map((tool) => {
            return html`<li>
              <button
                @click=${() => {
                  this.dispatchEvent(
                    new FastAccessSelectEvent(
                      tool.url,
                      tool.title ?? "Untitled tool",
                      "tool"
                    )
                  );
                }}
              >
                ${tool.title}
              </button>
            </li>`;
          })}
        </menu>
      </section>

      <section id="outputs">
        <h3>Outputs</h3>
        <menu>
          ${components.map((component) => {
            return html`<li>
              <button
                @click=${() => {
                  this.dispatchEvent(
                    new FastAccessSelectEvent(
                      component.id,
                      component.title,
                      "output"
                    )
                  );
                }}
              >
                ${component.title}
              </button>
            </li>`;
          })}
        </menu>
      </section>`;
  }
}
