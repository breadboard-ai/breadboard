/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  MoveToSelection,
  WorkspaceSelectionChangeId,
  WorkspaceSelectionState,
} from "./types.js";

const eventInit = {
  bubbles: true,
  cancelable: true,
  composed: true,
};

/**
 * Event dispatched when the workspace selection changes.
 * This is currently the only runtime event still in use - all others have been
 * migrated to reactive signal-based patterns in the SCA architecture.
 */
export class RuntimeSelectionChangeEvent extends Event {
  static eventName = "runtimeselectionchange" as const;

  constructor(
    public readonly selectionChangeId: WorkspaceSelectionChangeId,
    public readonly selectionState: WorkspaceSelectionState,
    public readonly moveToSelection: MoveToSelection
  ) {
    super(RuntimeSelectionChangeEvent.eventName, { ...eventInit });
  }
}

declare global {
  interface EventTarget {
    addEventListener(
      type: typeof RuntimeSelectionChangeEvent.eventName,
      listener: (evt: RuntimeSelectionChangeEvent) => void,
      options?: boolean | AddEventListenerOptions
    ): void;
  }
}
