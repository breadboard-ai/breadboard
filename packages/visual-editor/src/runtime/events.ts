/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { HarnessRunner, RunEventMap } from "@breadboard-ai/types";
import {
  MoveToSelection,
  Tab,
  TabId,
  VisualEditorMode,
  WorkspaceSelectionChangeId,
  WorkspaceSelectionState,
  WorkspaceVisualChangeId,
} from "./types";
import * as BreadboardUI from "@breadboard-ai/shared-ui";
import {
  EditHistoryCreator,
  NodeConfiguration,
  NodeIdentifier,
} from "@google-labs/breadboard";
import { AutonameStatus } from "@breadboard-ai/shared-ui/sideboards/autoname.js";
import { ToastType } from "@breadboard-ai/shared-ui/events/events.js";

const eventInit = {
  bubbles: true,
  cancelable: true,
  composed: true,
};

export class RuntimeBoardSaveStatusChangeEvent extends Event {
  static eventName = "runtimeboardsavestatuschange" as const;

  constructor() {
    super(RuntimeBoardSaveStatusChangeEvent.eventName, { ...eventInit });
  }
}

export class RuntimeToastEvent extends Event {
  static eventName = "runtimetoast" as const;

  constructor(
    public readonly toastId: ReturnType<typeof globalThis.crypto.randomUUID>,
    public readonly toastType: ToastType,
    public readonly message: string,
    public readonly persistent = false
  ) {
    super(RuntimeToastEvent.eventName, { ...eventInit });
  }

  clone() {
    return new RuntimeToastEvent(
      this.toastId,
      this.toastType,
      this.message,
      this.persistent
    );
  }
}

export class RuntimeUnsnackbarEvent extends Event {
  static eventName = "runtimeunsnackbar" as const;

  constructor() {
    super(RuntimeUnsnackbarEvent.eventName, { ...eventInit });
  }

  clone() {
    return new RuntimeUnsnackbarEvent();
  }
}

export class RuntimeSnackbarEvent extends Event {
  static eventName = "runtimesnackbar" as const;

  constructor(
    public readonly snackbarId = globalThis.crypto.randomUUID(),
    public readonly message: string,
    public readonly snackType: BreadboardUI.Types.SnackType,
    public readonly actions: BreadboardUI.Types.SnackbarAction[] = [],
    public readonly persistent = false,
    public readonly replaceAll = false
  ) {
    super(RuntimeSnackbarEvent.eventName, { ...eventInit });
  }

  clone() {
    return new RuntimeSnackbarEvent(
      this.snackbarId,
      this.message,
      this.snackType,
      this.actions,
      this.persistent,
      this.replaceAll
    );
  }
}

export class RuntimeBoardLoadErrorEvent extends Event {
  static eventName = "runtimeboardloaderror" as const;

  constructor() {
    super(RuntimeBoardLoadErrorEvent.eventName, { ...eventInit });
  }
}

export class RuntimeShareMissingEvent extends Event {
  static eventName = "runtimesharemissing" as const;

  constructor() {
    super(RuntimeShareMissingEvent.eventName, { ...eventInit });
  }
}

export class RuntimeRequestSignInEvent extends Event {
  static eventName = "runtimerequestsignin" as const;

  constructor() {
    super(RuntimeRequestSignInEvent.eventName, { ...eventInit });
  }
}

export class RuntimeErrorEvent extends Event {
  static eventName = "runtimeerror" as const;

  constructor(public readonly message: string) {
    super(RuntimeErrorEvent.eventName, { ...eventInit });
  }
}

export class RuntimeBoardEnhanceEvent extends Event {
  static eventName = "runtimeboardenhance" as const;

  constructor(
    public readonly tabId: TabId | null,
    public readonly affectedNodes: NodeIdentifier[],
    public readonly configuration: NodeConfiguration
  ) {
    super(RuntimeBoardEnhanceEvent.eventName, { ...eventInit });
  }
}

export class RuntimeBoardAutonameEvent extends Event {
  static eventName = "runtimeboardautoname" as const;

  constructor(public readonly status: AutonameStatus) {
    super(RuntimeBoardAutonameEvent.eventName, { ...eventInit });
  }
}

