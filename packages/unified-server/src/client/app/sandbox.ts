/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { WebSandbox } from "@breadboard-ai/jsandbox/web";
import wasm from "/sandbox.wasm?url";

export { sandbox };

const sandbox = new WebSandbox(new URL(wasm, window.location.href));
