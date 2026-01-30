/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import type * as BreadboardUI from "../ui/index.js";
import { Router } from "./router.js";
import { Board } from "./board.js";
import { Edit } from "./edit.js";
import { Util } from "./util.js";
import { RuntimeConfig } from "./types.js";

export * as Events from "./events.js";
export * as Types from "./types.js";

import { Select } from "./select.js";
import { StateManager } from "./state.js";
import { Shell } from "./shell.js";
import {
  OPAL_BACKEND_API_PREFIX,
  RuntimeFlagManager,
} from "@breadboard-ai/types";
import {
  RuntimeHostStatusUpdateEvent,
  RuntimeSnackbarEvent,
  RuntimeToastEvent,
  RuntimeUnsnackbarEvent,
} from "./events.js";
import { GoogleDriveClient } from "@breadboard-ai/utils/google-drive/google-drive-client.js";
import { McpClientManager } from "../mcp/index.js";
import { FileSystem } from "@breadboard-ai/types";
import { SigninAdapter } from "../ui/utils/signin-adapter.js";
import { GoogleDriveBoardServer } from "../board-server/server.js";
import { FlowGenerator } from "../ui/flow-gen/flow-generator.js";
import { AppCatalystApiClient } from "../ui/flow-gen/app-catalyst.js";
import { EmailPrefsManager } from "../ui/utils/email-prefs-manager.js";
import { ActionTracker } from "../ui/types/types.js";
import { AppController } from "../sca/controller/controller.js";
import { SCA } from "../sca/sca.js";

export class Runtime extends EventTarget {
  public readonly shell: Shell;
  public readonly router: Router;
  public readonly board: Board;
  public readonly edit: Edit;
  public readonly select: Select;
  public readonly state: StateManager;
  public readonly flags: RuntimeFlagManager;
  public readonly util: typeof Util;
  public readonly fetchWithCreds: typeof globalThis.fetch;
  public readonly signinAdapter: SigninAdapter;
  public readonly googleDriveClient: GoogleDriveClient;
  public readonly fileSystem: FileSystem;
  public readonly mcpClientManager: McpClientManager;
  public readonly googleDriveBoardServer: GoogleDriveBoardServer;
  public readonly flowGenerator: FlowGenerator;
  public readonly apiClient: AppCatalystApiClient;
  public readonly actionTracker: ActionTracker;
  public readonly emailPrefsManager: EmailPrefsManager;
  private readonly appController: AppController;

  /**
   * @deprecated Keep for backward compatibility
   */
  private readonly __sca: SCA;

  constructor(config: RuntimeConfig) {
    super();

    if (!config.sca) throw new Error("Expected SCA");

    this.__sca = config.sca;
    this.appController = config.sca.controller;
    this.flags = this.appController.global.flags;

    this.signinAdapter = config.sca.services.signinAdapter;
    this.fetchWithCreds = config.sca.services.fetchWithCreds;
    this.actionTracker = config.sca.services.actionTracker;
    this.googleDriveClient = config.sca.services.googleDriveClient;
    this.fileSystem = config.sca.services.fileSystem;
    this.mcpClientManager = config.sca.services.mcpClientManager;
    this.googleDriveBoardServer = config.sca.services.googleDriveBoardServer;
    this.emailPrefsManager = config.sca.services.emailPrefsManager;
    this.flowGenerator = config.sca.services.flowGenerator;

    this.shell = new Shell();
    this.board = new Board();
    this.util = Util;
    this.select = new Select();
    this.router = new Router();
    this.edit = new Edit();
    this.apiClient = new AppCatalystApiClient(
      this.fetchWithCreds,
      OPAL_BACKEND_API_PREFIX
    );

    this.state = new StateManager(
      this,
      this.__sca.services.graphStore,
      this.appController,
      config.sca
    );

    this.#setupPassthruHandlers();
  }

  snackbar(
    snackbarId: ReturnType<typeof globalThis.crypto.randomUUID>,
    message: string,
    type: BreadboardUI.Types.SnackType,
    actions: BreadboardUI.Types.SnackbarAction[],
    persistent: boolean,
    replaceAll: boolean
  ) {
    this.dispatchEvent(
      new RuntimeSnackbarEvent(
        snackbarId,
        message,
        type,
        actions,
        persistent,
        replaceAll
      )
    );
  }

  unsnackbar() {
    this.dispatchEvent(new RuntimeUnsnackbarEvent());
  }

  #setupPassthruHandlers() {
    const cancelClone = (
      evt:
        | RuntimeToastEvent
        | RuntimeSnackbarEvent
        | RuntimeUnsnackbarEvent
        | RuntimeHostStatusUpdateEvent
    ) => {
      evt.stopPropagation();
      evt.preventDefault();
      return evt.clone();
    };

    this.board.addEventListener(
      RuntimeToastEvent.eventName,
      (evt: RuntimeToastEvent) => {
        const newEvt = cancelClone(evt);
        this.dispatchEvent(newEvt);
      }
    );

    this.board.addEventListener(
      RuntimeSnackbarEvent.eventName,
      (evt: RuntimeSnackbarEvent) => {
        const newEvt = cancelClone(evt);
        this.dispatchEvent(newEvt);
      }
    );

    this.board.addEventListener(
      RuntimeUnsnackbarEvent.eventName,
      (evt: RuntimeUnsnackbarEvent) => {
        const newEvt = cancelClone(evt);
        this.dispatchEvent(newEvt);
      }
    );

    this.shell.addEventListener(
      RuntimeHostStatusUpdateEvent.eventName,
      (evt: RuntimeHostStatusUpdateEvent) => {
        const newEvt = cancelClone(evt);
        this.dispatchEvent(newEvt);
      }
    );
  }
}
