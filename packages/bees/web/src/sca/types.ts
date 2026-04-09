/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Signal } from "@lit-labs/signals";

export type pending = symbol;

export type PrimitiveType =
  | string
  | number
  | boolean
  | null
  | symbol
  | { [key: string]: PrimitiveType }
  | object
  | Map<string, PrimitiveValue>
  | Set<PrimitiveType>
  | PrimitiveType[];

export type PrimitiveValue = PrimitiveType | pending;

export interface Storage {
  get<T extends PrimitiveType>(name: string): Promise<T | null>;
  set<T extends PrimitiveType>(name: string, value: T): Promise<void>;
  clear(): Promise<void>;
  delete(name: string): Promise<void>;
}

export interface HydratedController {
  isHydrated: Promise<number>;
  isSettled: Promise<void[]>;
  registerSignalHydration(signal: Signal.State<unknown>): void;
}

export interface ChatMessage {
  text: string;
  role: "agent" | "user" | "thought" | "tool" | "error";
  id?: string;
}

export interface ChatThread {
  id: string;
  title: string;
  ticketIds: string[];
  activeTicketId: string | null;
  hasUnread: boolean;
}

export interface ToastMessage {
  id: string;
  message: string;
  type: "error" | "info" | "success";
  timeoutMs?: number;
}

import { BeesAPI } from "./services/api.js";
import { SSEClient } from "./services/sse.js";
import { HostCommunicationService } from "./services/host-communication.js";

export interface AppServices {
  api: BeesAPI;
  sse: SSEClient;
  hostCommunication: HostCommunicationService;
  stateEventBus: EventTarget;
}

import type { GlobalController } from "./controller/subcontrollers/global.js";
import type { AgentTreeController } from "./controller/subcontrollers/agent-tree.js";
import type { ChatController } from "./controller/subcontrollers/chat.js";
import type { StageController } from "./controller/subcontrollers/stage.js";

export interface AppController {
  isHydrated: Promise<number[]>;
  global: GlobalController;
  agentTree: AgentTreeController;
  chat: ChatController;
  stage: StageController;
}

export interface AppActions {
  sync: typeof import("./actions/sync/sync-actions.js");
  chat: typeof import("./actions/chat/chat-actions.js");
  stage: typeof import("./actions/stage/stage-actions.js");
  tree: typeof import("./actions/tree/tree-actions.js");
}
