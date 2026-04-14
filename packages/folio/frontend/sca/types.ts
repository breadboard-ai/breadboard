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
import type { AppEnvironment } from "./environment/environment.js";
import type * as RouterActions from "./actions/router/router-actions.js";
import type { Signal } from "@lit-labs/signals";
import { PENDING_HYDRATION } from "./utils/sentinel.js";
import type { GlobalController } from "./controller/subcontrollers/global/global.js";
import type { RouterController } from "./controller/subcontrollers/router/router-controller.js";

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
  readonly parsedUrl: MakeUrlInit;
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
  lite?: boolean;
  colorScheme?: "light" | "dark";
  guestPrefixed: boolean;
}

export interface HomeUrlInit extends BaseUrlInit {
  page: "home";
  new?: boolean;
  redirectFromLanding?: boolean;
}

export interface GraphUrlInit extends BaseUrlInit {
  page: "graph";
  mode: "app" | "canvas";
  flow: string;
  remix?: boolean;
  resourceKey?: string | undefined;
  results?: string;
  redirectFromLanding?: boolean;
}

export interface LandingUrlInit extends BaseUrlInit {
  page: "landing";
  redirect: MakeUrlInit;
  missingScopes?: boolean;
  geoRestriction?: boolean;
  autoSignIn?: boolean;
}

export interface OpenUrlInit extends BaseUrlInit {
  page: "open";
  fileId: string;
  resourceKey?: string;
}

export type MakeUrlInit =
  | HomeUrlInit
  | GraphUrlInit
  | LandingUrlInit
  | OpenUrlInit;

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

export interface AppActions {
  router: typeof RouterActions;
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

export interface AppController extends HydratedController {
  global: GlobalController;
  router: RouterController;
}

export interface HydratedController {
  isHydrated: Promise<number>;
  isSettled: Promise<void[]>;
  registerSignalHydration(signal: Signal.State<unknown>): void;
}
