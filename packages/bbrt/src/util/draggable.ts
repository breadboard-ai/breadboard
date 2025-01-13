/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  directive,
  PartType,
  type DirectiveParameters,
  type PartInfo,
} from "lit/directive.js";

import { nothing, type Part } from "lit";
import { AsyncDirective } from "lit/async-directive.js";

export interface DraggableHandlers {
  start?: () => void;
  drag?: (state: DraggableSize) => void;
  end?: () => void;
}

export interface DraggableSize {
  initial: number;
  current: number;
  change: number;
}

export type DraggableState =
  | {
      status: "initial";
    }
  | {
      status: "ready";
      element: Element;
      handlers: DraggableHandlers;
    }
  | {
      status: "dragging";
      element: Element;
      handlers: DraggableHandlers;
      initial: number;
      abort: AbortController;
    };

class Draggable extends AsyncDirective {
  #state: DraggableState = { status: "initial" };

  constructor(partInfo: PartInfo) {
    super(partInfo);
    if (partInfo.type !== PartType.ELEMENT) {
      throw new Error(
        "The `draggable` directive must be used in element position."
      );
    }
  }

  override render(_options: DraggableHandlers) {
    return nothing;
  }

  override update(part: Part, [handlers]: DirectiveParameters<this>) {
    const element = part.options?.host;
    if (!element || !handlers || !part.options.isConnected) {
      this.#disconnectEverything();
    }
    if (this.#state.status === "initial" || element !== this.#state.element) {
      this.#disconnectEverything();
      (element as Element).addEventListener(
        "mousedown",
        // Odd cast requirement here, since MouseEvent is a subtype of Event.
        this.#onMouseDown as (event: Event) => void
      );
      this.#state = {
        status: "ready",
        element: element as Element,
        handlers,
      };
    }
  }

  #onMouseDown = (event: MouseEvent) => {
    if (this.#state.status !== "ready") {
      return;
    }
    const abort = new AbortController();
    const opts = { signal: abort.signal };
    document.addEventListener("mousemove", this.#onMove, opts);
    globalThis.addEventListener("mouseup", this.#onDone, opts);
    globalThis.addEventListener("blur", this.#onCancel, opts);
    globalThis.addEventListener("keydown", this.#onCancel, opts);
    this.#state = {
      status: "dragging",
      element: this.#state.element,
      handlers: this.#state.handlers,
      initial: event.clientX,
      abort,
    };
    this.#state.handlers.start?.();
  };

  #onMove = (event: MouseEvent) => {
    if (this.#state.status !== "dragging") {
      return;
    }
    const change = event.clientX - this.#state.initial;
    this.#state.handlers.drag?.({
      initial: this.#state.initial,
      current: this.#state.initial + change,
      change,
    });
  };

  #onDone = () => {
    if (this.#state.status !== "dragging") {
      return;
    }
    this.#endDrag();
    this.#state.handlers.end?.();
  };

  #onCancel = () => {
    if (this.#state.status !== "dragging") {
      return;
    }
    this.#state.handlers.drag?.({
      initial: this.#state.initial,
      current: this.#state.initial,
      change: 0,
    });
    this.#endDrag();
    this.#state.handlers.end?.();
  };

  #endDrag() {
    if (this.#state.status !== "dragging") {
      return;
    }
    this.#state.abort.abort();
    this.#state = {
      status: "ready",
      element: this.#state.element,
      handlers: this.#state.handlers,
    };
  }

  #disconnectEverything() {
    if (this.#state.status === "dragging") {
      this.#endDrag();
    }
    if (this.#state.status === "ready") {
      this.#state.element.removeEventListener(
        "mousedown",
        this.#onMouseDown as (event: Event) => void
      );
    }
    this.#state = { status: "initial" };
  }
}

export const draggable = directive(Draggable);
