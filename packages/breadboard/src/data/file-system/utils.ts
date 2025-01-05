/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Outcome } from "../types.js";

export { ok, err };

function ok<T>(o: Outcome<T>): o is T {
  return !(o && typeof o === "object" && "$error" in o);
}

function err($error: string) {
  return { $error };
}
