/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Controller } from "../controller/controller.js";
import { effect } from "signal-utils/subtle/microtask-effect";
import { isHydrating } from "../controller/utils/hydration.js";

type Disposer = () => void;
type Effect = () => void;

export class WindowDecorator {
  #disposers = new Map<string, Disposer>();

  constructor(private controller: Controller) {}

  connect() {
    this.#register("theme", () => {
      const mode = this.controller.theme.mode;
      if (isHydrating(mode)) return;

      const csStyle =
        document.head.querySelector("#color-scheme") ??
        document.createElement("style");
      csStyle.id = "color-scheme";
      csStyle.textContent = `
        :root {
          --color-scheme: ${mode};
          color-scheme: var(--color-scheme);
        }`;
      document.head.appendChild(csStyle);
    });

    this.#register("windowTitle", () => {
      const mode = this.controller.theme.mode;
      if (isHydrating(mode)) return;

      window.document.title = `Demo (${
        mode === "dark" ? "Dark" : "Light"
      } Mode)`;
    });
  }

  #register(name: string, effectFn: Effect) {
    this.#disposers.set(name, effect(effectFn));
  }

  disconnect() {
    for (const disposer of this.#disposers.values()) {
      disposer.call(this);
    }
  }
}
