// Copyright 2026 Google LLC
// SPDX-License-Identifier: Apache-2.0

/**
 * Shared task list — backed by a Yjs Y.Array.
 *
 * Each task is a Y.Map with `text`, `done`, `addedBy`, and `completedBy`
 * fields. Checking/unchecking syncs across all connected clients.
 */

import { LitElement, html, css, nothing } from "lit";
import { customElement, state, query } from "lit/decorators.js";
import { doc } from "./sync.js";
import { getIdentity } from "./identity.js";
import * as Y from "yjs";

interface TaskEntry {
  text: string;
  done: boolean;
  addedBy: string;
  completedBy: string;
}

const taskArray = doc.getArray<Y.Map<string | boolean>>("tasks");

@customElement("party-task-list")
export class PartyTaskList extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .add-row {
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
    }

    .add-row input {
      flex: 1;
    }

    .task-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .task-entry {
      display: flex;
      align-items: center;
      padding: 8px 10px;
      border-radius: 6px;
      background: var(--color-surface-alt, #22222e);
      font-size: 14px;
      gap: 10px;
      transition: background 0.15s;
    }

    .task-entry:hover {
      background: var(--color-border, #2e2e3e);
    }

    .task-entry input[type="checkbox"] {
      width: 16px;
      height: 16px;
      accent-color: var(--color-accent, #7c6cff);
      cursor: pointer;
      flex-shrink: 0;
    }

    .task-text {
      flex: 1;
    }

    .task-text.done {
      text-decoration: line-through;
      color: var(--color-text-muted, #8888a0);
    }

    .meta {
      font-size: 11px;
      color: var(--color-text-muted, #8888a0);
    }

    .remove-btn {
      background: transparent;
      color: var(--color-danger, #f87171);
      padding: 2px 8px;
      font-size: 12px;
      opacity: 0;
      transition: opacity 0.15s;
    }

    .task-entry:hover .remove-btn {
      opacity: 1;
    }

    .progress {
      font-size: 12px;
      color: var(--color-text-muted, #8888a0);
      margin-bottom: 8px;
    }

    .progress-bar {
      height: 3px;
      background: var(--color-surface-alt, #22222e);
      border-radius: 2px;
      margin-bottom: 12px;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      background: var(--color-accent, #7c6cff);
      border-radius: 2px;
      transition: width 0.3s ease;
    }

    .empty {
      font-size: 13px;
      color: var(--color-text-muted, #8888a0);
      font-style: italic;
      padding: 8px 0;
    }
  `;

  @state() private tasks: TaskEntry[] = [];
  @query("input[type='text']") private input!: HTMLInputElement;

  connectedCallback() {
    super.connectedCallback();
    taskArray.observeDeep(this.#handleChange);
    this.#handleChange();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    taskArray.unobserveDeep(this.#handleChange);
  }

  #handleChange = () => {
    this.tasks = taskArray.toArray().map((ymap) => ({
      text: (ymap.get("text") as string) || "",
      done: (ymap.get("done") as boolean) || false,
      addedBy: (ymap.get("addedBy") as string) || "unknown",
      completedBy: (ymap.get("completedBy") as string) || "",
    }));
  };

  #addTask() {
    const text = this.input?.value?.trim();
    if (!text) return;

    const identity = getIdentity();
    const taskMap = new Y.Map<string | boolean>();
    taskMap.set("text", text);
    taskMap.set("done", false);
    taskMap.set("addedBy", identity?.name || "anonymous");
    taskMap.set("completedBy", "");
    taskArray.push([taskMap]);

    this.input.value = "";
    this.input.focus();
  }

  #toggleTask(index: number) {
    const ymap = taskArray.get(index);
    if (!ymap) return;

    const identity = getIdentity();
    const newDone = !ymap.get("done");
    ymap.set("done", newDone);
    ymap.set("completedBy", newDone ? identity?.name || "someone" : "");
  }

  #removeTask(index: number) {
    taskArray.delete(index, 1);
  }

  #handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") this.#addTask();
  }

  get #doneCount() {
    return this.tasks.filter((t) => t.done).length;
  }

  get #progressPercent() {
    if (this.tasks.length === 0) return 0;
    return (this.#doneCount / this.tasks.length) * 100;
  }

  render() {
    return html`
      <h2>Tasks</h2>

      ${this.tasks.length > 0
        ? html`
            <div class="progress">
              ${this.#doneCount} of ${this.tasks.length} complete
            </div>
            <div class="progress-bar">
              <div
                class="progress-fill"
                style="width: ${this.#progressPercent}%"
              ></div>
            </div>
          `
        : nothing}

      <div class="add-row">
        <input
          type="text"
          placeholder="Add a task…"
          @keydown=${this.#handleKeydown}
        />
        <button @click=${this.#addTask}>Add</button>
      </div>

      <div class="task-list">
        ${this.tasks.length === 0
          ? html`<div class="empty">No tasks yet — add one!</div>`
          : this.tasks.map(
              (task, i) => html`
                <div class="task-entry">
                  <input
                    type="checkbox"
                    .checked=${task.done}
                    @change=${() => this.#toggleTask(i)}
                  />
                  <span class="task-text ${task.done ? "done" : ""}">
                    ${task.text}
                  </span>
                  ${task.completedBy
                    ? html`<span class="meta">✓ ${task.completedBy}</span>`
                    : html`<span class="meta">by ${task.addedBy}</span>`}
                  <button
                    class="remove-btn"
                    @click=${() => this.#removeTask(i)}
                  >
                    ✕
                  </button>
                </div>
              `
            )}
      </div>
    `;
  }
}
