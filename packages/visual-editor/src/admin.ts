/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleDriveClient } from "@breadboard-ai/google-drive-kit/google-drive-client.js";
import { MainArguments } from "./types/types.js";

import { Types } from "@breadboard-ai/shared-ui";
import { GoogleDriveBoardServer } from "@breadboard-ai/google-drive-kit";

import { RuntimeInstance } from "./runtime/runtime.js";
import { RuntimeFlagManager } from "@breadboard-ai/types";
import type { GlobalConfig } from "@breadboard-ai/shared-ui/contexts/global-config.js";

/**
 * An interface for owners functionality - a command center console for executing operations which
 * are not intended for users - e.g. Drive debug info, publishing boards to the featured library and etc.
 */
export class Admin {
  constructor(
    public readonly args: MainArguments,
    public readonly globalConfig: GlobalConfig,
    public readonly gDriveClient: GoogleDriveClient
  ) {
    if (window.location.hash?.includes("owner-tools")) {
      (window as unknown as Record<string, unknown>)["o"] = this;
    }
  }

  settingsHelper?: Types.SettingsHelper;
  driveBoardServer?: GoogleDriveBoardServer;
  runtime!: RuntimeInstance;
  flags!: RuntimeFlagManager;

  help() {
    return {
      args: "MainArguments instance",
      env: "Environment instance",
      // TODO(volodya): Implement.
      publish:
        "await publish({[fileId]}) publishes the current (or specified) board to the featured gallery.",
      gdrive: this.gdrive.help(),
      cache: this.cache.help(),
    };
  }

  #gdriveBoardServer(): GoogleDriveBoardServer {
    return this.runtime.board
      .getBoardServers()
      .find((s) =>
        s.url.href.startsWith(GoogleDriveBoardServer.PROTOCOL)
      ) as GoogleDriveBoardServer;
  }

  get gdrive() {
    return {
      help: () => {
        return {
          info: "Returns basic information about Google Drive board server",
        };
      },
      info: async () => {
        return {
          folderId: await this.#gdriveBoardServer().ops.findFolder(),
        };
      },
    };
  }

  get cache() {
    return {
      help() {
        return {
          invalidate:
            "Hard refresh by deleting all caching data and reloading lists",
          update:
            "Gentle refresh - fetching list of changed files from Google Drive and notifying caches",
        };
      },
      invalidate: async () => {
        await this.#gdriveBoardServer().ops.forceRefreshCaches();
        return "Caches reloaded";
      },

      /** Gentle update changes */
      update: async () => {
        await this.#gdriveBoardServer().ops.updateCachesOneTime();
      },
    };
  }
}
