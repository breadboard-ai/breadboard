/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SignalWatcher } from "@lit-labs/signals";
import { css, html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { Receiver } from "../receiver";
import { styles, theme } from "./styles/default.js";
import { ElementType } from "../types/types";

import "./elements/list.js";

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
  accessor receiver: Receiver | null = null;

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

    this.receiver?.channel.requestUpdateField(id, target.id, target.value);
  }

  #onClick(evt: Event) {
    const id = extractId(evt);
    const behavior = extractBehavior(evt);
    if (!behavior) {
      return;
    }

    switch (behavior) {
      case "add": {
        this.receiver?.channel?.requestAddItem();
        break;
      }

      case "delete": {
        if (!id) {
          break;
        }

        this.receiver?.channel?.requestDelete(id);
        break;
      }

      case "done": {
        if (!id) {
          break;
        }

        const item = this.receiver?.list.items?.get(id);
        if (!item) {
          break;
        }
        this.receiver?.channel?.requestUpdateField(id, "done", !item.done);
        break;
      }
    }
  }

  render() {
    switch (this.receiver?.list.presentation.type) {
      case ElementType.LIST: {
        return html` <ui-list
          @input=${this.#onInput}
          @click=${this.#onClick}
          .theme=${theme}
          .list=${this.receiver?.list}
        ></ui-list>`;
      }
    }
  }
}
