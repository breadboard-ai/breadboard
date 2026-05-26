import { html, TemplateResult } from "lit";
import type { SessionLogEntry } from "../../../../../sca/types.js";

export function renderDefaultCall(entry: SessionLogEntry, timeString: string): TemplateResult {
  return html`
    <div class="call-entry">
      <div class="call-header">
        <span class="header-title"
          ><span class="g-icon header-icon">home_repair_service</span> ${entry.name}</span
        >
        <span class="timestamp">${timeString}</span>
      </div>
      <div class="call-details">
        <div>
          <div class="label">Arguments:</div>
          <bb-json-tree
            .json=${entry.args as Record<string, unknown>}
            .autoExpand=${true}
          ></bb-json-tree>
        </div>
        <div>
          <div class="label">Response:</div>
          ${entry.response
            ? html`<bb-json-tree
                .json=${entry.response as Record<string, unknown>}
                .autoExpand=${true}
              ></bb-json-tree>`
            : html`<pre class="waiting-pre">Waiting for response...</pre>`}
        </div>
      </div>
    </div>
  `;
}
