/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SignalWatcher } from "@lit-labs/signals";
import { css, html, HTMLTemplateResult, LitElement, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { styles } from "./styles/index.js";
import { ElementType, GeneratorProxy, TodoList } from "../types/types";
import { themeContext } from "./context/theme.js";
import { provide } from "@lit/context";
import { UITheme } from "./theme/default.js";

import "./elements/list.js";
import { styleMap } from "lit/directives/style-map.js";

function extractId(evt: Event): string | undefined {
  const item = evt
    .composedPath()
    .find((el) => el instanceof HTMLElement && el.dataset.id !== undefined);
  if (item instanceof HTMLElement) {
    return item.dataset.id;
  }
}

function extractInput(
  evt: Event
): HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | undefined {
  const item = evt
    .composedPath()
    .find(
      (el) =>
        el instanceof HTMLInputElement ||
        el instanceof HTMLSelectElement ||
        el instanceof HTMLTextAreaElement
    );
  if (item instanceof HTMLElement) {
    return item;
  }
}

function extractBehavior(evt: Event): string | undefined {
  const item = evt
    .composedPath()
    .find(
      (el) => el instanceof HTMLElement && el.dataset.behavior !== undefined
    );
  if (item instanceof HTMLElement) {
    return item.dataset.behavior;
  }
}

@customElement("ui-receiver")
export class UiReceiver extends SignalWatcher(LitElement) {
  @property()
  accessor channel: GeneratorProxy | null = null;

  @property()
  accessor list: TodoList | null = null;

  @property()
  accessor colors: Record<string, string> | null = null;

  @provide({ context: themeContext })
  accessor theme: UITheme | undefined;

  static styles = [
    styles,
    css`
      :host {
        display: block;
      }
    `,
  ];

  #onInput(evt: Event) {
    const id = extractId(evt);
    const target = extractInput(evt);
    if (!id || !target) {
      return;
    }

    this.channel?.requestUpdateField(id, target.id, target.value);
  }

  #onClick(evt: Event) {
    const id = extractId(evt);
    const behavior = extractBehavior(evt);
    if (!behavior) {
      return;
    }

    switch (behavior) {
      case "add": {
        this.channel?.requestAddItem();
        break;
      }

      case "delete": {
        if (!id) {
          break;
        }

        this.channel?.requestDelete(id);
        break;
      }

      case "done": {
        if (!id) {
          break;
        }

        const item = this.list?.items?.get(id);
        if (!item) {
          break;
        }
        this.channel?.requestUpdateField(id, "done", !item.done);
        break;
      }
    }
  }

  render() {
    if (!this.theme) {
      return nothing;
    }

    let renderable: HTMLTemplateResult | symbol = nothing;
    switch (this.list?.presentation.type) {
      case ElementType.LIST: {
        renderable = html`<ui-list
          @input=${this.#onInput}
          @click=${this.#onClick}
          .list=${this.list}
        ></ui-list>`;
        break;
      }
    }

    return html`<div style=${styleMap(this.colors ? this.colors : {})}>
      ${renderable}
    </div>`;
  }
}
