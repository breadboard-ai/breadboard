/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const pendingStorageWrites = new WeakMap<any, Promise<unknown>[]>();
