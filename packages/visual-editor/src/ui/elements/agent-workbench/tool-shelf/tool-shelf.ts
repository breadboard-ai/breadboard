/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css, nothing } from "lit";
import { customElement } from "lit/decorators.js";
import { SignalWatcher } from "@lit-labs/signals";
import { consume } from "@lit/context";
import { scaContext } from "../../../../sca/context/context.js";
import { type SCA } from "../../../../sca/sca.js";
import { Template } from "@breadboard-ai/utils";
import type { Tool } from "../../../../sca/types.js";
import { iconSubstitute } from "../../../utils/icon-substitute.js";
import * as Styles from "../../../styles/styles.js";
import { extractPromptText } from "../../../../utils/prompt-utils.js";

@customElement("bb-tool-shelf")
export class ToolShelf extends SignalWatcher(LitElement) {
  @consume({ context: scaContext })
  accessor sca!: SCA;

  static styles = [
    Styles.HostType.type,
    Styles.HostIcons.icons,
    Styles.HostColorsBase.baseColors,
    Styles.HostColorScheme.match,
    css`
      * {
        box-sizing: border-box;
      }

      :host {
        display: block;
        width: 100%;
        background: transparent;
      }

      .tool-shelf-wrapper {
        display: flex;
        flex-direction: column;
        width: 100%;
        background: transparent;
        overflow: hidden;
      }

      .section-header {
        display: flex;
        align-items: center;
        margin-bottom: var(--bb-grid-size-7);
        user-select: none;

        & h2 {
          margin: 0;
          flex: 1;
          font: 500 var(--bb-label-large) / var(--bb-label-line-height-large)
            var(--bb-font-family);
          color: var(--light-dark-n-20);
        }
      }

      .tools-list {
        display: flex;
        flex-direction: column;
        padding: var(--bb-grid-size) 0;
      }

      .tool-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--bb-grid-size-2) 0;
      }

      .tool-info-wrapper {
        display: flex;
        align-items: center;
        min-width: 0;
        flex: 1;
      }

      .tool-icon-container {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        border-radius: var(--bb-grid-size-2);
        background: var(--light-dark-n-95);
        margin-right: var(--bb-grid-size-5);
        flex-shrink: 0;

        & .g-icon {
          font-size: 20px;
          color: var(--light-dark-n-30);
        }

        &.weather {
          background: #fff9c4;
          & .g-icon {
            color: #fbc02d;
          }
        }
        &.search {
          background: #e3f2fd;
          & .g-icon {
            color: #1976d2;
          }
        }
        &.language {
          background: #e8f5e9;
          & .g-icon {
            color: #388e3c;
          }
        }
        &.maps {
          background: #f3e5f5;
          & .g-icon {
            color: #7b1fa2;
          }
        }
        &.code {
          background: #efebe9;
          & .g-icon {
            color: #5d4037;
          }
        }
        &.sub-graph {
          background: #f1f8e9;
          & .g-icon {
            color: #558b2f;
          }
        }
      }

      .tool-details {
        display: flex;
        flex-direction: column;
        min-width: 0;
        padding-right: var(--bb-grid-size-4);
      }

      .tool-title {
        font: 500 var(--bb-label-medium) / var(--bb-label-line-height-medium)
          var(--bb-font-family);
        color: light-dark(var(--n-10), var(--n-90));
        margin-bottom: 2px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .tool-description {
        font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
          var(--bb-font-family);
        color: var(--light-dark-n-40);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      /* Toggle Switch */
      .switch {
        position: relative;
        display: inline-block;
        width: 52px;
        height: 32px;
        flex-shrink: 0;
      }

      .switch input {
        opacity: 0;
        width: 0;
        height: 0;
      }

      .slider {
        position: absolute;
        cursor: pointer;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: light-dark(#f1f3f4, var(--n-20));
        transition: background-color 0.15s cubic-bezier(0.4, 0, 0.2, 1);
        border-radius: 16px;
      }

      .slider:before {
        position: absolute;
        content: "";
        height: 16px;
        width: 16px;
        left: 8px;
        top: 8px;
        background-color: light-dark(#bdc1c6, var(--n-50));
        transition:
          transform 0.15s cubic-bezier(0.4, 0, 0.2, 1),
          background-color 0.15s ease;
        border-radius: 50%;
        transform-origin: center;
      }

      input:checked + .slider {
        background-color: light-dark(#137333, #34a853);
      }

      input:focus + .slider {
        box-shadow: 0 0 1px light-dark(#137333, #34a853);
      }

      input:checked + .slider:before {
        transform: translateX(20px) scale(1.5);
        background-color: white;
      }
    `,
  ];

