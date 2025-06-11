/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SignalWatcher } from "@lit-labs/signals";
import { html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { Receiver } from "../receiver";

import "./todo-list";

function findElementIn<T extends HTMLElement>(
  evt: Event,
  predicate: (t: EventTarget) => boolean
): T | undefined {
  const item = evt.composedPath().find(predicate);
  if (!(item instanceof HTMLElement)) {
    return;
  }

  return item as T;
}

function extractPathAndBehavior<T extends HTMLElement>(evt: Event) {
  const target = findElementIn<T>(
    evt,
    (el) => el instanceof HTMLElement && el.dataset.behavior !== undefined
  );
  const path = findElementIn(
    evt,
    (el) => el instanceof HTMLElement && el.dataset.id !== undefined
  );

  let id;
  if (path) id = path.dataset.id;

  return {
    target,
    id,
  };
}

@customElement("ui-receiver")
export class UiReceiver extends SignalWatcher(LitElement) {
  @property()
  accessor receiver: Receiver | null = null;

  render() {
    return html`<todo-list
      @input=${(evt: Event) => {
        const { target, id } = extractPathAndBehavior<HTMLInputElement>(evt);
        if (!target || !id) {
          return;
        }

        switch (target.dataset.behavior) {
          case "editable": {
            this.receiver?.channel.requestUpdateField(
              id,
              target.id,
              target.value
            );
            return;
          }
        }
      }}
      @click=${(evt: Event) => {
        const { target, id } = extractPathAndBehavior<HTMLInputElement>(evt);
        console.log(target, id);
        if (!target) {
          return;
        }

        switch (target.dataset.behavior) {
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
            this.receiver?.channel?.requestUpdateDone(id, !item.done);
            break;
          }
        }
      }}
      .items=${this.receiver?.list.items}
      .channel=${this.receiver?.channel}
    ></todo-list>`;
  }
}
