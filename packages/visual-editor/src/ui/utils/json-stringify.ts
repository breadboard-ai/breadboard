/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export function jsonStringify(title: string) {
  const stringified = JSON.stringify(title);
  return stringified.slice(1, stringified.length - 1);
}
