/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleDriveClient } from "@breadboard-ai/google-drive-kit/google-drive-client.js";
import { MainArguments } from "./types/types.js";

import { Types } from "@breadboard-ai/shared-ui";
import { GoogleDriveBoardServer } from "@breadboard-ai/google-drive-kit";

import { Runtime } from "./runtime/runtime.js";
import { RuntimeFlagManager } from "@breadboard-ai/types";
import type { GlobalConfig } from "@breadboard-ai/shared-ui/contexts/global-config.js";
import { SigninAdapter } from "@breadboard-ai/shared-ui/utils/signin-adapter";
import {
  TokenVendor,
  ValidTokenResult,
} from "@breadboard-ai/connection-client";
import { Project } from "@breadboard-ai/shared-ui/state/types.js";

/**
 * An interface for owners functionality - a command center console for executing operations which
 * are not intended for users - e.g. Drive debug info, publishing boards to the featured library and etc.
 */
export class Admin {
  readonly testing: TestingHarness;

  constructor(
    public readonly args: MainArguments,
    public readonly globalConfig: GlobalConfig,
    public readonly gDriveClient: GoogleDriveClient,
    public readonly signinAdapter: SigninAdapter,
    public readonly tokenVendor: TokenVendor
  ) {
    if (window.location.hash?.includes("owner-tools")) {
      (window as unknown as Record<string, unknown>)["o"] = this;
    }
    this.testing = new TestingHarness();
  }

  settingsHelper?: Types.SettingsHelper;
  driveBoardServer?: GoogleDriveBoardServer;
  runtime!: Runtime;
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

  get project(): Project | null {
    const tab = this.runtime.board.tabs.values().next().value;
    if (!tab) return null;
    return this.runtime.state.getOrCreateProjectState(tab.mainGraphId);
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
    };
  }
}

/** Facilitates mocks/fakes for UI tests. */
export class TestingHarness {
  #originalToken?: Function;

  setupLoginBypass() {
    if (
      this.#originalToken &&
      SigninAdapter.prototype.token === TestingHarness.#fakeToken
    ) {
      return "Login bypass was already installed";
    }
    if (!this.#originalToken) {
      // Save the original token function to restore it later.
      this.#originalToken = SigninAdapter.prototype.token;
    }

    SigninAdapter.prototype.token = TestingHarness.#fakeToken;
    return "Login bypassed has been established";
  }

  static #fakeToken(): Promise<ValidTokenResult> {
    return Promise.resolve({
      state: "valid",
      grant: {
        client_id: "ui-tests",
        access_token: "ui-test-only",
        expires_in: 3600,
        issue_time: Date.now(),
        domain: undefined,
        scopes: undefined,
      },
    });
  }
}
