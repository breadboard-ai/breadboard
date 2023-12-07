/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export function assertRoot(value: unknown): asserts value is ShadowRoot {
  if (value === null) {
    throw new Error("There is no shadow root");
  }
}

export function assertElement(value: unknown): asserts value is HTMLElement {
  if (value === null) {
    throw new Error("Unable to find element");
  }
}

export function assertPointerEvent(
  value: Event
): asserts value is PointerEvent {
  if (!("clientX" in value)) {
    throw new Error("Not a pointer event");
  }
}
