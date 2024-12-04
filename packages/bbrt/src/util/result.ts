/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export type Result<T, E = unknown> =
  | { ok: true; value: T; error?: undefined }
  | { ok: false; value?: undefined; error: E };
