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

export function assertHTMLElement(
  value: unknown
): asserts value is HTMLElement {
  if (!(value instanceof HTMLElement)) {
    throw new Error("Element is not HTMLElement");
  }
}

export function assertSVGElement(value: unknown): asserts value is SVGElement {
  if (!(value instanceof SVGElement)) {
    throw new Error("Element is not HTMLElement");
  }
}

export function assertSelectElement(
  value: unknown
): asserts value is HTMLSelectElement {
  if (!(value instanceof HTMLSelectElement)) {
    throw new Error("Element is not HTMLSelectElement");
  }
}

export function assertPointerEvent(
  value: Event
): asserts value is PointerEvent {
  if (!(value instanceof PointerEvent)) {
    throw new Error("Not a pointer event");
  }
}

export function assertMouseWheelEvent(
  value: Event
): asserts value is WheelEvent {
  if (!(value instanceof WheelEvent)) {
    throw new Error("Not a wheel event");
  }
}
