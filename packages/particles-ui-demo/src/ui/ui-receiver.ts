/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SignalWatcher } from "@lit-labs/signals";
import { css, html, HTMLTemplateResult, LitElement, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import * as ParticlesUI from "@breadboard-ai/particles-ui";
import { themeContext } from "./context/theme.js";
import { provide } from "@lit/context";
import { styleMap } from "lit/directives/style-map.js";

/**
 * The Receiver side of the channel, a proxy that represents the Generator.
 */
export type GeneratorProxy = {
  requestAddItem(): Promise<void>;
  requestUpdateField(
    parentId: string,
    id: string,
    value: string | boolean
  ): Promise<void>;
  requestDelete(itemId: string): Promise<void>;
};

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
  accessor list: ParticlesUI.Types.ItemList | null = null;

  @property()
  accessor additionalStyles: Record<string, string> | null = null;

  @provide({ context: themeContext })
  accessor theme: ParticlesUI.Types.UITheme | undefined;

  static styles = [
    ParticlesUI.Styles.all,
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
        const done = !!item.data?.["done"];
        this.channel?.requestUpdateField(id, "done", !done);
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
      case "list": {
        renderable = html`<particle-ui-list
          @input=${this.#onInput}
          @click=${this.#onClick}
          .list=${this.list}
          .orientation=${this.list?.presentation.orientation}
        ></particle-ui-list>`;
        break;
      }
    }

    return html`<div
      style=${styleMap(this.additionalStyles ? this.additionalStyles : {})}
    >
      ${renderable}
    </div>`;
  }
}
