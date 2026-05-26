import { html, TemplateResult } from "lit";
import type { SessionLogEntry } from "../../../../../sca/types.js";
import { markdown } from "../../../../directives/markdown.js";

export function renderWaitForUserInput(entry: SessionLogEntry, timeString: string): TemplateResult {
  const args = (entry.args || {}) as Record<string, unknown>;
  const message = typeof args.message === "string" ? args.message : "";
  const response = (entry.response || {}) as Record<string, unknown>;
  const userMessage = typeof response.user_message === "string" ? response.user_message : "";
  const currentGraph = typeof response.current_graph === "string" ? response.current_graph : "";
  const selectedSteps = typeof response.selected_steps === "string" ? response.selected_steps : "";
  const graphChanges = typeof response.graph_changes === "string" ? response.graph_changes : "";

  return html`
    <div class="call-entry thought">
      <div class="call-header">
        <span class="header-title"
          ><span class="g-icon header-icon">pending</span> Waiting for User Input</span
        >
        <span class="timestamp">${timeString}</span>
      </div>
      <div class="call-details">
        ${message
          ? html`
              <div>
                <div class="label">Agent Message:</div>
                <div class="thought-body markdown-body">${markdown(message)}</div>
              </div>
            `
          : ""}
        ${userMessage
          ? html`
              <div>
                <div class="label">User Response:</div>
                <pre class="request-pre">${userMessage}</pre>
              </div>
            `
          : html`<pre class="waiting-pre">Waiting for response...</pre>`}
        ${graphChanges
          ? html`
              <div>
                <div class="label">Graph Changes:</div>
                <div class="thought-body markdown-body">${markdown(graphChanges)}</div>
              </div>
            `
          : ""}
        ${selectedSteps
          ? html`
              <div>
                <div class="label">Selected Steps:</div>
                <div class="thought-body markdown-body">${markdown(selectedSteps)}</div>
              </div>
            `
          : ""}
        ${currentGraph
          ? html`
              <div>
                <div class="label">Current Graph:</div>
                <pre class="request-pre">${currentGraph}</pre>
              </div>
            `
          : ""}
      </div>
    </div>
  `;
}
