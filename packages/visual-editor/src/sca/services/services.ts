/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleDriveClient } from "@breadboard-ai/utils/google-drive/google-drive-client.js";
import { RuntimeConfig } from "../../runtime/types.js";
import {
  createActionTracker,
  createActionTrackerBackend,
} from "../../ui/utils/action-tracker.js";
import { SigninAdapter } from "../../ui/utils/signin-adapter.js";
import {
  GOOGLE_DRIVE_FILES_API_PREFIX,
  GraphLoader,
  Kit,
  OPAL_BACKEND_API_PREFIX,
  PersistentBackend,
  RuntimeFlagManager,
} from "@breadboard-ai/types";
import { createFileSystem } from "../../engine/file-system/index.js";
import { envFromSettings } from "../../utils/env-from-settings.js";
import { createFileSystemBackend } from "../../idb/index.js";
import { createEphemeralBlobStore } from "../../engine/file-system/ephemeral-blob-store.js";
import { composeFileSystemBackends } from "../../engine/file-system/composed-peristent-backend.js";
import { McpClientManager } from "../../mcp/client-manager.js";
import { builtInMcpClients } from "../../mcp-clients.js";
import { createA2ModuleFactory } from "../../a2/runnable-module-factory.js";
import { addRunModule } from "../../engine/add-run-module.js";
import { createGoogleDriveBoardServer } from "../../ui/utils/create-server.js";
import { createA2Server } from "../../a2/index.js";
import { createLoader } from "../../engine/loader/index.js";
import { createGraphStore } from "../../engine/inspector/index.js";
import { Autonamer } from "../../runtime/autonamer.js";
import { AppCatalystApiClient } from "../../ui/flow-gen/app-catalyst.js";
import { EmailPrefsManager } from "../../ui/utils/email-prefs-manager.js";
import { FlowGenerator } from "../../ui/flow-gen/flow-generator.js";
import { ActionTracker } from "../../ui/types/types.js";
import { type ConsentController } from "../controller/subcontrollers/consent-controller.js";
import { GoogleDriveBoardServer } from "../../board-server/server.js";

export interface AppServices {
  actionTracker: ActionTracker;
  autonamer: Autonamer;
  emailPrefsManager: EmailPrefsManager;
  fetchWithCreds: typeof fetch;
  fileSystem: ReturnType<typeof createFileSystem>;
  flowGenerator: FlowGenerator;
  googleDriveBoardServer: GoogleDriveBoardServer;
  googleDriveClient: GoogleDriveClient;
  graphStore: ReturnType<typeof createGraphStore>;
  kits: Kit[];
  loader: GraphLoader;
  mcpClientManager: McpClientManager;
  signinAdapter: SigninAdapter;
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
      isTestApi: !!config.guestConfig?.isTestApi,
    });

    const fileSystem = createFileSystem({
      env: [...envFromSettings(config.settings), ...(config.env || [])],
      local: createFileSystemBackend(createEphemeralBlobStore()),
      mnt: composeFileSystemBackends(
        new Map<string, PersistentBackend>([
          ["track", createActionTrackerBackend()],
        ])
      ),
    });

    const mcpClientManager = new McpClientManager(
      builtInMcpClients,
      {
        fileSystem: fileSystem,
        fetchWithCreds: fetchWithCreds,
      },
      OPAL_BACKEND_API_PREFIX
    );

    const sandbox = createA2ModuleFactory({
      mcpClientManager: mcpClientManager,
      fetchWithCreds: fetchWithCreds,
      shell: config.shellHost,
      getConsentController,
    });
    const kits = addRunModule(sandbox, []);
    const googleDriveBoardServer = createGoogleDriveBoardServer(
      signinAdapter,
      googleDriveClient,
      config.shellHost.findUserOpalFolder,
      config.shellHost.listUserOpals
    );
    const a2Server = createA2Server();
    const loader = createLoader([googleDriveBoardServer, a2Server]);
    const graphStoreArgs = {
      kits,
      loader,
      sandbox,
      fileSystem,
      flags,
    };

    const graphStore = createGraphStore(graphStoreArgs);
    for (const [, item] of a2Server.userGraphs?.entries() || []) {
      graphStore.addByURL(item.url, [], {});
    }

    const autonamer = new Autonamer(graphStoreArgs, fileSystem, sandbox);
    const apiClient = new AppCatalystApiClient(
      fetchWithCreds,
      OPAL_BACKEND_API_PREFIX
    );
    const emailPrefsManager = new EmailPrefsManager(apiClient);
    const flowGenerator = new FlowGenerator(apiClient, flags);

    instance = {
      actionTracker,
      autonamer,
      emailPrefsManager,
      fetchWithCreds,
      fileSystem,
      flowGenerator,
      googleDriveBoardServer,
      googleDriveClient,
      graphStore,
      kits,
      loader,
      mcpClientManager,
      signinAdapter,
    } satisfies AppServices;
  }

  return instance;
}
