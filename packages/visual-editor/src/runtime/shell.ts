/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type * as BreadboardUI from "@breadboard-ai/shared-ui";
import { RuntimeHostStatusUpdateEvent } from "./events";

const UPDATE_REFRESH_TIMEOUT = 30_000;

export class Shell extends EventTarget {
  constructor(
    private readonly appName: string,
    private readonly appSubName: string
  ) {
    super();
  }

  setPageTitle(title: string | null) {
    const suffix = `${this.appName} [${this.appSubName}]`;
    if (title) {
      title = title.trim();
      window.document.title = `${title} - ${suffix}`;
      return;
    }

    window.document.title = suffix;
  }

  async #fetchUpdates(): Promise<
    BreadboardUI.Types.VisualEditorStatusUpdate[]
  > {
    const response = await fetch("/updates");
    const updates = await response.json();
    return updates as BreadboardUI.Types.VisualEditorStatusUpdate[];
  }

  #nextTick = 0;
  async startTrackUpdates() {
    const emitUpdate = async () => {
      try {
        const updates = await this.#fetchUpdates();
        this.dispatchEvent(new RuntimeHostStatusUpdateEvent(updates));
      } catch (err) {
        console.warn(err);
      } finally {
        this.#nextTick = window.setTimeout(emitUpdate, UPDATE_REFRESH_TIMEOUT);
      }

      return this.#nextTick;
    };

    if (this.#nextTick !== 0) {
      return;
    }

    this.#nextTick = await emitUpdate();
  }

  stopTrackUpdates() {
    window.clearTimeout(this.#nextTick);
    this.#nextTick = 0;
  }
}
