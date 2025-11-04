/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Signal } from "signal-polyfill";

export { now };

const now = new Signal.State(performance.now());

setInterval(() => now.set(performance.now()), 500);
