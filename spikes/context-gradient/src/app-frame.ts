/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * App Frame — manages iframe lifecycle and multi-view toggling.
 *
 * The frame area has toggle buttons for L0-L3. Multiple levels can be
 * visible simultaneously, laid out side-by-side in a CSS grid.
 */

export { AppFrame };

interface FrameState {
  code: string;
  levelId: string;
  iframe: HTMLIFrameElement | null;
  ready: boolean;
}

class AppFrame {
  #container: HTMLElement;
  #frames: Map<string, FrameState> = new Map();
  #visibleLevels: Set<string> = new Set(["L0"]);
  #levels: string[] = ["L0", "L1", "L2", "L3"];

  constructor(container: HTMLElement) {
    this.#container = container;
    this.#renderLayout();
  }

  /** Toggle a level's visibility. At least one must remain visible. */
  toggleLevel(levelId: string) {
    if (this.#visibleLevels.has(levelId)) {
      if (this.#visibleLevels.size > 1) {
        this.#visibleLevels.delete(levelId);
      }
    } else {
      this.#visibleLevels.add(levelId);
    }
    this.#renderLayout();
  }

  /** Ensure a level is visible (used when generating). */
  ensureVisible(levelId: string) {
    if (!this.#visibleLevels.has(levelId)) {
      this.#visibleLevels.add(levelId);
    }
  }

  /** Check if a level has generated code cached. */
  hasCode(levelId: string): boolean {
    return this.#frames.has(levelId);
  }

  /** Render generated code in an iframe for a given level. */
  async renderCode(levelId: string, code: string): Promise<void> {
    // Cache the code.
    let state = this.#frames.get(levelId);
    if (state) {
      state.code = code;
      state.ready = false;
    } else {
      state = { code, levelId, iframe: null, ready: false };
      this.#frames.set(levelId, state);
    }

    const wasVisible = this.#visibleLevels.has(levelId);
    this.ensureVisible(levelId);

    if (!wasVisible) {
      this.#renderLayout();
    }

    // Replace just this wrapper's content with an iframe.
    const wrapper = this.#container.querySelector(
      `[data-level="${levelId}"]`
    );
    if (wrapper) {
      const label = wrapper.querySelector(".frame-label");
      wrapper.innerHTML = "";
      if (label) wrapper.appendChild(label);

      const iframe = document.createElement("iframe");
      iframe.sandbox.add("allow-scripts");
      iframe.sandbox.add("allow-same-origin");
      iframe.style.cssText =
        "width: 100%; height: 100%; border: none; display: block;";
      wrapper.appendChild(iframe);
      iframe.src = "/iframe.html";

      state.iframe = iframe;
      state.ready = false;
    }

