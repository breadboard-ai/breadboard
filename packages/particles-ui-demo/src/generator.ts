/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Receiver } from "./receiver.js";

export { Generator };

class Generator {
  #receiver: Receiver | undefined;

  connect(receiver: Receiver) {
    this.#receiver = receiver;
  }
}
