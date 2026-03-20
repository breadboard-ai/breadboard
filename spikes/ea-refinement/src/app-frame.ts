/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * App Frame — version stack with promote/discard.
 *
 * Shows a "current" version (left) and optionally a "candidate" version
 * (right) with promote/discard buttons. The current iframe is NEVER
 * destroyed during candidate loading — layout updates are incremental.
 */

export { AppFrame };
export type { VersionState };

interface VersionState {
  code: string;
  files: Record<string, string>;
  version: number;
  label: string;
}

class AppFrame {
  #container: HTMLElement;
  #current: VersionState | null = null;
  #candidate: VersionState | null = null;
  #versionCounter = 0;
  #onPromote: ((promoted: VersionState) => void) | null = null;
  #onDiscard: (() => void) | null = null;

  // Persistent DOM references — never destroyed during candidate work.
  #currentWrapper: HTMLElement | null = null;
  #candidateWrapper: HTMLElement | null = null;

  constructor(container: HTMLElement) {
    this.#container = container;
    this.#container.className = "frame-area";
    this.#ensureSlots();
  }

  set onPromote(fn: (promoted: VersionState) => void) {
    this.#onPromote = fn;
  }

  set onDiscard(fn: () => void) {
    this.#onDiscard = fn;
  }

  get currentFiles(): Record<string, string> | null {
    return this.#current?.files ?? null;
  }

  get currentVersion(): number {
    return this.#current?.version ?? 0;
  }

  get hasBaseline(): boolean {
    return this.#current !== null;
  }

  /** The files to refine against — candidate if iterating, else current. */
  get workingFiles(): Record<string, string> | null {
    return this.#candidate?.files ?? this.#current?.files ?? null;
  }

  /** The version of the working head. */
  get workingVersion(): number {
    return this.#candidate?.version ?? this.#current?.version ?? 0;
  }

  /** Set the baseline (first generation). */
  async setBaseline(code: string, files: Record<string, string>) {
    this.#versionCounter++;
    this.#current = {
      code,
      files,
      version: this.#versionCounter,
      label: `v${this.#versionCounter}`,
    };
    this.#candidate = null;

