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

import { html, css, nothing, TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { Root } from "./root.js";
import { StringValue } from "../types/primitives.js";
import { A2UIModelProcessor } from "../data/model-processor.js";
import { extractStringValue } from "./utils/utils.js";
import { detectMedia } from "./utils/detect-media.js";
import { AnyComponentNode } from "../types/types.js";

export { MultipleChoice };

/**
 * Multiple choice selector component.
 *
 * Renders radio buttons when `maxAllowedSelections` is 1,
 * and checkboxes when `maxAllowedSelections` is greater than 1.
 *
 * Resolves option labels via `extractStringValue` and writes the
 * selected values back via `processor.setData()` as a `string[]`.
 */
@customElement("a2ui-multiplechoice")
class MultipleChoice extends Root {
  @property()
  accessor description: string | null = null;

  @property()
  accessor options: {
    label?: StringValue;
    value: string;
    child?: AnyComponentNode;
  }[] = [];

  @property()
  accessor selections: { path?: string; literalArray?: string[] } = {};

  @property({ type: Number })
  accessor maxAllowedSelections: number | undefined = undefined;

  @state()
  accessor #selected: string[] = [];

  static styles = [
    css`
      * {
        box-sizing: border-box;
      }

      :host {
        display: block;
        width: 100%;
        flex: var(--weight);
        min-height: 0;
        overflow: auto;
        container-type: inline-size;
      }

      fieldset {
        border: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: var(--a2ui-spacing-4);
      }

      legend {
        font-family: var(--a2ui-font-family);
        font-weight: 500;
        font-size: 14px;
        line-height: 20px;
        padding: 0;
        margin-bottom: var(--a2ui-spacing-2);
      }

      label {
        display: inline-flex;
        align-items: center;
        gap: var(--a2ui-spacing-2);
        padding: var(--a2ui-spacing-3) var(--a2ui-spacing-4);
        min-height: 76px;
        border-radius: var(--a2ui-border-radius-lg);
        border: 2px solid transparent;
        background-color: light-dark(var(--n-100), var(--n-15));
        font-family: var(--a2ui-font-family-flex);
        font-variation-settings: "ROND" 100;
        font-weight: 400;
        font-size: 16px;
        line-height: 20px;
        cursor: pointer;
        transition:
          background-color 0.15s ease,
          border-color 0.15s ease;
      }

      /* Media options: full-bleed content, label clips to border-radius. */
      label.has-media {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        padding: 0;
        overflow: hidden;

        /* Text children get their own padding via token. */
        --a2ui-text-padding: var(--a2ui-spacing-4);
        --a2ui-image-padding: 0;
        --a2ui-video-padding: 0;
        --a2ui-audio-padding: var(--a2ui-spacing-2);
        --a2ui-image-radius: 0;
        --a2ui-video-radius: 0;
        --a2ui-audio-radius: 0;
        --a2ui-column-gap: 0;
        --a2ui-row-gap: 0;
      }

      label:hover {
        border-color: var(--a2ui-color-border);
      }

      label.selected {
        border-color: light-dark(var(--n-0), var(--n-100));
      }

      label.disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      input[type="radio"],
      input[type="checkbox"] {
        margin: 0;
        accent-color: light-dark(var(--n-0), var(--n-100));
      }

      @container (min-width: 480px) {
        fieldset {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: var(--a2ui-spacing-4);
        }
      }
    `,
  ];

  #setBoundValue(value: string[]) {
    if (!this.selections || !this.processor) {
      return;
    }
    if (!("path" in this.selections)) {
      return;
    }
    if (!this.selections.path) {
      return;
    }

    this.processor.setData(
      this.component,
      this.selections.path,
      value,
      this.surfaceId ?? A2UIModelProcessor.DEFAULT_SURFACE_ID
    );
  }

  #slotObserver: MutationObserver | null = null;
  #mediaOptionIndices: Set<number> = new Set();

  connectedCallback(): void {
    super.connectedCallback();
    this.#syncSelectedFromModel();

    // Use MutationObserver to assign slots when light DOM children appear.
    // Root's reactive effect defers initial child rendering to a microtask,
    // so willUpdate runs before children exist. The observer fires
    // once children are actually added. subtree: true ensures we also
    // detect media in deeply-nested children.
    this.#slotObserver = new MutationObserver(() => {
      this.#assignSlots();
      this.#detectMediaInOptions();
    });
    this.#slotObserver.observe(this, { childList: true, subtree: true });
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#slotObserver?.disconnect();
    this.#slotObserver = null;
  }

  #assignSlots() {
    let childIdx = 0;
    for (let i = 0; i < this.options.length; i++) {
      if (this.options[i].child) {
        const el = this.children[childIdx];
        if (el) {
          el.slot = `option-${i}`;
        }
        childIdx++;
      }
    }
  }

  #detectMediaInOptions() {
    const newMediaIndices = new Set<number>();
    let childIdx = 0;
    for (let i = 0; i < this.options.length; i++) {
      if (this.options[i].child) {
        const el = this.children[childIdx];
        if (el && detectMedia(el)) {
          newMediaIndices.add(i);
        }
        childIdx++;
      }
    }

    // Only trigger re-render if the set actually changed.
    if (
      newMediaIndices.size !== this.#mediaOptionIndices.size ||
      [...newMediaIndices].some((i) => !this.#mediaOptionIndices.has(i))
    ) {
      this.#mediaOptionIndices = newMediaIndices;
      this.requestUpdate();
    }
  }

  #syncSelectedFromModel() {
    if (
      !this.processor ||
      !this.component ||
      !this.selections ||
      !("path" in this.selections)
    ) {
      // Fall back to literalArray if present.
      if (
        this.selections &&
        "literalArray" in this.selections &&
        this.selections.literalArray
      ) {
        this.#selected = [...this.selections.literalArray];
      }
      return;
    }

    const selectionValue = this.processor.getData(
      this.component,
      this.selections.path!,
      this.surfaceId ?? A2UIModelProcessor.DEFAULT_SURFACE_ID
    );

    if (Array.isArray(selectionValue)) {
      this.#selected = selectionValue as string[];
    }
  }

  get #isSingleSelect(): boolean {
    return this.maxAllowedSelections === 1;
  }

  get #isAtMax(): boolean {
    if (
      this.maxAllowedSelections === undefined ||
      this.maxAllowedSelections <= 0
    ) {
      return false;
    }
    return this.#selected.length >= this.maxAllowedSelections;
  }

  #onRadioChange(value: string) {
    this.#selected = [value];
    this.#setBoundValue(this.#selected);
  }

  #onCheckboxChange(value: string, checked: boolean) {
    if (checked) {
      // Enforce max if set.
      if (this.#isAtMax) {
        return;
      }
      this.#selected = [...this.#selected, value];
    } else {
      this.#selected = this.#selected.filter((v) => v !== value);
    }
    this.#setBoundValue(this.#selected);
  }

  #renderRadio(
    option: { label?: StringValue; value: string; child?: AnyComponentNode },
    index: number
  ): TemplateResult {
    const checked = this.#selected.includes(option.value);
    const hasMedia = this.#mediaOptionIndices.has(index);
    const content = option.child
      ? html`<slot name="option-${index}"></slot>`
      : extractStringValue(
          option.label ?? null,
          this.component,
          this.processor,
          this.surfaceId
        );

    return html`<label
      class=${[checked ? "selected" : "", hasMedia ? "has-media" : ""]
        .filter(Boolean)
        .join(" ")}
      @click=${hasMedia ? () => this.#onRadioChange(option.value) : nothing}
    >
      ${hasMedia
        ? nothing
        : html`<input
            type="radio"
            name="multiplechoice"
            .value=${option.value}
            .checked=${checked}
            @change=${() => this.#onRadioChange(option.value)}
          />`}
      ${content}
    </label>`;
  }

  #renderCheckbox(
    option: { label?: StringValue; value: string; child?: AnyComponentNode },
    index: number
  ): TemplateResult {
    const checked = this.#selected.includes(option.value);
    const disabled = !checked && this.#isAtMax;
    const hasMedia = this.#mediaOptionIndices.has(index);
    const content = option.child
      ? html`<slot name="option-${index}"></slot>`
      : extractStringValue(
          option.label ?? null,
          this.component,
          this.processor,
          this.surfaceId
        );

    return html`<label
      class=${[
        checked ? "selected" : "",
        disabled ? "disabled" : "",
        hasMedia ? "has-media" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      @click=${hasMedia
        ? () => {
            if (!disabled) this.#onCheckboxChange(option.value, !checked);
          }
        : nothing}
    >
      ${hasMedia
        ? nothing
        : html`<input
            type="checkbox"
            .value=${option.value}
            .checked=${checked}
            ?disabled=${disabled}
            @change=${(evt: Event) => {
              if (!(evt.target instanceof HTMLInputElement)) {
                return;
              }
              this.#onCheckboxChange(option.value, evt.target.checked);
            }}
          />`}
      ${content}
    </label>`;
  }

  render() {
    return html`<fieldset>
      ${this.description ? html`<legend>${this.description}</legend>` : nothing}
      ${this.options.map((option, index) =>
        this.#isSingleSelect
          ? this.#renderRadio(option, index)
          : this.#renderCheckbox(option, index)
      )}
    </fieldset>`;
  }
}
