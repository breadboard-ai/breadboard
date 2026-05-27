import { LitElement, html, css, TemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";
import { SignalWatcher } from "@lit-labs/signals";
import { icons } from "../../../styles/icons.js";
import { markdown } from "../../../directives/markdown.js";
import { parseThought } from "../../../../a2/agent/thought-parser.js";
import { keyed } from "lit/directives/keyed.js";
import { renderCall } from "./registry.js";
import type { SessionLogEntry } from "../../../../sca/types.js";
import type { FunctionDeclaration } from "../../../../a2/a2/gemini.js";
import "../../json-tree/json-tree.js";

@customElement("bb-devtools-opie-panel")
export class DevToolsOpiePanel extends SignalWatcher(LitElement) {
  @property({ type: Array })
  accessor entries: readonly SessionLogEntry[] = [];

  @property({ type: String })
  accessor systemInstruction = "";

  @property({ type: Array })
  accessor functions: readonly FunctionDeclaration[] = [];

  static styles = [
    icons,
    css`
      * {
        box-sizing: border-box;
      }

      :host {
        display: flex;
        flex-direction: row;
        width: 100%;
        height: 100%;
        min-height: 0;
        gap: var(--bb-grid-size-3);
        overflow: hidden;
        font-family: var(--bb-font-family, sans-serif);
        color: var(--light-dark-n-10);
      }

      .devtools-column-left {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: var(--bb-grid-size-4);
        min-height: 0;
        overflow: hidden;
      }

      .devtools-column-right {
        flex: 1.2;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: var(--bb-grid-size-4);
        overflow-y: auto;
      }

      .column-inner {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-height: 0;
        overflow: hidden;
      }

      .scroll-container {
        flex: 1;
        overflow-y: auto;
        padding-right: var(--bb-grid-size);
      }

      .header-title {
        display: flex;
        align-items: center;
        gap: var(--bb-grid-size);
      }

      .header-icon {
        font-size: var(--bb-label-large);
      }

      .request-pre {
        white-space: pre-wrap;
        margin: 0;
        background: var(--light-dark-n-100);
        border: 1px solid var(--light-dark-n-95);
        padding: var(--bb-grid-size-3);
        border-radius: var(--bb-grid-size);
        font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
          var(--bb-font-family-mono, monospace);
        overflow-x: auto;
      }

      .waiting-pre {
        color: var(--light-dark-n-40);
        font-style: italic;
        margin: 0;
        background: var(--light-dark-n-100);
        border: 1px solid var(--light-dark-n-95);
        padding: var(--bb-grid-size-3);
        border-radius: var(--bb-grid-size);
        font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
          var(--bb-font-family-mono, monospace);
        overflow-x: auto;
      }

      .function-wrap {
        display: flex;
        flex-wrap: wrap;
        gap: var(--bb-grid-size);
      }

      .section {
        background: var(--light-dark-n-100);
        border: 1px solid var(--light-dark-n-90);
        border-radius: var(--bb-grid-size-2);
        padding: var(--bb-grid-size-4);
        display: flex;
        flex-direction: column;
        gap: var(--bb-grid-size-3);

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

      .si-section {
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      .markdown-container {
        flex: 1;
        overflow-y: auto;
        min-height: 0;
        padding-right: var(--bb-grid-size);
      }

      .functions-section {
        flex-shrink: 0;
      }

      .markdown-body {
        font: 400 var(--bb-body-medium) / var(--bb-body-line-height-medium)
          var(--bb-font-family);
        color: var(--light-dark-n-15);

        & p {
          margin: 0 0 var(--bb-grid-size-3) 0;
          &:last-child {
            margin-bottom: 0;
          }
        }

        & code {
          background: var(--light-dark-n-95);
          padding: 2px 4px;
          border-radius: 3px;
          font-family: var(--bb-font-family-mono, monospace);
          font-size: var(--bb-body-small);
        }

        & ul,
        & ol {
          margin: 0 0 var(--bb-grid-size-3) 0;
          padding-left: var(--bb-grid-size-4);
        }

        & h2,
        & h3 {
          margin: var(--bb-grid-size-4) 0 var(--bb-grid-size-2) 0;
          font-family: var(--bb-font-family);
          color: var(--light-dark-n-10);
          border-bottom: none;
          padding-bottom: 0;
        }

        & h2 {
          font: 600 var(--bb-label-large) / var(--bb-label-line-height-large);
        }

        & h3 {
          font: 600 var(--bb-label-medium) / var(--bb-label-line-height-medium);
        }
      }

      .function-tag {
        display: inline-flex;
        align-items: center;
        background: var(--light-dark-n-90);
        color: var(--light-dark-n-20);
        padding: var(--bb-grid-size) var(--bb-grid-size-3);
        border-radius: var(--bb-grid-size-5);
        font: 500 var(--bb-label-small) / var(--bb-label-line-height-small)
          var(--bb-font-family-mono, monospace);
        border: 1px solid var(--light-dark-n-80);
        transition: background-color 0.2s, color 0.2s, box-shadow 0.2s;
      }

      @keyframes flash-chip {
        0% {
          background: var(--light-dark-p-90);
          color: var(--light-dark-p-20);
          box-shadow: 0 0 6px oklch(from var(--light-dark-p-40) l c h / 0.2);
          border-color: var(--light-dark-p-40);
        }
        30% {
          background: var(--light-dark-p-85);
          color: var(--light-dark-p-15);
          box-shadow: 0 0 10px oklch(from var(--light-dark-p-40) l c h / 0.3);
          border-color: var(--light-dark-p-40);
        }
        100% {
          background: var(--light-dark-n-90);
          color: var(--light-dark-n-20);
          box-shadow: 0 0 0 transparent;
          border-color: var(--light-dark-n-80);
        }
      }

      .function-tag.flash {
        animation: flash-chip 1.2s cubic-bezier(0.16, 1, 0.3, 1);
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

        &.objective {
          border-left: 4px solid var(--light-dark-p-40);
          background: var(--light-dark-n-100);
          & .call-header {
            background: var(--light-dark-n-98);
            color: var(--light-dark-p-20);
          }
        }

        &.thought {
          border-left: 4px solid var(--light-dark-s-40);
          background: var(--light-dark-n-98);
          & .call-header {
            background: var(--light-dark-n-95);
            color: var(--light-dark-s-20);
          }
          & .thought-body {
            padding: var(--bb-grid-size-3);
            font: 400 var(--bb-body-medium) / var(--bb-body-line-height-medium)
              var(--bb-font-family);
            color: var(--light-dark-n-15);
          }
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
    const { entries, systemInstruction, functions } = this;
    return html`
      <div class="devtools-column-left">
        <div class="section si-section">
          <h3><span class="g-icon">description</span> System Instruction</h3>
          ${systemInstruction
            ? html`<div class="markdown-container">
                <div class="markdown-body">${markdown(systemInstruction)}</div>
              </div>`
            : html`<div class="empty-state">No system instruction defined yet.</div>`}
        </div>

        <div class="section functions-section">
          <h3><span class="g-icon">extension</span> Configured Functions</h3>
          ${functions && functions.length > 0
            ? html`
                <div class="function-wrap">
                  ${functions.map((fn) => {
                    const lastCallEntry = entries
                      ? [...entries].reverse().find((e) => e.kind === "call")
                      : null;
                    const isLastCall = lastCallEntry && lastCallEntry.name === fn.name;
                    const lastCallId = isLastCall
                      ? lastCallEntry.callId || String(lastCallEntry.timestamp)
                      : "none";
                    const content = html`<span
                      class="function-tag ${isLastCall ? "flash" : ""}"
                      title=${fn.description || ""}
                      >${fn.name}</span
                    >`;
                    return isLastCall ? keyed(lastCallId, content) : content;
                  })}
                </div>
              `
            : html`<div class="empty-state">No functions configured yet.</div>`}
        </div>
      </div>

      <div class="devtools-column-right">
        <div class="section column-inner">
          <h3><span class="g-icon">history</span> Session Log</h3>
          <div class="scroll-container">
            ${entries && entries.length > 0
              ? html`
                  <div class="call-log">
                    ${entries.map((entry) => {
                      const date = new Date(entry.timestamp);
                      const timeString = date.toLocaleTimeString();

                      if (entry.kind === "thought") {
                        const rawThought = String(
                          entry.args.thought || entry.args.text || ""
                        );
                        const parsed = parseThought(rawThought);

                        return html`
                          <div class="call-entry thought">
                            <div class="call-header">
                              <span class="header-title"
                                ><span class="g-icon header-icon">spark</span> ${parsed.title
                                  ? parsed.title
                                  : "thought"}</span
                              >
                              <span class="timestamp">${timeString}</span>
                            </div>
                            <div class="thought-body markdown-body">
                              ${markdown(parsed.body)}
                            </div>
                          </div>
                        `;
                      }

                      if (entry.kind === "objective") {
                        return html`
                          <div class="call-entry objective">
                            <div class="call-header">
                              <span class="header-title"
                                ><span class="g-icon header-icon">start</span> objective</span
                              >
                              <span class="timestamp">${timeString}</span>
                            </div>
                            <div class="call-details">
                              <div>
                                <div class="label">Initial Request:</div>
                                <pre class="request-pre">${
                                  entry.args.user_request ||
                                  entry.args.request ||
                                  ""
                                }</pre>
                              </div>
                            </div>
                          </div>
                        `;
                      }

                      return renderCall(entry, timeString);
                    })}
                  </div>
                `
              : html`<div class="empty-state">No entries in session log yet.</div>`}
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bb-devtools-opie-panel": DevToolsOpiePanel;
  }
}