    this.#updateCurrentHeader();
    this.#resetCandidateSlot();
    await this.#renderIframe(this.#currentWrapper!, code);
  }

  /** Set a candidate (refinement result) alongside the current. */
  async setCandidate(code: string, files: Record<string, string>) {
    this.#versionCounter++;
    this.#candidate = {
      code,
      files,
      version: this.#versionCounter,
      label: `v${this.#versionCounter}`,
    };

    this.#updateCandidateHeader();
    await this.#renderIframe(this.#candidateWrapper!, code);
  }

  /**
   * Preview a historical run in the candidate slot.
   * Does NOT increment the version counter — this is a replay, not a new
   * generation. Promoting it will make it the current version.
   */
  async previewRun(code: string, files: Record<string, string>, label: string) {
    this.#ensureSlots();
    this.#candidate = {
      code,
      files,
      version: -1, // Replayed, not a new version.
      label,
    };

    this.#updateCandidateHeader();
    await this.#renderIframe(this.#candidateWrapper!, code);
  }

  /** Show loading state for a slot. Does NOT touch the other slot. */
  showLoading(slot: "current" | "candidate") {
    this.#ensureSlots();
    const wrapper =
      slot === "current" ? this.#currentWrapper! : this.#candidateWrapper!;

    // Only replace the content area; leave the other slot alone.
    const content = wrapper.querySelector(".frame-content")!;
    content.innerHTML = `
      <div class="frame-loading">
        <div class="spinner"></div>
        <span>${slot === "current" ? "Generating baseline…" : "Refining…"}</span>
        <div class="stream-preview"></div>
      </div>
    `;

    if (slot === "current") {
      this.#updateLabel(wrapper, "Generating…");
    } else {
      this.#updateLabel(wrapper, "Refining…");
      this.#clearCandidateActions();
    }
  }

  /** Append streaming text to the loading indicator. */
  appendStreamText(slot: "current" | "candidate", text: string) {
    const wrapper =
      slot === "current" ? this.#currentWrapper : this.#candidateWrapper;
    const preview = wrapper?.querySelector(".stream-preview");
    if (preview) {
      preview.textContent += text;
      preview.scrollTop = preview.scrollHeight;
    }
  }

  showError(slot: "current" | "candidate", message: string) {
    const wrapper =
      slot === "current" ? this.#currentWrapper : this.#candidateWrapper;
    const content = wrapper?.querySelector(".frame-content");
    if (content) {
      content.innerHTML = `
        <div class="frame-error">
          <span class="material-symbols-outlined">error</span>
          <p>${escapeHtml(message)}</p>
        </div>
      `;
    }
  }

  // ─── Incremental DOM Management ──────────────────────────────────

  /** Ensure both slot wrappers exist. Called once at construction. */
  #ensureSlots() {
    if (!this.#currentWrapper) {
      this.#currentWrapper = this.#createSlotWrapper("current", "Baseline");
      this.#container.appendChild(this.#currentWrapper);
    }
    if (!this.#candidateWrapper) {
      this.#candidateWrapper = this.#createSlotWrapper(
        "candidate",
        "Refinement will appear here"
      );
      this.#container.appendChild(this.#candidateWrapper);
    }
  }

  #createSlotWrapper(slot: string, label: string): HTMLElement {
    const wrapper = document.createElement("div");
    wrapper.className = "frame-wrapper empty";
    wrapper.dataset.slot = slot;

    const header = document.createElement("div");
    header.className = "frame-header";

    const labelEl = document.createElement("span");
    labelEl.className = "frame-label";
    labelEl.textContent = label;
    header.appendChild(labelEl);

    const content = document.createElement("div");
    content.className = "frame-content";
    content.innerHTML = `
      <div class="frame-empty">
        <span class="material-symbols-outlined">web</span>
        <p>${
          slot === "current"
            ? "Click Generate Baseline to start"
            : "Apply feedback to see a refinement"
        }</p>
      </div>
    `;

    wrapper.appendChild(header);
    wrapper.appendChild(content);
    return wrapper;
  }

  #updateLabel(wrapper: HTMLElement, text: string) {
    const label = wrapper.querySelector(".frame-label");
    if (label) label.textContent = text;
  }

  #updateCurrentHeader() {
    if (!this.#currentWrapper || !this.#current) return;
    this.#currentWrapper.classList.remove("empty");
    this.#updateLabel(
      this.#currentWrapper,
      `Current — ${this.#current.label}`
    );
  }

  #updateCandidateHeader() {
    if (!this.#candidateWrapper || !this.#candidate) return;
    this.#candidateWrapper.classList.remove("empty");
    this.#updateLabel(
      this.#candidateWrapper,
      `Candidate — ${this.#candidate.label}`
    );

    // Add promote/discard actions.
    this.#clearCandidateActions();
    const header = this.#candidateWrapper.querySelector(".frame-header")!;

    const actions = document.createElement("div");
    actions.className = "frame-actions";

    const promoteBtn = document.createElement("button");
    promoteBtn.className = "frame-action-btn promote";
    promoteBtn.innerHTML = `<span class="material-symbols-outlined">check_circle</span> Promote`;
    promoteBtn.addEventListener("click", () => this.#promote());

    const discardBtn = document.createElement("button");
    discardBtn.className = "frame-action-btn discard";
    discardBtn.innerHTML = `<span class="material-symbols-outlined">cancel</span> Discard`;
    discardBtn.addEventListener("click", () => this.#discard());

    actions.appendChild(promoteBtn);
    actions.appendChild(discardBtn);
    header.appendChild(actions);
  }

  #clearCandidateActions() {
    const actions = this.#candidateWrapper?.querySelector(".frame-actions");
    if (actions) actions.remove();
  }

  #resetCandidateSlot() {
    if (!this.#candidateWrapper) return;
    this.#candidateWrapper.classList.add("empty");
    this.#updateLabel(this.#candidateWrapper, "Refinement will appear here");
    this.#clearCandidateActions();
    const content = this.#candidateWrapper.querySelector(".frame-content");
    if (content) {
      content.innerHTML = `
        <div class="frame-empty">
          <span class="material-symbols-outlined">web</span>
          <p>Apply feedback to see a refinement</p>
        </div>
      `;
    }
  }

  // ─── Iframe Management ───────────────────────────────────────────

  async #renderIframe(wrapper: HTMLElement, code: string) {
    const content = wrapper.querySelector(".frame-content");
    if (!content) return;

    content.innerHTML = "";

    const iframe = document.createElement("iframe");
    iframe.sandbox.add("allow-scripts");
    iframe.sandbox.add("allow-same-origin");
    iframe.style.cssText =
      "width: 100%; height: 100%; border: none; display: block;";
    content.appendChild(iframe);
    iframe.src = "/iframe.html";

    await this.#waitForReady(iframe);

    iframe.contentWindow?.postMessage(
      { type: "render", code, props: {} },
      "*"
    );
  }

  #waitForReady(iframe: HTMLIFrameElement): Promise<void> {
    return new Promise<void>((resolve) => {
      let resolved = false;

      const onReady = (event: MessageEvent) => {
        if (
          event.source === iframe.contentWindow &&
          event.data?.type === "ready"
        ) {
          window.removeEventListener("message", onReady);
          if (!resolved) {
            resolved = true;
            resolve();
          }
        }
      };
      window.addEventListener("message", onReady);

      // Timeout fallback — iframe may have loaded before we listened.
      setTimeout(() => {
        if (!resolved) {
          window.removeEventListener("message", onReady);
          resolved = true;
          resolve();
        }
      }, 3000);
    });
  }

  // ─── Promote / Discard ───────────────────────────────────────────

  #promote() {
    if (!this.#candidate) return;
    this.#current = this.#candidate;
    this.#candidate = null;

    // Re-render the current slot with the promoted code.
    // (We can't reparent iframes — browsers reload them on move.)
    this.#updateCurrentHeader();
    this.#renderIframe(this.#currentWrapper!, this.#current.code);
    this.#resetCandidateSlot();
    this.#onPromote?.(this.#current);
  }

  #discard() {
    this.#candidate = null;
    this.#resetCandidateSlot();
    this.#onDiscard?.();
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