export class RuntimeBoardEditEvent extends Event {
  static eventName = "runtimeboardedit" as const;

  constructor(
    public readonly tabId: TabId | null,
    public readonly affectedNodes: NodeIdentifier[],
    public readonly visualOnly = false
  ) {
    super(RuntimeBoardEditEvent.eventName, { ...eventInit });
  }
}

export class RuntimeBoardServerChangeEvent extends Event {
  static eventName = "runtimeboardserverchange" as const;

  constructor(
    public readonly connectedBoardServerName?: string,
    public readonly connectedBoardServerURL?: string
  ) {
    super(RuntimeBoardServerChangeEvent.eventName, { ...eventInit });
  }
}

export class RuntimeNewerSharedVersionEvent extends Event {
  static eventName = "runtimenewersharedversion" as const;

  constructor() {
    super(RuntimeNewerSharedVersionEvent.eventName, { ...eventInit });
  }
}

export class RuntimeTabChangeEvent extends Event {
  static eventName = "runtimetabchange" as const;

  constructor(
    public readonly topGraphObserver?: BreadboardUI.Utils.TopGraphObserver
  ) {
    super(RuntimeTabChangeEvent.eventName, { ...eventInit });
  }
}

export class RuntimeTabCloseEvent extends Event {
  static eventName = "runtimetabclose" as const;

  constructor(public readonly tabId: TabId) {
    super(RuntimeTabCloseEvent.eventName, { ...eventInit });
  }
}

export class RuntimeModuleChangeEvent extends Event {
  static eventName = "runtimemodulechange" as const;

  constructor() {
    super(RuntimeModuleChangeEvent.eventName, { ...eventInit });
  }
}

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

export class RuntimeVisualChangeEvent extends Event {
  static eventName = "runtimevisualchange" as const;

  constructor(public readonly visualChangeId: WorkspaceVisualChangeId) {
    super(RuntimeVisualChangeEvent.eventName, { ...eventInit });
  }
}

export class RuntimeWorkspaceItemChangeEvent extends Event {
  static eventName = "runtimeworkspaceitemchange" as const;

  constructor() {
    super(RuntimeWorkspaceItemChangeEvent.eventName, { ...eventInit });
  }
}

export class RuntimeBoardRunEvent extends Event {
  static eventName = "runtimeboardrun" as const;

  constructor(
    public readonly tabId: TabId,
    public readonly runEvt: RunEventMap[keyof RunEventMap],
    public readonly harnessRunner: HarnessRunner,
    public readonly abortController: AbortController
  ) {
    super(RuntimeBoardRunEvent.eventName, { ...eventInit });
  }
}

export class RuntimeURLChangeEvent extends Event {
  static eventName = "runtimeurlchange" as const;

  constructor(
    public readonly url: URL,
    public readonly mode: VisualEditorMode,
    public readonly id?: TabId,
    public readonly creator?: EditHistoryCreator,
    public readonly resultsFileId?: string
  ) {
    super(RuntimeURLChangeEvent.eventName, { ...eventInit });
  }
}

export class RuntimeHostAPIEvent extends Event {
  static eventName = "runtimehostapi" as const;

  constructor(
    public readonly tab: Tab,
    public readonly message: string,
    public readonly args: unknown[]
  ) {
    super(RuntimeHostAPIEvent.eventName, { ...eventInit });
  }
}

export class RuntimeHostStatusUpdateEvent extends Event {
  static eventName = "runtimehoststatusupdate" as const;

  constructor(
    public readonly updates: BreadboardUI.Types.VisualEditorStatusUpdate[]
  ) {
    super(RuntimeHostStatusUpdateEvent.eventName, { ...eventInit });
  }

  clone() {
    return new RuntimeHostStatusUpdateEvent(this.updates);
  }
}

type RuntimeEvents =
  | RuntimeBoardLoadErrorEvent
  | RuntimeErrorEvent
  | RuntimeBoardEditEvent
  | RuntimeTabChangeEvent
  | RuntimeTabCloseEvent
  | RuntimeBoardRunEvent;

declare global {
  interface EventTarget {
    addEventListener<E extends RuntimeEvents>(
      type: string,
      listener: (evt: E) => void,
      options?: boolean | AddEventListenerOptions
    ): void;
  }
}
