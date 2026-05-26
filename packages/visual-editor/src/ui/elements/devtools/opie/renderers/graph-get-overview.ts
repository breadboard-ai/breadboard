import { html, TemplateResult } from "lit";
import type { SessionLogEntry } from "../../../../../sca/types.js";

export function renderGraphGetOverview(entry: SessionLogEntry, timeString: string): TemplateResult {
  const response = (entry.response || {}) as Record<string, unknown>;
  const overview = typeof response.overview === "string" ? response.overview : "";

  return html`
    <div class="call-entry">
      <div class="call-header">
        <span class="header-title"
          ><span class="g-icon header-icon">preview</span> Inspected Graph Overview</span
        >
        <span class="timestamp">${timeString}</span>
      </div>
      <div class="call-details">
        ${overview
          ? html`
              <div>
                <div class="label">YAML Overview:</div>
                <pre class="request-pre">${overview}</pre>
              </div>
            `
          : html`<pre class="waiting-pre">Waiting for response...</pre>`}
      </div>
    </div>
  `;
}
