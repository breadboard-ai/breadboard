import { html, TemplateResult } from "lit";
import type { SessionLogEntry } from "../../../../../sca/types.js";

export function renderGraphEditProperties(
  entry: SessionLogEntry,
  timeString: string
): TemplateResult {
  const args = (entry.args || {}) as Record<string, unknown>;
  const title = typeof args.title === "string" ? args.title : null;
  const description =
    typeof args.description === "string" ? args.description : null;
  const themeIntent =
    typeof args.theme_intent === "string" ? args.theme_intent : null;

  return html`
    <div class="call-entry">
      <div class="call-header">
        <span class="header-title"
          ><span class="g-icon header-icon">edit</span> Edited Graph
          Properties</span
        >
        <span class="timestamp">${timeString}</span>
      </div>
      <div class="call-details">
        ${title
          ? html`
              <div>
                <div class="label">New Title:</div>
                <code class="thought-body">${title}</code>
              </div>
            `
          : ""}
        ${description
          ? html`
              <div>
                <div class="label">New Description:</div>
                <code class="thought-body">${description}</code>
              </div>
            `
          : ""}
        ${themeIntent
          ? html`
              <div>
                <div class="label">Generated Theme Vibe:</div>
                <code class="thought-body">${themeIntent}</code>
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
