/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SignalWatcher } from "@lit-labs/signals";
import { provide } from "@lit/context";
import { LitElement, PropertyValues, css, html, nothing, unsafeCSS } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { theme as uiTheme } from "../../../src/ui/a2ui-theme/a2ui-theme.js";
import {
  palette,
  uiColorMapping,
} from "../../../src/ui/styles/host/base-colors.js";
import * as Theme from "../../../src/theme/index.js";
import "./ui/ui.js";

import { FileSystemPath, Outcome } from "@breadboard-ai/types";
import { ok } from "@breadboard-ai/utils";
import { map } from "lit/directives/map.js";
import { signal } from "signal-utils";
import * as UI from "../../../src/a2ui/0.8/ui/ui.js";
import { v0_8 } from "../../../src/a2ui/index.js";
import { FinalChainReport } from "../../collate-context.js";
import {
  FileSystemEvalBackend,
  FileSystemEvalBackendHandle,
} from "./filesystem.js";
import {
  GroupedByType,
  ParsedFileMedata,
  parseFileName,
} from "./parse-file-name.js";
import { OutcomePayload, EvalFileData } from "../../../src/types/types.js";
import "./ui/contexts-viewer.js";
import "./ui/outcome-viewer.js";

type RenderMode = "surfaces" | "messages" | "contexts" | "outcome";

const RENDER_MODE_KEY = "eval-inspector-render-mode";

@customElement("a2ui-eval-inspector")
export class A2UIEvalInspector extends SignalWatcher(LitElement) {
  @provide({ context: UI.Context.themeContext })
  accessor theme: v0_8.Types.Theme = uiTheme;

  @signal
  accessor #colorScheme: "light" | "dark" = "light";

  @state()
  accessor #ready = true;

  @state()
  accessor #requesting = false;

  @state()
  accessor contexts: FinalChainReport[] = [];

  @state()
  accessor outcome: OutcomePayload | null = null;

  @property()
  accessor selectedPath: FileSystemEvalBackendHandle | null = null;

  @property()
  accessor selectedFilePath: string | null = null;

  @signal
  accessor #selectedSurface: number = 0;

  @signal
  accessor #showPromptOption: string | null = null;

  @signal
  accessor #filesInMountedDir: GroupedByType[] = [];

  @signal
  accessor #dirs: FileSystemEvalBackendHandle[] = [];

  @signal
  accessor selectedFile: ParsedFileMedata | null = null;

  @signal
  accessor #surfaces: v0_8.Types.ServerToClientMessage[][] | null = null;
  #processor = v0_8.Data.createSignalA2UIModelProcessor();

  @state()
  set renderMode(renderMode: RenderMode) {
    this.#renderMode = renderMode;
    localStorage.setItem(RENDER_MODE_KEY, renderMode);
  }
  get renderMode() {
    return this.#renderMode;
  }

  #renderMode: RenderMode = "surfaces";
  #fileSystem = new FileSystemEvalBackend();
  #urlRestored = false;

  constructor() {
    super();
    this.#refresh();
  }

  connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener("popstate", this.#onPopState);
    this.#restoreFromUrl();
    this.#applyPaletteStyles();
    this.#applyColorScheme();
  }

