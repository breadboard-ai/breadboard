/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ReactiveController, ReactiveControllerHost } from "lit";
import { effect } from "signal-utils/subtle/microtask-effect";

export function connectedEffect(
  host: ReactiveControllerHost,
  cb: () => unknown
) {
  new ConnectedEffectController(host, cb);
}

class ConnectedEffectController implements ReactiveController {
  #cb: () => unknown;
  #unwatch?: () => void;

  constructor(host: ReactiveControllerHost, cb: () => unknown) {
    this.#cb = cb;
    host.addController(this);
  }

  hostConnected() {
    this.#unwatch = effect(this.#cb);
  }

  hostDisconnected() {
    this.#unwatch?.();
    this.#unwatch = undefined;
  }
}
