import { html, TemplateResult } from "lit";
import type { SessionLogEntry } from "../../../../../sca/types.js";

export function renderUpsertLegacyStep(
  entry: SessionLogEntry,
  timeString: string
): TemplateResult {
  const args = (entry.args || {}) as Record<string, unknown>;
  const stepId = typeof args.step_id === "string" ? args.step_id : "New Step";
  const stepType = typeof args.step_type === "string" ? args.step_type : "";
  const title = typeof args.title === "string" ? args.title : "";
  const prompt = typeof args.prompt === "string" ? args.prompt : "";
  const options =
    args.options && typeof args.options === "object"
      ? (args.options as Record<string, unknown>)
      : null;

  return html`
    <div class="call-entry">
      <div class="call-header">
        <span class="header-title"
          ><span class="g-icon header-icon">edit</span> Upsert Legacy Step:
          ${stepId}</span
        >
        <span class="timestamp">${timeString}</span>
      </div>
      <div class="call-details">
        ${stepType
          ? html`
              <div>
                <div class="label">Step Type:</div>
                <div
                  class="thought-body"
                  style="padding: var(--bb-grid-size); background: var(--light-dark-n-95); border-radius: var(--bb-grid-size); margin-bottom: var(--bb-grid-size-2);"
                >
                  <code>${stepType}</code>
                </div>
              </div>
            `
          : ""}
        ${title
          ? html`
              <div>
                <div class="label">Step Title:</div>
                <div
                  class="thought-body"
                  style="padding: var(--bb-grid-size); background: var(--light-dark-n-95); border-radius: var(--bb-grid-size); margin-bottom: var(--bb-grid-size-2);"
                >
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
        ${options && Object.keys(options).length > 0
          ? html`
              <div>
                <div class="label">Options:</div>
                <bb-json-tree
                  .json=${options}
                  .autoExpand=${true}
                ></bb-json-tree>
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
