/*
 Copyright 2025 Google LLC

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

      https://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

import { LitElement, html, css, unsafeCSS, PropertyValues, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { SignalWatcher } from "@lit-labs/signals";
import { provide } from "@lit/context";
import { theme as uiTheme } from "./theme/theme.js";
import "./ui/ui.js";
import { classMap } from "lit/directives/class-map.js";

import { v0_8 } from "@breadboard-ai/a2ui";
import * as UI from "@breadboard-ai/a2ui/ui";
import { map } from "lit/directives/map.js";
import {
  FileSystemEvalBackend,
  FileSystemEvalBackendHandle,
} from "./filesystem.js";
import { ok } from "@breadboard-ai/utils";
import {
  FileSystemPath,
  FileSystemQueryEntry,
  FileSystemQueryResult,
} from "@breadboard-ai/types";
import { signal } from "signal-utils";

type EvalFileData = Array<Context | A2UIData>;

interface Context {
  type: "context";
}

type A2UIData = {
  type: "a2ui";
  data: v0_8.Types.ServerToClientMessage[][];
};

type RenderMode = "surfaces" | "messages";

const RENDER_MODE_KEY = "eval-inspector-render-mode";

@customElement("a2ui-eval-inspector")
export class A2UIEvalInspector extends SignalWatcher(LitElement) {
  @provide({ context: UI.Context.themeContext })
  accessor theme: v0_8.Types.Theme = uiTheme;

  @state()
  accessor #ready = true;

  @state()
  accessor #requesting = false;

  @property()
  accessor selectedPath: FileSystemEvalBackendHandle | null = null;

  @property()
  accessor selectedFilePath: string | null = null;

  @signal
  accessor #selectedSurface: number = 0;

  @signal
  accessor #showPromptOption: FileSystemPath | null = null;

  @signal
  accessor #filesInMountedDir: FileSystemQueryEntry[] = [];

  @signal
  accessor #dirs: FileSystemEvalBackendHandle[] = [];

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

        --bb-neutral-900: var(--primary);
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
            color: var(--n-100);
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
            color: var(--n-100);
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

                button {
                  background: oklch(
                    from var(--primary) l c h / calc(alpha * 0.2)
                  );
                  border: none;
                  border-radius: var(--bb-grid-size-2);
                  color: var(--n-100);
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
          & #render-mode > span {
            display: flex;
            align-items: center;
            background: none;
            border: none;
            color: var(--primary);
            padding: 0;
          }

          & #render-mode {
            gap: var(--bb-grid-size-3);

            & > span {
              border-radius: var(--bb-grid-size-2);
              background: oklch(from var(--primary) l c h / calc(alpha * 0.2));
              opacity: 0.4;
              border: none;
              transition: opacity 0.3s cubic-bezier(0, 0, 0.3, 1);
              width: 100%;
              max-width: 420px;
              padding: var(--bb-grid-size-2) var(--bb-grid-size-5);
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

          & #messages,
          & #surfaces {
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
            background: var(--n-100);

            & #surface-select {
              position: absolute;
              top: 10px;
              left: 10px;
              padding: var(--bb-grid-size-2);
              border: 1px solid var(--primary);
              border-radius: var(--bb-grid-size-2);
            }
          }

          & #messages {
            position: relative;
            display: block;
            font-family: var(--font-family-mono);
            line-height: 1.5;

            & div {
              white-space: pre-wrap;
            }

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
              color: var(--n-60);
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

  constructor() {
    super();

    this.#renderMode =
      (localStorage.getItem(RENDER_MODE_KEY) as RenderMode) ?? "surfaces";

    this.#refresh();
  }

  protected willUpdate(changedProperties: PropertyValues<this>): void {
    if (changedProperties.has("selectedPath")) {
      if (this.selectedPath) {
        const path = this.selectedPath.path;
        this.#fileSystem.query(path).then((f) => this.#updateFiles(f, path));
      } else {
        this.#filesInMountedDir = [];
      }
    }

    if (changedProperties.has("selectedFilePath")) {
      this.#selectedSurface = 0;
    }
  }

  #updateFiles(f: FileSystemQueryResult, path: FileSystemPath) {
    if (!ok(f)) {
      this.#filesInMountedDir = [];
      if (f.$error === "prompt") {
        this.#showPromptOption = path;
      }
      return;
    }

    this.#showPromptOption = null;
    this.#filesInMountedDir = f.entries.sort((a, b) => {
      if (a.path > b.path) return 1;
      if (a.path < b.path) return -1;
      return 0;
    });
  }

  #refresh() {
    return this.#fileSystem.getAll().then((items) => {
      this.#dirs = items;
      if (!this.selectedPath && items.length) {
        this.selectedPath = items.at(0) ?? null;
      }
      return items;
    });
  }

  #renderSurfacesOrMessages() {
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
        ${this.#surfaces
          ? html`<select
              @change=${(evt: Event) => {
                if (!(evt.target instanceof HTMLSelectElement)) {
                  return;
                }

                this.#selectedSurface = evt.target.selectedIndex;
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
    const selectedSurfaceIndex = this.#selectedSurface;
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
            const fileName = file.path.split("/").at(-1);
            return html`<li>
              <button
                ?selected=${file.path === this.selectedFilePath}
                @click=${async () => {
                  this.#processor.clearSurfaces();

                  this.selectedFilePath = file.path;
                  const data = await this.#fileSystem.read(file.path);
                  if (!ok(data)) {
                    return;
                  }

                  try {
                    const fileData = JSON.parse(data) as EvalFileData;
                    this.#surfaces = [];
                    const a2ui: A2UIData[] = fileData.filter(
                      (item) => item.type === "a2ui"
                    );

                    this.#processor.clearSurfaces();
                    for (const { data } of a2ui.values()) {
                      for (let s = 0; s < data.length; s++) {
                        const surface = data[s];
                        this.#surfaces.push(surface);
                        if (s !== selectedSurfaceIndex) {
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
                }}
              >
                ${fileName}
              </button>
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
            Generated UI
            <button
              id="render-mode"
              @click=${() => {
                this.renderMode =
                  this.renderMode === "messages" ? "surfaces" : "messages";
              }}
            >
              <span
                class=${classMap({ active: this.#renderMode === "surfaces" })}
              >
                <span class="g-icon filled round">mobile_layout</span>Surfaces
              </span>

              <span
                class=${classMap({ active: this.#renderMode === "messages" })}
              >
                <span class="g-icon filled round">communication</span>A2UI
              </span>
            </button>
          </h2>
          ${this.#renderSurfacesOrMessages()}
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
