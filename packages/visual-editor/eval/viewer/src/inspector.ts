/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SignalWatcher } from "@lit-labs/signals";
import { provide } from "@lit/context";
import { LitElement, PropertyValues, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import {
  theme as uiTheme,
  applyTokens,
} from "../../../src/ui/a2ui-theme/a2ui-theme.js";
import { icons } from "../../../src/ui/styles/icons.js";
import {
  palette as defaultPalette,
  uiColorMapping,
} from "../../../src/ui/styles/host/base-colors.js";
import * as Theme from "../../../src/theme/index.js";
import "../../../src/ui/app-templates/basic/a2ui-custom-elements/index.js";
import "./ui/ui.js";

import { FileSystemPath, GraphDescriptor, Outcome } from "@breadboard-ai/types";
import "./ui/bgl-viewer.js";
import { ok } from "@breadboard-ai/utils";
import { map } from "lit/directives/map.js";
import { signal } from "signal-utils";
import * as UI from "../../../src/a2ui/0.8/ui/ui.js";
import { v0_8 } from "../../../src/a2ui/index.js";
import { FinalChainReport } from "../../collate-context.js";
import { UserNote, NoteLocation } from "./types.js";
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

type RenderMode = "surfaces" | "messages" | "contexts" | "outcome" | "topology";

const RENDER_MODE_KEY = "eval-inspector-render-mode";

@customElement("a2ui-eval-inspector")
export class A2UIEvalInspector extends SignalWatcher(LitElement) {
  @provide({ context: UI.Context.themeContext })
  accessor theme: v0_8.Types.Theme = uiTheme;

  @signal
  accessor #colorScheme: "light" | "dark" = "light";

  @signal
  accessor #baseColor: string = localStorage.getItem("eval-base-color") || "";

  @state()
  accessor #ready = true;

  @state()
  accessor #requesting = false;

  @state()
  accessor contexts: FinalChainReport[] = [];

  @state()
  accessor outcome: OutcomePayload | null = null;

  @state()
  accessor bgl: GraphDescriptor | null = null;

  @state()
  accessor rater: unknown = null;

  @state()
  accessor transcript: unknown[] | null = null;

  @state()
  accessor notes: UserNote[] = [];


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
    applyTokens(this, this.theme.tokens);
  }

  #paletteSheet: CSSStyleSheet | null = null;

  #applyPaletteStyles() {
    const activePalette = this.#baseColor
      ? Theme.generatePaletteFromColor(this.#baseColor)
      : defaultPalette;
    const styles = Theme.createThemeStyles(activePalette, uiColorMapping);
    const originalStyles = Theme.createThemeStyles(
      activePalette,
      uiColorMapping,
      "original-"
    );

    // Build a :host rule with all palette custom properties.
    // Using a constructed stylesheet (rather than inline style.setProperty)
    // ensures that light-dark() values inside the custom properties resolve
    // correctly — inline styles treat light-dark() as a raw string.
    const cssText = Object.entries({ ...styles, ...originalStyles })
      .map(([key, value]) => `${key}: ${value};`)
      .join("\n");

    if (!this.#paletteSheet) {
      this.#paletteSheet = new CSSStyleSheet();
      this.shadowRoot!.adoptedStyleSheets = [
        ...this.shadowRoot!.adoptedStyleSheets,
        this.#paletteSheet,
      ];
    }
    this.#paletteSheet.replaceSync(`:host { ${cssText} }`);
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
      ["surfaces", "messages", "contexts", "outcome", "topology"].includes(mode)
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
    icons,
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

          & #controls-title {
            flex: 1;
          }

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

              & h2 {
                margin: var(--bb-grid-size-2) 0;
              }

              li {
                width: 100%;
                overflow: auto;
                margin-bottom: var(--bb-grid-size-2);

                h2 {
                  font-size: 12px;
                  font-weight: normal;
                  margin: 0 0 var(--bb-grid-size-2) 0;
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

          & #current-file {
            flex: 1;
          }

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
            background: var(--light-dark-s-90);
            color: var(--light-dark-n-0);

            & #surface-overlay {
              position: absolute;
              top: 10px;
              left: 10px;
              display: flex;
              gap: var(--bb-grid-size-2);
              z-index: 1;

              & select,
              & input[type="color"] {
                padding: var(--bb-grid-size-2);
                border: 1px solid var(--primary);
                border-radius: var(--bb-grid-size-2);
                background: var(--light-dark-n-100);
                color: var(--light-dark-n-0);
                height: 100%;
              }

              & input[type="color"] {
                width: 60px;
                cursor: pointer;
              }
            }

            #color-picker::-webkit-color-swatch-wrapper {
              padding: 0;
              border: none;
              width: 40px;
              height: 18px;
            }

            #color-picker::-webkit-color-swatch {
              padding: 0;
              border: none;
              border-radius: var(--bb-grid-size);
              width: 40px;
              height: 18px;
            }

            #color-picker::-moz-color-swatch {
              padding: 0;
              border: none;
              border-radius: var(--bb-grid-size);
              width: 40px;
              height: 18px;
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
            white-space: pre;

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
        this.bgl = null;
        this.rater = null;
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

      const bglPath = path.replace(/\.log\.json$/, ".bgl.json");
      const bglData = await this.#fileSystem.read(bglPath as FileSystemPath);
      if (ok(bglData)) {
        try {
          this.bgl = JSON.parse(bglData) as GraphDescriptor;
        } catch {
          this.bgl = null;
        }
      } else {
        this.bgl = null;
      }

      const raterPath = path.replace(/\.log\.json$/, ".rater.json");
      const raterData = await this.#fileSystem.read(raterPath as FileSystemPath);
      if (ok(raterData)) {
        try {
          this.rater = JSON.parse(raterData);
        } catch {
          this.rater = null;
        }
      } else {
        this.rater = null;
      }

      const transcriptPath = path.replace(/\.log\.json$/, ".transcript.jsonl");
      const transcriptData = await this.#fileSystem.read(transcriptPath as FileSystemPath);
      if (ok(transcriptData) && typeof transcriptData === "string") {
        try {
          const lines = transcriptData.split("\n").filter((l) => l.trim().length > 0);
          this.transcript = lines.map((l) => JSON.parse(l));
        } catch {
          this.transcript = null;
        }
      } else {
        this.transcript = null;
      }

      const notesResult = await this.#fileSystem.readNotes(path);
      if (ok(notesResult)) {
        this.notes = notesResult.notes || [];
      } else {
        this.notes = [];
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
    if (this.renderMode === "topology") {
      return html`<section id="topology" style="width: 100%; height: 100%;">
        <bgl-viewer
          .graph=${this.bgl}
          .rater=${this.rater}
          .transcript=${this.transcript}
          .notes=${this.notes}
          @add-note=${this.#handleAddNote}
          @delete-note=${this.#handleDeleteNote}
        ></bgl-viewer>
      </section>`;
    }


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
          <input
            type="color"
            id="color-picker"
            .value=${this.#baseColor || "#6750a4"}
            title="Base theme color"
            @input=${(evt: Event) => {
              if (!(evt.target instanceof HTMLInputElement)) {
                return;
              }
              this.#baseColor = evt.target.value;
              localStorage.setItem("eval-base-color", this.#baseColor);
              this.#applyPaletteStyles();
            }}
          />
        </div>
        ${map(this.#processor.getSurfaces(), ([surfaceId, surface]) => {
          return html`<a2ui-surface
              .surfaceId=${surfaceId}
              .surface=${surface}
              .processor=${this.#processor}
              .enableCustomElements=${true}
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

  async #handleAddNote(e: CustomEvent<{ location: NoteLocation; text: string; reaction?: "good" | "bad" }>) {
    if (!this.selectedFilePath) {
      console.warn("Inspector: No selectedFilePath available!");
      return;
    }

    const newNote: UserNote = {
      id: crypto.randomUUID(),
      location: e.detail.location,
      text: e.detail.text,
      timestamp: new Date().toISOString(),
      reaction: e.detail.reaction,
    };

    let updatedNotes = [...this.notes];

    if (e.detail.reaction) {
      // Enforce Singleton & Mutually Exclusive: Filter out any existing reaction note for this location.
      updatedNotes = updatedNotes.filter((n) => {
        const isSameLoc = (locA: NoteLocation, locB: NoteLocation) => {
          if (locA.type !== locB.type) return false;
          if (locA.type === "node-config" && locB.type === "node-config") {
            return locA.nodeId === locB.nodeId && locA.fieldName === locB.fieldName;
          }
          if (locA.type === "rater" && locB.type === "rater") {
            return locA.dimension === locB.dimension && locA.fieldName === locB.fieldName;
          }
          if (locA.type === "transcript" && locB.type === "transcript") {
            return locA.turn === locB.turn && locA.eventIndex === locB.eventIndex && locA.fieldName === locB.fieldName;
          }
          return false;
        };

        const hasReaction = n.reaction !== undefined;
        const isSame = isSameLoc(n.location, e.detail.location);

        // Keep the note if it's NOT a reaction note at the same location.
        return !(hasReaction && isSame);
      });
    }

    updatedNotes.push(newNote);

    const result = await this.#fileSystem.writeNotes(this.selectedFilePath, { notes: updatedNotes });
    if (ok(result)) {
      this.notes = updatedNotes;
      this.#updateSidebarNoteCount(this.selectedFilePath, updatedNotes.length);
    } else {
      console.warn("Failed to save note:", result.$error);
    }
  }

  async #handleDeleteNote(e: CustomEvent<{ noteId: string }>) {
    if (!this.selectedFilePath) {
      console.warn("Inspector: No selectedFilePath available!");
      return;
    }

    const updatedNotes = this.notes.filter((n) => n.id !== e.detail.noteId);
    const result = await this.#fileSystem.writeNotes(this.selectedFilePath, { notes: updatedNotes });
    if (ok(result)) {
      this.notes = updatedNotes;
      this.#updateSidebarNoteCount(this.selectedFilePath, updatedNotes.length);
    } else {
      console.warn("Failed to delete note:", result.$error);
    }
  }

  #updateSidebarNoteCount(filePath: string, count: number) {
    if (!this.#filesInMountedDir) return;

    let updated = false;
    const newDirs = this.#filesInMountedDir.map((dir) => {
      return {
        ...dir,
        items: dir.items.map((item) => {
          return {
            ...item,
            files: item.files.map((f) => {
              if (f.path === filePath) {
                updated = true;
                return {
                  ...f,
                  noteCount: count,
                };
              }
              return f;
            }),
          };
        }),
      };
    });

    if (updated) {
      this.#filesInMountedDir = newDirs;
    }
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
                            style="display: flex; align-items: center; justify-content: space-between; width: 100%;"
                          >
                            <span style="flex-grow: 1; text-align: left;">
                              ${f.date.toLocaleString(
                                Intl.DateTimeFormat().resolvedOptions().locale,
                                {
                                  dateStyle: "short",
                                  timeStyle: "medium",
                                }
                              )}
                            </span>
                            ${f.judgement ? (() => {
                              const judgement = f.judgement;
                              const isPass = judgement === 'PASS';
                              const isPartial = judgement === 'PARTIAL';
                              const isFail = judgement === 'FAIL';
                              const color = isPass ? '#34a853' : (isPartial ? '#fbbc04' : (isFail ? '#ea4335' : 'transparent'));
                              const icon = isPass ? 'check_circle' : (isPartial ? 'warning' : (isFail ? 'cancel' : ''));
                              if (!icon) return nothing;
                              return html`<div style="display: flex; align-items: center; gap: 4px; flex-shrink: 0;">
                                ${f.noteCount && f.noteCount > 0 ? html`<span 
                                  style="background: var(--light-dark-n-0); color: var(--light-dark-n-100); font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 8px; border: 1px solid var(--border-color);"
                                  title="${f.noteCount} notes"
                                >${f.noteCount}</span>` : nothing}
                                <span 
                                  class="g-icon filled round" 
                                  style="color: ${color}; font-size: 16px;"
                                  title="Evaluation Judgement: ${judgement}"
                                >${icon}</span>
                              </div>`;
                            })() : (f.noteCount && f.noteCount > 0 ? html`<span 
                              style="background: var(--light-dark-n-0); color: var(--light-dark-n-100); font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 8px; border: 1px solid var(--border-color); margin-left: 8px; flex-shrink: 0;"
                              title="${f.noteCount} notes"
                            >${f.noteCount}</span>` : nothing)}
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
            <div id="controls-title">Files</div>
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
            <div id="current-file">${this.selectedFile?.name}</div>
            <div id="render-mode">
              <button
                class=${classMap({ active: this.#renderMode === "contexts" })}
                @click=${() => (this.renderMode = "contexts")}
                title="View Conversation Contexts"
              >
                <span class="g-icon filled round">forum</span>Contexts
              </button>

              ${this.bgl
                ? html`<button
                    class=${classMap({
                      active: this.#renderMode === "topology",
                    })}
                    @click=${() => (this.renderMode = "topology")}
                    title="View BGL Topology"
                  >
                    <span class="g-icon filled round">hub</span>Topology
                  </button>`
                : nothing}

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