    // Wait for the iframe to be ready, then send the code.
    await this.#sendCode(state);
  }

  /** Show loading indicator for a level. */
  showLoading(levelId: string) {
    const wasVisible = this.#visibleLevels.has(levelId);
    this.ensureVisible(levelId);

    // Only rebuild the full layout if this level wasn't previously visible.
    // Otherwise, the wrapper already exists in the DOM.
    if (!wasVisible) {
      this.#renderLayout();
    }

    const wrapper = this.#container.querySelector(
      `[data-level="${levelId}"]`
    );
    if (wrapper) {
      // Preserve the label, replace everything else.
      const label = wrapper.querySelector(".frame-label");
      wrapper.innerHTML = "";
      if (label) wrapper.appendChild(label);

      const loading = document.createElement("div");
      loading.className = "frame-loading";
      loading.innerHTML = `
        <div class="spinner"></div>
        <span>Generating ${levelId}…</span>
        <div class="stream-preview"></div>
      `;
      wrapper.appendChild(loading);
    }
  }

  /** Append streaming thought text to the loading preview. */
  appendStreamText(levelId: string, text: string) {
    const wrapper = this.#container.querySelector(
      `[data-level="${levelId}"]`
    );
    const preview = wrapper?.querySelector(".stream-preview");
    if (preview) {
      preview.textContent += text;
      preview.scrollTop = preview.scrollHeight;
    }
  }

  /** Show error for a level. */
  showError(levelId: string, message: string) {
    const wrapper = this.#container.querySelector(
      `[data-level="${levelId}"]`
    );
    if (wrapper) {
      wrapper.innerHTML = `
        <div class="frame-error">
          <span class="material-symbols-outlined">error</span>
          <p>${escapeHtml(message)}</p>
        </div>
      `;
    }
  }

  #renderLayout() {
    this.#container.className = "frame-area";

    // ── Tab bar (always rebuild — it's cheap) ──────────────────────────
    let tabBar = this.#container.querySelector(".frame-tabs");
    if (!tabBar) {
      tabBar = document.createElement("div");
      tabBar.className = "frame-tabs";
      this.#container.prepend(tabBar);
    }
    tabBar.innerHTML = "";

    for (const level of this.#levels) {
      const tab = document.createElement("button");
      tab.className = "frame-tab";
      if (this.#visibleLevels.has(level)) tab.classList.add("visible");

      const dot = document.createElement("span");
      dot.className = "frame-tab-dot";
      if (this.#frames.has(level)) dot.classList.add("generated");
      tab.appendChild(dot);

      const text = document.createTextNode(level);
      tab.appendChild(text);

      tab.addEventListener("click", () => this.toggleLevel(level));
      tabBar.appendChild(tab);
    }

    // ── Frame grid (incremental — preserve existing wrappers) ─────────
    let grid = this.#container.querySelector<HTMLElement>(".frame-grid");
    if (!grid) {
      grid = document.createElement("div");
      grid.className = "frame-grid";
      this.#container.appendChild(grid);
    }

    const count = this.#visibleLevels.size;
    grid.style.gridTemplateColumns = `repeat(${count}, 1fr)`;

    // Remove wrappers for levels no longer visible.
    for (const wrapper of Array.from(
      grid.querySelectorAll<HTMLElement>("[data-level]")
    )) {
      const level = wrapper.dataset.level!;
      if (!this.#visibleLevels.has(level)) {
        wrapper.remove();
      }
    }

    // Add wrappers for newly visible levels, inserting at the correct
    // position. NEVER move existing wrappers — moving an iframe in the
    // DOM causes browser to reload it.
    const existingLevels = new Set(
      Array.from(grid.querySelectorAll<HTMLElement>("[data-level]")).map(
        (el) => el.dataset.level
      )
    );

    for (const levelId of this.#levels) {
      if (!this.#visibleLevels.has(levelId)) continue;
      if (existingLevels.has(levelId)) continue;

      // Find the correct insertion point: before the first existing
      // wrapper whose level comes after this one.
      let insertBefore: Element | null = null;
      for (const afterLevel of this.#levels) {
        if (afterLevel === levelId) continue;
        if (this.#levels.indexOf(afterLevel) <= this.#levels.indexOf(levelId))
          continue;
        const sibling = grid.querySelector(`[data-level="${afterLevel}"]`);
        if (sibling) {
          insertBefore = sibling;
          break;
        }
      }

      this.#renderFrame(levelId, grid, insertBefore);
    }
  }

  #renderFrame(
    levelId: string,
    parent: HTMLElement,
    insertBefore: Element | null = null
  ) {
    const wrapper = document.createElement("div");
    wrapper.className = "frame-wrapper";
    wrapper.dataset.level = levelId;

    // Column header label
    const label = document.createElement("div");
    label.className = "frame-label";
    label.textContent = levelId;
    wrapper.appendChild(label);

    const state = this.#frames.get(levelId);
    if (state?.code) {
      const iframe = document.createElement("iframe");
      iframe.sandbox.add("allow-scripts");
      iframe.sandbox.add("allow-same-origin");
      iframe.style.cssText =
        "width: 100%; height: 100%; border: none; display: block;";
      wrapper.appendChild(iframe);
      iframe.src = "/iframe.html";

      state.iframe = iframe;
      state.ready = false;

      // Wait for ready, then send code.
      this.#waitForReady(iframe).then(() => {
        state.ready = true;
        this.#sendCode(state);
      });
    } else {
      wrapper.innerHTML += `
        <div class="frame-empty">
          <span class="material-symbols-outlined">web</span>
          <p>Click Generate to create the ${levelId} mini app</p>
        </div>
      `;
    }

    if (insertBefore) {
      parent.insertBefore(wrapper, insertBefore);
    } else {
      parent.appendChild(wrapper);
    }
  }

  async #sendCode(state: FrameState): Promise<void> {
    if (!state.iframe || !state.code) return;

    if (!state.ready) {
      await this.#waitForReady(state.iframe);
      state.ready = true;
    }

    state.iframe.contentWindow?.postMessage(
      {
        type: "render",
        code: state.code,
        props: {},
      },
      "*"
    );
  }

  #waitForReady(iframe: HTMLIFrameElement): Promise<void> {
    return new Promise<void>((resolve) => {
      const onReady = (event: MessageEvent) => {
        if (
          event.source === iframe.contentWindow &&
          event.data?.type === "ready"
        ) {
          window.removeEventListener("message", onReady);
          resolve();
        }
      };
      window.addEventListener("message", onReady);
    });
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
