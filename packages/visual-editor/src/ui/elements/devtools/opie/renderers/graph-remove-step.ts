import { html, TemplateResult } from "lit";
import type { SessionLogEntry } from "../../../../../sca/types.js";

export function renderGraphRemoveStep(entry: SessionLogEntry, timeString: string): TemplateResult {
  const args = (entry.args || {}) as Record<string, unknown>;
  const stepId = typeof args.step_id === "string" ? args.step_id : "unknown";

  return html`
    <div class="call-entry">
      <div class="call-header">
        <span class="header-title"
          ><span class="g-icon header-icon">delete</span> Removed Step</span
        >
        <span class="timestamp">${timeString}</span>
      </div>
      <div class="call-details">
        <div>
          <div class="label">Target Step:</div>
          <code class="thought-body">${stepId}</code>
        </div>
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
