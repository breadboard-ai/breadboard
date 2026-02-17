/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleDriveClient } from "@breadboard-ai/utils/google-drive/google-drive-client.js";
import type { EmbedHandler } from "@breadboard-ai/types/embedder.js";
import type { OpalShellHostProtocol } from "@breadboard-ai/types/opal-shell-protocol.js";
import { RuntimeConfig } from "../../utils/graph-types.js";
import type { GlobalConfig } from "../../ui/contexts/global-config.js";
import { createActionTracker } from "../../ui/utils/action-tracker.js";
import { SigninAdapter } from "../../ui/utils/signin-adapter.js";
import {
  GOOGLE_DRIVE_FILES_API_PREFIX,
  GraphLoader,
  NOTEBOOKLM_API_PREFIX,
  OPAL_BACKEND_API_PREFIX,
  RuntimeFlagManager,
} from "@breadboard-ai/types";
import type { RunnableModuleFactory } from "@breadboard-ai/types/sandbox.js";
import type { GuestConfiguration } from "@breadboard-ai/types/opal-shell-protocol.js";

import { McpClientManager } from "../../mcp/client-manager.js";
import { builtInMcpClients } from "../../mcp-clients.js";
import { IntegrationManagerService } from "./integration-managers.js";
import { createA2ModuleFactory } from "../../a2/runnable-module-factory.js";
import { AgentContext } from "../../a2/agent/agent-context.js";
import { createGoogleDriveBoardServer } from "../../ui/utils/create-server.js";

import { createLoader } from "../../engine/loader/index.js";
import { Autonamer } from "./autonamer.js";
import { AppCatalystApiClient } from "../../ui/flow-gen/app-catalyst.js";
import { EmailPrefsManager } from "../../ui/utils/email-prefs-manager.js";
import { FlowGenerator } from "../../ui/flow-gen/flow-generator.js";
import { ActionTracker, UserSignInResponse } from "../../ui/types/types.js";
import { type ConsentController } from "../controller/subcontrollers/global/global.js";
import { GoogleDriveBoardServer } from "../../board-server/server.js";
import { RunService } from "./run-service.js";
import { StatusUpdatesService } from "./status-updates-service.js";
import { getLogger, Formatter } from "../utils/logging/logger.js";
import { NotebookLmApiClient } from "./notebooklm-api-client.js";
import type { OAuthScope } from "../../ui/connection/oauth-scopes.js";
import { GraphEditingAgentService } from "./graph-editing-agent-service.js";

export interface AppServices {
  actionTracker: ActionTracker;
  /**
   * A function reference for prompting the user to sign in.
   * Set by MainBase during initialization. DOM-coupled (uses sign-in modal).
   */
  askUserToSignInIfNeeded: (
    scopes?: OAuthScope[]
  ) => Promise<UserSignInResponse>;
  embedHandler: EmbedHandler | undefined;
  agentContext: AgentContext;
  apiClient: AppCatalystApiClient;
  autonamer: Autonamer;
  globalConfig: GlobalConfig;
  guestConfig: GuestConfiguration;
  emailPrefsManager: EmailPrefsManager;
  fetchWithCreds: typeof fetch;

  flowGenerator: FlowGenerator;
  googleDriveBoardServer: GoogleDriveBoardServer;
  googleDriveClient: GoogleDriveClient;
  loader: GraphLoader;
  mcpClientManager: McpClientManager;
  integrationManagers: IntegrationManagerService;
  notebookLmApiClient: NotebookLmApiClient;
  runService: RunService;
  graphEditingAgentService: GraphEditingAgentService;
  sandbox: RunnableModuleFactory;
  signinAdapter: SigninAdapter;
  /**
   * An EventTarget for dispatching StateEvents into the SCA trigger system.
   * handleRoutedEvent re-dispatches its events onto this bus so that
   * SCA actions with eventTrigger can listen for them.
   */
  stateEventBus: EventTarget;
  statusUpdates: StatusUpdatesService;
  shellHost: OpalShellHostProtocol;
}

let instance: AppServices | null = null;

export function services(
  config: RuntimeConfig,
  flags: RuntimeFlagManager,
  getConsentController: () => ConsentController
) {
  if (!instance) {
    const signinAdapter = new SigninAdapter(config.shellHost);
    const fetchWithCreds = signinAdapter.fetchWithCreds;

    const actionTracker = createActionTracker(config.shellHost);

    const proxyApiBaseUrl = new URL(
      "/api/drive-proxy/drive/v3/files",
      window.location.href
    ).href;
    const apiBaseUrl = signinAdapter.state.then((state) =>
      state === "signedout" ? proxyApiBaseUrl : GOOGLE_DRIVE_FILES_API_PREFIX
    );
    const googleDriveClient = new GoogleDriveClient({
      apiBaseUrl,
      proxyApiBaseUrl,
      fetchWithCreds: fetchWithCreds,
      log(level, ...args) {
        const logger = getLogger();
        const msg =
          level === "warning"
            ? Formatter.warning(...args)
            : Formatter.verbose(...args);
        logger.log(msg, "Google Drive");
      },
    });

    const mcpClientManager = new McpClientManager(
      builtInMcpClients,
      {
        fetchWithCreds: fetchWithCreds,
      },
      OPAL_BACKEND_API_PREFIX
    );

    const agentContext = new AgentContext({
      shell: config.shellHost,
      fetchWithCreds,
    });

    const notebookLmApiClient = new NotebookLmApiClient(
      fetchWithCreds,
      NOTEBOOKLM_API_PREFIX,
      OPAL_BACKEND_API_PREFIX
    );

    const sandbox = createA2ModuleFactory({
      mcpClientManager: mcpClientManager,
      fetchWithCreds: fetchWithCreds,
      shell: config.shellHost,
      getConsentController,
      agentContext,
      notebookLmApiClient,
    });
    const googleDriveBoardServer = createGoogleDriveBoardServer(
      signinAdapter,
      googleDriveClient,
      config.shellHost.findUserOpalFolder,
      config.shellHost.listUserOpals
    );
    const loader = createLoader(googleDriveBoardServer);
    const graphStoreArgs = {
      loader,
      sandbox,
      flags,
    };

    const autonamer = new Autonamer(graphStoreArgs, sandbox);
    const apiClient = new AppCatalystApiClient(
      fetchWithCreds,
      OPAL_BACKEND_API_PREFIX
    );
    const emailPrefsManager = new EmailPrefsManager(apiClient);
    const flowGenerator = new FlowGenerator(apiClient, flags);

    instance = {
      actionTracker,
      askUserToSignInIfNeeded:
        config.askUserToSignInIfNeeded ??
        (async () => "failure" as UserSignInResponse),
      embedHandler: config.embedHandler,
      agentContext,
      apiClient,
      autonamer,
      globalConfig: config.globalConfig,
      guestConfig: config.guestConfig,
      emailPrefsManager,
      fetchWithCreds,

      flowGenerator,
      googleDriveBoardServer,
      googleDriveClient,
      integrationManagers: new IntegrationManagerService(),
      loader,
      mcpClientManager,
      notebookLmApiClient,
      runService: new RunService(),
      graphEditingAgentService: new GraphEditingAgentService(),
      sandbox,
      signinAdapter,
      stateEventBus: new EventTarget(),
      statusUpdates: new StatusUpdatesService(),
      shellHost: config.shellHost,
    } satisfies AppServices;
  }

  return instance;
}
