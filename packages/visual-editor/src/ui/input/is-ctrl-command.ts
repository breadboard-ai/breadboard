/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export function isCtrlCommand(evt: PointerEvent | KeyboardEvent | WheelEvent) {
  const isMac = isMacPlatform();
  return isMac ? evt.metaKey : evt.ctrlKey;
}

export function isMacPlatform() {
  return navigator.platform.indexOf("Mac") === 0;
}
