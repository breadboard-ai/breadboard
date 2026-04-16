/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Types for Folio.
 * Reduced to the bare minimum.
 */

import type { AppServices } from "./services/services.js";
import type { EnvironmentFlags } from "./environment/environment-flags.js";
import type * as RouterActions from "./actions/router/router-actions.js";

export interface AppEnvironment {
  readonly flags: EnvironmentFlags;
  readonly isHydrated: Promise<number>;
}
import type * as ThemeActions from "./actions/theme/theme-actions.js";
import type { Signal } from "@lit-labs/signals";
import { PENDING_HYDRATION } from "./utils/sentinel.js";
import type { GlobalController } from "./controller/subcontrollers/global/global.js";
import type { RouterController } from "./controller/subcontrollers/router/router-controller.js";
import type { ThemeController } from "./controller/subcontrollers/global/theme-controller.js";
import type { AgentController } from "./controller/subcontrollers/agent/agent-controller.js";

export type pending = typeof PENDING_HYDRATION;

export interface FolioBlock {
  id: string;
  type: string;
  status: string;
  content: unknown;
  timestamp?: number;
}

export interface AgentProjection {
  id: string;
  name: string;
  status: string;
  blocks: FolioBlock[];
}

export type ParsedUrlProvider = {
  readonly parsedUrl: FolioUrlInit;
};

export interface BaseUrlInit {
  dev?: {
    forceSignInState?:
      | "sign-in"
      | "add-scope"
      | "geo-restriction"
      | "missing-scopes";
    forceSurveySelection?: "true";
  };
  oauthRedirect?: string;
  colorScheme?: "light" | "dark";
}

export interface HomeUrlInit extends BaseUrlInit {
  page: "home";
}

export interface AgentUrlInit extends BaseUrlInit {
  page: "agent";
  agentId: string;
}

export interface AgentTaskUrlInit extends BaseUrlInit {
  page: "agent-task";
  agentId: string;
  taskId: string;
}

export type FolioUrlInit = HomeUrlInit | AgentUrlInit | AgentTaskUrlInit;

export type ActionBind = {
  /** The application controller tree (editor, global, run subcontrollers). */
  controller: AppController;
  /** The stateless service layer (APIs, loaders, board servers). */
  services: AppServices;
  /**
   * The Environment — deployment config, feature flags, and host capabilities.
   * Prefer `env.flags.get("flagName")` for reactive flag reads.
   */
  env: AppEnvironment;
};

export enum ToastType {
  INFORMATION = "information",
  WARNING = "warning",
  ERROR = "error",
  PENDING = "pending",
}

export enum STATUS {
  RUNNING = "running",
  PAUSED = "paused",
  STOPPED = "stopped",
}

export type ThemeMode = "light" | "dark" | "auto";

export interface AppActions {
  router: typeof RouterActions;
  theme: typeof ThemeActions;
}

export type PrimitiveType =
  | string
  | number
  | boolean
  | null
  | symbol
  | { [key: string]: PrimitiveType }
  | object
  | Map<string, PrimitiveType>
  | Set<PrimitiveType>
  | PrimitiveType[];

export interface Storage {
  get<T extends PrimitiveType>(name: string): Promise<T | null>;
  set<T extends PrimitiveType>(name: string, value: T): Promise<void>;
  clear(): Promise<void>;
  delete(name: string): Promise<void>;
}

export interface AgentCard {
  id: string;
  header: string;
  content: string;
  cta?: {
    title: string;
    price?: string;
    icon?: string;
    logo?: string;
    primary: string;
    secondary?: string;
  };
}

export interface Agent {
  id: string;
  name: string;
  bgColor: string;
  fgColor: string;
  count: number;
  cards: AgentCard[];
}

export interface AppController extends HydratedController {
  global: GlobalController;
  theme: ThemeController;
  router: RouterController;
  agent: AgentController;
}

export interface HydratedController {
  isHydrated: Promise<number>;
  isSettled: Promise<void[]>;
  registerSignalHydration(signal: Signal.State<unknown>): void;
}
