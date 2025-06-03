/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import type { LLMContent } from "@breadboard-ai/types";
import { LitElement, PropertyValueMap, css, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { map } from "lit/directives/map.js";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { LLMOutput } from "./llm-output.js";

@customElement("bb-llm-output-array")
export class LLMOutputArray extends LitElement {
  @property()
  accessor graphUrl: URL | null = null;

  @property()
  accessor values: LLMContent[] | null = null;

  @property()
  accessor showModeToggle = true;

  @property()
  accessor showEntrySelector = true;

  @property()
  accessor clamped = true;

  @property()
  accessor lite = false;

  @property()
  accessor showExportControls = false;

  @property()
  accessor supportedExportControls = { drive: false, clipboard: false };

  @property({ reflect: true })
  accessor selected = 0;

  @property({ reflect: true })
  accessor mode: "visual" | "json" = "visual";

  #resizeObserver: ResizeObserver | null = null;
  #activeLLMContentRef: Ref<LLMOutput> = createRef();
  #containerRef: Ref<HTMLDivElement> = createRef();

  static styles = css`
    * {
      box-sizing: border-box;
    }

    :host {
      display: block;
    }

    #controls {
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: flex-end;
      margin: var(--bb-grid-size-4) 0 var(--bb-grid-size-2) 0;
      min-height: var(--bb-grid-size-7);
    }

    #controls h1 {
      font: 400 var(--bb-label-large) / var(--bb-label-line-height-large)
        var(--bb-font-family);
      margin-right: var(--bb-grid-size);
    }

    #controls #role-buttons {
      flex: 1;
    }

    #controls button {
      cursor: pointer;
      width: var(--bb-grid-size-7);
      height: var(--bb-grid-size-7);
      margin-right: var(--bb-grid-size);
      border-radius: 50%;
      border: 1px solid var(--bb-neutral-300);
      font-size: 0;
      background: var(--bb-neutral-0) var(--bb-icon-human) center center / 20px
        20px no-repeat;
    }

    #controls button.model {
      background: var(--bb-neutral-0) var(--bb-icon-model) center center / 20px
        20px no-repeat;
    }

    #controls button.user {
      background: var(--bb-neutral-0) var(--bb-icon-human) center center / 20px
        20px no-repeat;
    }

    #controls button[disabled] {
      cursor: auto;
      background-color: var(--bb-ui-100);
    }

    #controls select {
      display: block;
      border-radius: var(--bb-grid-size);
      background: var(--bb-neutral-0);
      padding: var(--bb-grid-size) var(--bb-grid-size-2);
      border: 1px solid var(--bb-neutral-300);
    }

    bb-llm-output {
      display: none;
    }

    bb-llm-output.visible {
      display: block;
    }

    bb-llm-output:last-of-type {
      margin-bottom: 0;
    }
  `;

  protected willUpdate(
    changedProperties:
      | PropertyValueMap<{ values: LLMContent[] | null }>
      | Map<PropertyKey, unknown>
  ): void {
    if (!changedProperties.has("values")) {
      return;
    }

    if (!this.values) {
      return;
    }

    this.selected = this.values.findLastIndex(
      (item: LLMContent | undefined) => item?.role !== "$metadata"
    );
  }

  protected updated(): void {
    if (this.#resizeObserver) {
      this.#resizeObserver.disconnect();
    }

    if (!this.#activeLLMContentRef.value) {
      return;
    }

    this.#resizeObserver = new ResizeObserver((entries) => {
      if (!this.#containerRef.value) {
        return;
      }

      const llmContents = this.#containerRef.value.querySelectorAll<LLMOutput>(
        "bb-llm-output:not(.visible)"
      );
      for (const llmContent of llmContents) {
        llmContent.style.height = `${entries[0].borderBoxSize[0].blockSize}px`;
      }
    });

    this.#resizeObserver.observe(this.#activeLLMContentRef.value);
  }

  render() {
    const showControls = this.showEntrySelector || this.showModeToggle;
    const values = this.values ?? [];
    return values
      ? html` ${showControls
            ? html`<div id="controls">
                ${this.mode === "visual" && this.showEntrySelector
                  ? html`<h1>Role</h1>
                      <div id="role-buttons">
                        ${map(values, (item, idx) => {
                          if (!item || item.role === "$metadata")
                            return nothing;
                          const roleClass = (item.role || "user")
                            .toLocaleLowerCase()
                            .replaceAll(/\s/gim, "-");
                          return html`<button
                            class=${classMap({ [roleClass]: true })}
                            ?disabled=${idx === this.selected}
                            title=${item.role || "User"}
                            @click=${() => {
                              this.selected = idx;
                            }}
                          >
                            ${item.role || "User"}
                          </button>`;
                        })}
                      </div>`
                  : nothing}
                ${this.showModeToggle
                  ? html`<select
                      @input=${(evt: Event) => {
                        if (!(evt.target instanceof HTMLSelectElement)) {
                          return;
                        }

                        const mode = evt.target.value;
                        if (mode !== "visual" && mode !== "json") {
                          return;
                        }

                        this.mode = mode;
                      }}
                    >
                      <option
                        value="visual"
                        ?selected=${this.mode === "visual"}
                      >
                        Visual Debug
                      </option>
                      <option value="json" ?selected=${this.mode === "json"}>
                        Raw data
                      </option>
                    </select>`
                  : nothing}
              </div>`
            : nothing}

          <div ${ref(this.#containerRef)}>
            ${this.mode === "visual"
              ? map(values, (item, idx) => {
                  if (!item || item.role === "$metadata") return nothing;
                  if (!this.showEntrySelector && idx < values.length - 1)
                    return nothing;
                  return html`<bb-llm-output
                    ${idx === this.selected
                      ? ref(this.#activeLLMContentRef)
                      : nothing}
                    class=${classMap({ visible: idx === this.selected })}
                    .graphUrl=${this.graphUrl}
                    .value=${item}
                    .clamped=${this.clamped}
                    .lite=${this.lite}
                    .showExportControls=${this.showExportControls}
                    .supportedExportControls=${this.supportedExportControls}
                  ></bb-llm-output>`;
                })
              : html`<bb-json-tree .json=${values}></bb-json-tree>`}
          </div>`
      : html`No items set`;
  }
}
