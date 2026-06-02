import { html, TemplateResult } from "lit";
import type { SessionLogEntry } from "../../../../../sca/types.js";

export function renderGraphUpdateTheme(
  entry: SessionLogEntry,
  timeString: string
): TemplateResult {
  const args = (entry.args || {}) as Record<string, unknown>;
  const themeIntent =
    typeof args.theme_intent === "string" ? args.theme_intent : null;

  // Title and description are returned in the response (they're read from
  // the graph at dispatch time so the splash-image generator always has them).
  const resp = (entry.response || {}) as Record<string, unknown>;
  const title = typeof resp.title === "string" ? resp.title : null;
  const description =
    typeof resp.description === "string" ? resp.description : null;

  return html`
    <div class="call-entry">
      <div class="call-header">
        <span class="header-title"
          ><span class="g-icon header-icon">palette</span> Updated Theme</span
        >
        <span class="timestamp">${timeString}</span>
      </div>
      <div class="call-details">
        ${title
          ? html`
              <div>
                <div class="label">Graph Title:</div>
                <code class="thought-body">${title}</code>
              </div>
            `
          : ""}
        ${description
          ? html`
              <div>
                <div class="label">Graph Description:</div>
                <code class="thought-body">${description}</code>
              </div>
            `
          : ""}
        ${themeIntent
          ? html`
              <div>
                <div class="label">Theme Vibe:</div>
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
