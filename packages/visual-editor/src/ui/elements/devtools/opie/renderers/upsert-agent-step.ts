import { html, TemplateResult } from "lit";
import type { SessionLogEntry } from "../../../../../sca/types.js";

export function renderUpsertAgentStep(entry: SessionLogEntry, timeString: string): TemplateResult {
  const args = (entry.args || {}) as Record<string, unknown>;
  const stepId = typeof args.step_id === "string" ? args.step_id : "New Step";
  const title = typeof args.title === "string" ? args.title : "";
  const prompt = typeof args.prompt === "string" ? args.prompt : "";

  return html`
    <div class="call-entry">
      <div class="call-header">
        <span class="header-title"
          ><span class="g-icon header-icon">edit</span> Upsert Step: ${stepId}</span
        >
        <span class="timestamp">${timeString}</span>
      </div>
      <div class="call-details">
        ${title
          ? html`
              <div>
                <div class="label">Step Title:</div>
                <div class="thought-body" style="padding: var(--bb-grid-size); background: var(--light-dark-n-95); border-radius: var(--bb-grid-size); margin-bottom: var(--bb-grid-size-2);">
                  <strong>${title}</strong>
                </div>
              </div>
            `
          : ""}
        ${prompt
          ? html`
              <div>
                <div class="label">Prompt:</div>
                <pre class="request-pre">${prompt}</pre>
              </div>
            `
          : ""}
        ${entry.response
          ? html`
              <div>
                <div class="label">Result:</div>
                <bb-json-tree
                  .json=${entry.response as Record<string, unknown>}
                  .autoExpand=${true}
                ></bb-json-tree>
              </div>
            `
          : html`<pre class="waiting-pre">Waiting for response...</pre>`}
      </div>
    </div>
  `;
}