  #onToggle(tool: Tool, enabled: boolean) {
    this.sca.actions.workbench.toggleTool(
      tool.url,
      tool.title ?? "Tool",
      enabled
    );
  }

  render() {
    const graphController = this.sca?.controller?.editor?.graph;
    if (!graphController) return nothing;

    // Read graph version to subscribe to graph changes via SignalWatcher
    void graphController.version;

    const graph = graphController.graph;
    const agentNode = graph.nodes?.find(
      (n) => n.configuration?.["generation-mode"] === "agent"
    );
    if (!agentNode) return nothing;

    const config = agentNode.configuration ?? {};
    const promptText = extractPromptText(config["config$prompt"]);

    // Find currently enabled tool paths
    const template = new Template(promptText);
    const enabledToolUrls = new Set(
      template.placeholders.filter((p) => p.type === "tool").map((p) => p.path)
    );

    // Build the list of all tools
    const envName = this.sca.env.environmentName;
    const allTools: Array<{ tool: Tool; categoryClass: string }> = [];

    // Static tools
    for (const tool of graphController.tools.values()) {
      if (envName && tool.tags) {
        let excluded = false;
        for (const tag of tool.tags) {
          if (
            tag.startsWith("environment") &&
            tag !== `environment-${envName}`
          ) {
            excluded = true;
            break;
          }
        }
        if (excluded) continue;
      }

      let categoryClass = "tool";
      if (tool.url.includes("weather")) {
        categoryClass = "weather";
      } else if (tool.url.includes("search-web")) {
        categoryClass = "search";
      } else if (tool.url.includes("get-webpage")) {
        categoryClass = "language";
      } else if (tool.url.includes("search-maps")) {
        categoryClass = "maps";
      } else if (tool.url.includes("code-execution")) {
        categoryClass = "code";
      }

      allTools.push({ tool, categoryClass });
    }

    // Dynamic sub-graph tools
    for (const tool of graphController.myTools.values()) {
      allTools.push({ tool, categoryClass: "sub-graph" });
    }

    if (allTools.length === 0) {
      return nothing;
    }

    return html`
      <div class="tool-shelf-wrapper">
        <div class="section-header">
          <h2>Tools & Skills</h2>
        </div>
        <div class="tools-list">
          ${allTools.map(({ tool, categoryClass }) => {
            const isEnabled = enabledToolUrls.has(tool.url);
            const icon =
              typeof tool.icon === "string"
                ? (iconSubstitute(tool.icon) ?? "tool")
                : "tool";

            return html`
              <div class="tool-row">
                <div class="tool-info-wrapper">
                  <div class="tool-icon-container ${categoryClass}">
                    <span class="g-icon round filled">${icon}</span>
                  </div>
                  <div class="tool-details">
                    <div class="tool-title">${tool.title}</div>
                    <div class="tool-description">${tool.description}</div>
                  </div>
                </div>
                <label class="switch">
                  <input
                    type="checkbox"
                    ?checked=${isEnabled}
                    @change=${(evt: Event & { target: HTMLInputElement }) => {
                      this.#onToggle(tool, evt.target.checked);
                    }}
                  />
                  <span class="slider"></span>
                </label>
              </div>
            `;
          })}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bb-tool-shelf": ToolShelf;
  }
}
