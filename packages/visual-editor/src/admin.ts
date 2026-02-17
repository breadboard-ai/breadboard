/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleDriveClient } from "@breadboard-ai/utils/google-drive/google-drive-client.js";
import { MainArguments } from "./types/types.js";

import type { GlobalConfig } from "./ui/contexts/global-config.js";
import { SigninAdapter } from "./ui/utils/signin-adapter.js";

import { GoogleDriveBoardServer } from "./board-server/server.js";

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
    public readonly signinAdapter: SigninAdapter
  ) {
    if (window.location.hash?.includes("owner-tools")) {
      (window as unknown as Record<string, unknown>)["o"] = this;
    }
    this.testing = new TestingHarness();
  }

  driveBoardServer?: GoogleDriveBoardServer;

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
    // Use the driveBoardServer property set on this class
    return this.driveBoardServer!;
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
  // #originalToken?: Function;

  setupLoginBypass() {
    // TODO(aomarks) This code assumes that we have access to a token locally,
    // which now that we have the shell, we do not. Our integration tests are
    // not currently exercised anyway, so this is just temporarily disabled
    // entirely.
    throw new Error(`Not implemented`);
    // if (
    //   this.#originalToken &&
    //   SigninAdapter.prototype.token === TestingHarness.#fakeToken
    // ) {
    //   return "Login bypass was already installed";
    // }
    // if (!this.#originalToken) {
    //   // Save the original token function to restore it later.
    //   this.#originalToken = SigninAdapter.prototype.token;
    // }

    // SigninAdapter.prototype.token = TestingHarness.#fakeToken;
    // return "Login bypassed has been established";
  }

  // static #fakeToken(): Promise<ValidTokenResult> {
  //   return Promise.resolve({
  //     state: "valid",
  //     grant: {
  //       client_id: "ui-tests",
  //       access_token: "ui-test-only",
  //       expires_in: 3600,
  //       issue_time: Date.now(),
  //       domain: undefined,
  //       scopes: undefined,
  //     },
  //   });
  // }
}