  #applyPaletteStyles() {
    // Generate palette CSS vars the same way the app view does (base-colors.ts).
    const styles = Theme.createThemeStyles(palette, uiColorMapping);
    const originalStyles = Theme.createThemeStyles(
      palette,
      uiColorMapping,
      "original-"
    );
    for (const [key, value] of Object.entries({
      ...styles,
      ...originalStyles,
    })) {
      this.style.setProperty(key, value);
    }
  }

  #applyColorScheme() {
    document.documentElement.style.setProperty(
      "color-scheme",
      this.#colorScheme
    );
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener("popstate", this.#onPopState);
  }

  #onPopState = () => {
    this.#restoreFromUrl();
  };

  #restoreFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const file = params.get("file");
    const mode = params.get("mode") as RenderMode | null;
    const surface = parseInt(params.get("surface") || "0", 10);

    if (
      mode &&
      ["surfaces", "messages", "contexts", "outcome"].includes(mode)
    ) {
      this.renderMode = mode;
    }

    if (!Number.isNaN(surface)) {
      this.#selectedSurface = surface;
    }

    if (file && file !== this.selectedFilePath) {
      this.selectedFilePath = file;
      this.selectedFile = parseFileName(file);
    }

    this.#urlRestored = true;
  }

  #updateUrl() {
    if (!this.#urlRestored) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    if (this.selectedFilePath) {
      params.set("file", this.selectedFilePath);
    } else {
      params.delete("file");
    }

    if (this.renderMode) {
      params.set("mode", this.renderMode);
    } else {
      params.delete("mode");
    }

    if (this.#selectedSurface > 0) {
      params.set("surface", this.#selectedSurface.toString());
    } else {
      params.delete("surface");
    }

    const url = `${window.location.pathname}?${params.toString()}`;
    window.history.pushState({}, "", url);
  }
  static styles = [
    unsafeCSS(v0_8.Styles.structuralStyles),
    css`
      * {
        box-sizing: border-box;
      }

      :host {
        display: grid;
        width: 100%;
        height: 100%;
        color: var(--text-color);
        grid-template-rows: 42px 1fr;

        --light-dark-n-10: var(--primary);
      }

      header {
        border-bottom: 1px solid var(--border-color);
        padding: var(--bb-grid-size-2) var(--bb-grid-size-3);
      }

      .rotate {
        animation: rotate 1s linear infinite;
      }

      .g-icon.large {
        font-size: 100px;
      }

      h1,
      h2 {
        display: flex;
        align-items: center;
        margin: 0;

        & .g-icon {
          margin-right: var(--bb-grid-size-2);
        }
      }

      @media (min-height: 960px) {
        #main #controls-container {
          grid-template-rows: 32px 1fr 42px;
          gap: var(--bb-grid-size-5);

          & #controls {
            margin-bottom: var(--bb-grid-size-3);
          }
        }
      }

      #main {
        & ui-splitter {
          height: 100%;
        }

        & #controls-container {
          padding: var(--bb-grid-size-6);
          display: grid;
          grid-template-rows: 32px 40px 1fr;
          gap: var(--bb-grid-size-3);

          & #mount-dir,
          & #mount-dir > span {
            display: flex;
            align-items: center;
            background: none;
            border: none;
            color: var(--text-color);
            padding: 0;
          }

          & #mount-dir {
            gap: var(--bb-grid-size-3);

            & > span {
              border-radius: var(--bb-grid-size-2);
              background: oklch(from var(--primary) l c h / calc(alpha * 0.2));
              opacity: 0.8;
              border: none;
              transition: opacity 0.3s cubic-bezier(0, 0, 0.3, 1);
              width: 100%;
              max-width: 420px;
              padding: var(--bb-grid-size-2) var(--bb-grid-size-5)
                var(--bb-grid-size-2) var(--bb-grid-size-2);
              pointer-events: auto;

              &:not(.active):hover {
                opacity: 1;
                cursor: pointer;
              }

              &.active {
                opacity: 1;
                color: var(--text-color);
              }
            }
          }

          & #dir-selector {
            width: 100%;
            height: 100%;
            background: oklch(from var(--primary) l c h / calc(alpha * 0.2));
            border-radius: var(--bb-grid-size-2);
            border: 1px solid var(--primary);
            color: var(--text-color);
            padding: 0;
          }

          & #controls {
            display: flex;
            align-items: end;
            margin-bottom: var(--bb-grid-size-3);

            & button {
              display: flex;
              align-items: center;
              justify-content: center;
              flex: 1;
              min-height: 42px;
              padding: 0;
              border: none;
              background: none;
              color: var(--text-color);
              opacity: 0.5;
              border-bottom: 2px solid var(--border-color);
              transition:
                opacity 0.3s cubic-bezier(0, 0, 0.3, 1),
                border-color 0.3s cubic-bezier(0, 0, 0.3, 1);

              &:not([disabled]):not(.active) {
                cursor: pointer;
              }

              & .g-icon {
                margin-right: var(--bb-grid-size-2);
              }

              &.active {
                opacity: 1;
                border-bottom: 2px solid var(--primary);
              }
            }
          }

          & #instructions {
            border-radius: var(--bb-grid-size-2);
            border: 1px solid var(--border-color);
            padding: var(--bb-grid-size-2);
            color: var(--text-color);
            background: var(--elevated-background-light);
            resize: none;
            font-family: var(--font-family-mono);
            width: 100%;
            overflow: auto;

            & #file-list {
              padding: 0;
              margin: 0;
              list-style: none;
              display: flex;
              flex-direction: column;
              gap: var(--bb-grid-size-2);

              li {
                width: 100%;
                overflow: auto;

                h2 {
                  font-size: 12px;
                  font-weight: normal;
                  margin: 0;
                }

                ul {
                  padding-left: var(--bb-grid-size-2);
                }

                button {
                  background: oklch(
                    from var(--primary) l c h / calc(alpha * 0.2)
                  );
                  border: none;
                  border-radius: var(--bb-grid-size-2);
                  color: var(--text-color);
                  padding: var(--bb-grid-size-2);
                  font-family: var(--font-family-mono);
                  text-align: left;
                  width: 100%;
                  overflow: hidden;
                  text-overflow: ellipsis;
                  white-space: nowrap;
                  cursor: pointer;

                  &[selected] {
                    background: oklch(
                      from var(--primary) l c h / calc(alpha * 0.4)
                    );
                  }
                }
              }
            }
          }

          & button[type="submit"] {
            border-radius: var(--bb-grid-size-2);
            color: var(--text-color);
            background: var(--primary);
            opacity: 0.4;
            border: none;
            transition: opacity 0.3s cubic-bezier(0, 0, 0.3, 1);
            width: 100%;
            max-width: 420px;
            justify-self: center;

            &:not([disabled]) {
              opacity: 1;
              cursor: pointer;
            }
          }
        }

        & #surface-container {
          padding: var(--bb-grid-size-6);
          border-left: 1px solid var(--border-color);
          display: grid;
          grid-template-rows: 32px 1fr;
          gap: var(--bb-grid-size-4);

          & #render-mode,
          & #render-mode > button {
            display: flex;
            align-items: center;
            background: none;
            border: none;
            color: var(--primary);
            padding: 0;
          }

          & #render-mode {
            gap: var(--bb-grid-size-3);
            display: flex;

            & > button {
              border-radius: var(--bb-grid-size-2);
              background: oklch(from var(--primary) l c h / calc(alpha * 0.2));
              opacity: 0.4;
              border: none;
              transition: opacity 0.3s cubic-bezier(0, 0, 0.3, 1);
              width: 100%;
              max-width: 420px;
              padding: var(--bb-grid-size-2) var(--bb-grid-size-5);
              pointer-events: auto;
              color: var(--primary);
              display: flex;
              align-items: center;
              cursor: pointer;

              &:not(.active):hover {
                opacity: 1;
              }

              &.active {
                opacity: 1;
                color: var(--text-color);
              }

              & .g-icon {
                margin-right: var(--bb-grid-size-2);
              }
            }
          }

          & #messages,
          & #surfaces,
          & #contexts {
            display: flex;
            border-radius: var(--bb-grid-size-2);
            border: 1px dashed var(--border-color);
            align-items: center;
            justify-content: center;
            padding: var(--bb-grid-size-4);
            overflow: scroll;
            scrollbar-width: none;
            position: relative;

            & a2ui-surface {
              width: 100%;
              max-width: 840px;
            }
          }

          & #surfaces {
            background: var(--light-dark-n-100);
            color: var(--light-dark-n-0);

            & #surface-overlay {
              position: absolute;
              top: 10px;
              left: 10px;
              display: flex;
              gap: var(--bb-grid-size-2);
              z-index: 1;

              & select {
                padding: var(--bb-grid-size-2);
                border: 1px solid var(--primary);
                border-radius: var(--bb-grid-size-2);
                background: var(--light-dark-n-100);
                color: var(--light-dark-n-0);
              }
            }
          }

          & #contexts {
            position: relative;
            display: block;
          }

          & #messages {
            position: relative;
            display: block;
            font-family: var(--font-family-mono);
            line-height: 1.5;

            & button {
              position: absolute;
              top: var(--bb-grid-size-3);
              right: var(--bb-grid-size-3);

              display: flex;
              align-items: center;
              border-radius: var(--bb-grid-size-2);
              background: oklch(from var(--primary) l c h / calc(alpha * 0.2));
              opacity: 0.4;
              border: none;
              transition: opacity 0.3s cubic-bezier(0, 0, 0.3, 1);
              padding: var(--bb-grid-size-2) var(--bb-grid-size-5)
                var(--bb-grid-size-2) var(--bb-grid-size-2);
              color: var(--primary);

              & .g-icon {
                margin-right: var(--bb-grid-size-2);
              }

              &:not([disabled]) {
                cursor: pointer;

                &:hover,
                &:focus {
                  opacity: 1;
                }
              }
            }
          }

          & #generating-surfaces,
          & #no-surfaces {
            p {
              color: var(--light-dark-n-60);
            }

            width: 50%;
            max-width: 400px;
            text-align: center;
          }

          & #generating-surfaces {
            & h2 {
              justify-content: center;
              white-space: nowrap;
            }
          }

          & #no-surfaces {
            & h2 {
              display: block;
              text-align: center;
            }
          }
        }
      }

      @keyframes rotate {
        from {
          rotate: 0deg;
        }

        to {
          rotate: 360deg;
        }
      }
    `,
  ];

  protected async willUpdate(changedProperties: PropertyValues<this>) {
    if (changedProperties.has("selectedPath")) {
      if (this.selectedPath) {
        const path = this.selectedPath.path;
        this.#fileSystem.query(path).then((f) => this.#updateFiles(f, path));
      } else {
        this.#filesInMountedDir = [];
      }
    }

    if (changedProperties.has("selectedFilePath")) {
      if (this.selectedFilePath) {
        await this.#loadFile(this.selectedFilePath);
      } else {
        this.#surfaces = [];
        this.contexts = [];
        this.outcome = null;
      }
      this.#updateUrl();
    }

    if (changedProperties.has("renderMode")) {
      this.#updateUrl();
    }
  }

  async #loadFile(path: string) {
    this.#selectedSurface = 0;
    this.#processor.clearSurfaces();
    const data = await this.#fileSystem.read(path as FileSystemPath);
    if (!ok(data)) {
      return;
    }

    try {
      const fileData = JSON.parse(data) as EvalFileData;
      this.#surfaces = [];
      const a2ui = fileData.filter((item) => item.type === "a2ui");
      this.contexts = fileData.filter((item) => item.type === "context");
      this.outcome =
        fileData.filter((item) => item.type === "outcome").at(0) || null;

      this.#processor.clearSurfaces();
      for (const { data } of a2ui.values()) {
        for (let s = 0; s < data.length; s++) {
          const surface = data[s];
          this.#surfaces.push(surface);
          if (s !== this.#selectedSurface) {
            continue;
          }

          this.#processor.processMessages(surface);
        }
      }
    } catch (err) {
      console.warn(err);
      this.renderMode = "messages";
      return;
    }
  }

  #updateFiles(f: Outcome<GroupedByType[]>, path: string) {
    if (!ok(f)) {
      this.#filesInMountedDir = [];
      if (f.$error === "prompt") {
        this.#showPromptOption = path;
      }
      return;
    }

    this.#showPromptOption = null;
    this.#filesInMountedDir = f;
  }

  async #refresh() {
    const items = await this.#fileSystem.getAll();
    this.#dirs = items;
    if (!this.selectedPath && items.length) {
      this.selectedPath = items.at(0) ?? null;
    }
    return items;
  }

  #renderContents() {
    if (this.#requesting) {
      return html`<section id="surfaces">
        <div id="generating-surfaces">
          <h2 class="typography-w-400 typography-f-s typography-sz-tl">
            <span class="g-icon filled round rotate">progress_activity</span
            >Generating your UI
          </h2>
          <p class="typography-f-s typography-sz-bl">Working on it...</p>
        </div>
      </section>`;
    }

    if (this.renderMode === "contexts") {
      return html`<section id="contexts">
        <ui-contexts-viewer .contexts=${this.contexts}></ui-contexts-viewer>
      </section>`;
    }

    if (this.renderMode === "outcome") {
      return html`<section id="outcome">
        <ui-outcome-viewer
          .outcome=${this.outcome?.outcome}
        ></ui-outcome-viewer>
      </section>`;
    }

    const renderNoData = () =>
      html`<section id="surfaces">
        <div id="no-surfaces">
          <h2 class="typography-w-400 typography-f-s typography-sz-tl">
            No UI Generated Yet
          </h2>
          <p class="typography-f-s typography-sz-bl">
            Select a file to see the result here.
          </p>
        </div>
      </section>`;

    if (this.#surfaces?.length === 0) {
      return renderNoData();
    }

    if (this.renderMode === "surfaces") {
      return html`<section id="surfaces">
        <div id="surface-overlay">
          ${this.#surfaces
            ? html`<select
                @change=${(evt: Event) => {
                  if (!(evt.target instanceof HTMLSelectElement)) {
                    return;
                  }

                  this.#selectedSurface = evt.target.selectedIndex;
                  this.#updateUrl();
                  this.#processor.clearSurfaces();

                  const selectedSurface = this.#surfaces?.at(
                    this.#selectedSurface
                  );
                  if (!selectedSurface) {
                    return;
                  }

                  this.#processor.processMessages(selectedSurface);
                }}
                id="surface-select"
              >
                ${map(this.#surfaces, (_, idx) => {
                  return html`<option>Surface ${idx + 1}</option>`;
                })}
              </select>`
            : nothing}
          <select
            id="theme-select"
            @change=${(evt: Event) => {
              if (!(evt.target instanceof HTMLSelectElement)) {
                return;
              }
              this.#colorScheme = evt.target.value as "light" | "dark";
              this.#applyColorScheme();
            }}
          >
            <option value="light" ?selected=${this.#colorScheme === "light"}>
              ☀️ Light
            </option>
            <option value="dark" ?selected=${this.#colorScheme === "dark"}>
              🌙 Dark
            </option>
          </select>
        </div>
        ${map(this.#processor.getSurfaces(), ([surfaceId, surface]) => {
          return html`<a2ui-surface
              .surfaceId=${surfaceId}
              .surface=${surface}
              .processor=${this.#processor}
              ></a2-uisurface>`;
        })}
      </section>`;
    }

    return html`<section id="messages">
      <div>${JSON.stringify(this.#surfaces, null, 2)}</div>
      <button
        @click=${async () => {
          const content = JSON.stringify(this.#surfaces, null, 2);
          await navigator.clipboard.writeText(content);
        }}
      >
        <span class="g-icon filled round">content_copy</span> Copy to Clipboard
      </button>
    </section>`;
  }

  #renderInput() {
    return html`<div>
        ${this.#dirs.length > 0
          ? html`<select
              id="dir-selector"
              @change=${(evt: Event) => {
                if (!(evt.target instanceof HTMLSelectElement)) {
                  return;
                }

                const target = evt.target;
                this.selectedPath =
                  this.#dirs.find((val) => val.path === target.value) ?? null;
              }}
            >
              ${map(
                this.#dirs,
                (dir) =>
                  html`<option
                    ?selected=${dir.path === this.selectedPath?.path}
                  >
                    ${dir.title}
                  </option>`
              )}
            </select>`
          : html`<div>Mount a directory to continue</div>`}
      </div>
      <div
        id="instructions"
        class=${classMap({
          "typography-w-400": true,
          "typography-f-s": true,
          "typography-sz-bl": true,
        })}
      >
        ${this.#showPromptOption
          ? html`<div>
              <h1>Access expired</h1>
              <button
                @click=${async () => {
                  if (!this.#showPromptOption) {
                    return;
                  }

                  const refresh = await this.#fileSystem.refreshAccess(
                    this.#showPromptOption
                  );
                  if (!ok(refresh)) {
                    console.warn("Refresh failed");
                    return;
                  }

                  const files = await this.#fileSystem.query(
                    this.#showPromptOption
                  );
                  this.#updateFiles(files, this.#showPromptOption!);
                }}
              >
                Request access
              </button>
            </div>`
          : nothing}
        <ul id="file-list">
          ${this.#filesInMountedDir.map((file) => {
            return html`<li>
              <h2>${file.type}</h2>
              <ul>
                ${file.items.map((item) => {
                  return html`<li>
                    <h2>${item.name}</h2>
                    <ul>
                      ${item.files.map((f) => {
                        return html`<li>
                          <button
                            ?selected=${f.path === this.selectedFilePath}
                            @click=${async () => {
                              this.selectedFile = f;
                              this.selectedFilePath = f.path;
                            }}
                          >
                            ${f.date.toLocaleString(
                              Intl.DateTimeFormat().resolvedOptions().locale,
                              {
                                dateStyle: "short",
                                timeStyle: "medium",
                              }
                            )}
                          </button>
                        </li>`;
                      })}
                    </ul>
                  </li>`;
                })}
              </ul>
            </li>`;
          })}
        </ul>
      </div>`;
  }

  #renderHeader() {
    return html`<header
      class="typography-w-400 typography-f-sf typography-sz-tm"
    >
      A2UI Inspector
    </header>`;
  }

  #renderMain() {
    return html`<section id="main">
      <ui-splitter
        direction=${"horizontal"}
        name="layout-main"
        split="[0.20, 0.80]"
        .minSegmentSizeHorizontal=${325}
      >
        <div id="controls-container" slot="slot-0">
          <h2
            class="typography-w-400 typography-f-s typography-sz-tl layout-sp-bt"
          >
            Files
            <button
              id="mount-dir"
              @click=${async () => {
                await this.#fileSystem.query(
                  `/mnt/${globalThis.crypto.randomUUID()}/`
                );
                this.#refresh();
              }}
            >
              <span><span class="g-icon filled round">add</span>Mount</span>
            </button>
          </h2>
          ${this.#renderInput()}
        </div>
        <div id="surface-container" slot="slot-1">
          <h2
            class="typography-w-400 typography-f-s typography-sz-tl layout-sp-bt"
          >
            ${this.selectedFile?.name}
            <div id="render-mode">
              <button
                class=${classMap({ active: this.#renderMode === "contexts" })}
                @click=${() => (this.renderMode = "contexts")}
                title="View Conversation Contexts"
              >
                <span class="g-icon filled round">forum</span>Contexts
              </button>

              <button
                class=${classMap({ active: this.#renderMode === "outcome" })}
                @click=${() => (this.renderMode = "outcome")}
                title="View Outcome"
              >
                <span class="g-icon filled round">data_check</span>Outcome
              </button>

              <button
                class=${classMap({ active: this.#renderMode === "surfaces" })}
                @click=${() => (this.renderMode = "surfaces")}
                title="View Generated Surfaces"
              >
                <span class="g-icon filled round">mobile_layout</span>Surfaces
              </button>

              <button
                class=${classMap({ active: this.#renderMode === "messages" })}
                @click=${() => (this.renderMode = "messages")}
                title="View A2UI Messages"
              >
                <span class="g-icon filled round">communication</span>A2UI
              </button>
            </div>
          </h2>
          ${this.#renderContents()}
        </div>
      </ui-splitter>
    </section>`;
  }

  #renderUI() {
    return [this.#renderHeader(), this.#renderMain()];
  }

  render() {
    if (!this.#ready) {
      return html`Loading...`;
    }

    return this.#renderUI();
  }
}
