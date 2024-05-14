/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css, nothing, PropertyValueMap } from "lit";
import { customElement, property } from "lit/decorators.js";
import { AllowedLLMContentTypes, LLMContent } from "../../../types/types.js";
import { map } from "lit/directives/map.js";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { LLMInput } from "./llm-input.js";
import { classMap } from "lit/directives/class-map.js";

@customElement("bb-llm-input-array")
export class LLMInputArray extends LitElement {
  @property()
  values: LLMContent[] | null = null;

  @property()
  description: string | null = null;

  @property({ reflect: true })
  minimal = false;

  @property()
  minItems = 0;

  @property()
  allow: AllowedLLMContentTypes = {
    audioFile: true,
    audioMicrophone: true,
    videoFile: true,
    videoWebcam: true,
    imageFile: true,
    imageWebcam: true,
    imageDrawable: true,
    textFile: true,
    textInline: true,
  };

  @property({ reflect: true })
  selected = 0;

  #resizeObserver: ResizeObserver | null = null;
  #activeLLMContentRef: Ref<LLMInput> = createRef();

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
      margin: var(--bb-grid-size-4) 0 var(--bb-grid-size-2) 0;
      min-height: var(--bb-grid-size-7);
    }

    #controls h1 {
      font: 400 var(--bb-label-large) / var(--bb-label-line-height-large)
        var(--bb-font-family);
      margin-right: var(--bb-grid-size);
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

    bb-llm-input {
      display: none;
    }

    bb-llm-input.visible {
      display: block;
    }
  `;

  #containerRef: Ref<HTMLDivElement> = createRef();

  processAllOpenParts() {
    if (!this.#containerRef.value) {
      return;
    }

    const inputs =
      this.#containerRef.value.querySelectorAll<LLMInput>("bb-llm-input");
    return Promise.all([...inputs].map((input) => input.processAllOpenParts()));
  }

  hasMinItems(): boolean {
    if (!this.#containerRef.value) {
      return false;
    }

    const inputs =
      this.#containerRef.value.querySelectorAll<LLMInput>("bb-llm-input");
    return [...inputs].every((input) => input.hasMinItems());
  }

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

    if (this.values.length === 0) {
      this.values.push({ role: "user", parts: [] });
    }

    this.selected = this.values.length - 1;
  }

  protected updated(): void {
    if (this.#resizeObserver) {
      this.#resizeObserver.disconnect();
    }

    if (!this.#activeLLMContentRef.value) {
      return;
    }

    this.#resizeObserver = new ResizeObserver(() => {
      if (!this.#containerRef.value) {
        return;
      }

      if (!this.#activeLLMContentRef.value) {
        return;
      }

      const containerHeight =
        this.#activeLLMContentRef.value.getContainerHeight();
      const llmContents = this.#containerRef.value.querySelectorAll<LLMInput>(
        "bb-llm-input:not(.visible)"
      );
      for (const llmContent of llmContents) {
        llmContent.setContainerHeight(containerHeight);
      }
    });

    this.#resizeObserver.observe(this.#activeLLMContentRef.value);
  }

  render() {
    return html`<header>
        ${this.description ? html`${this.description}` : nothing}
      </header>

      <div id="controls">
        <h1>Role</h1>
        ${this.values && this.values.length
          ? map(this.values, (item, idx) => {
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
            })
          : html`No items specified`}
      </div>

      <div ${ref(this.#containerRef)}>
        ${this.values
          ? map(this.values, (value, idx) => {
              return html`<bb-llm-input
                class=${classMap({ visible: idx === this.selected })}
                @input=${(evt: Event) => {
                  if (!this.values) {
                    return;
                  }

                  if (!(evt.target instanceof LLMInput)) {
                    return;
                  }

                  if (!evt.target.value) {
                    return;
                  }

                  this.values[idx] = evt.target.value;
                }}
                ${idx === this.selected
                  ? ref(this.#activeLLMContentRef)
                  : nothing}
                .value=${value}
                .minimal=${this.minimal}
                .minItems=${this.minItems}
                .allow=${this.allow}
              ></bb-llm-input>`;
            })
          : html`No items specified`}
      </div> `;
  }
}
