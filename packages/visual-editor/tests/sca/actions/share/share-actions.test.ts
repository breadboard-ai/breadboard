/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { describe, test } from "node:test";
import * as ShareActions from "../../../../src/sca/actions/share/share-actions.js";
import { makeTestController, makeTestServices } from "../../helpers/index.js";
import type { GoogleDriveClient } from "@breadboard-ai/utils/google-drive/google-drive-client.js";

describe("Share Actions", () => {
  test("open -> load -> close", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices({
      googleDriveClient: {
        getFileMetadata: async () => ({
          id: "test-drive-id",
          properties: {},
          ownedByMe: true,
          version: "1",
        }),
      } as object as Partial<GoogleDriveClient>,
      signinAdapter: {
        domain: Promise.resolve("example.com"),
      },
    });
    ShareActions.bind({ controller, services });
    const share = controller.editor.share;

    // Panel is initially closed
    assert.deepEqual(share.state, { status: "closed" });

    // User opens panel
    ShareActions.openPanel();
    assert.deepEqual(share.state, { status: "opening" });

    // Panel starts loading
    const loaded = ShareActions.readPublishedState(
      { edges: [], nodes: [], url: "drive://test-drive-id" },
      []
    );
    assert.deepEqual(share.state, { status: "loading" });

    // Can't close while loading
    ShareActions.closePanel();
    assert.deepEqual(share.state, { status: "loading" });

    // Finish loading
    await loaded;
    assert.deepEqual(share.state, {
      status: "writable",
      granularlyShared: false,
      latestVersion: "1",
      published: false,
      shareableFile: undefined,
      userDomain: "example.com",
    });

    // User closes panel
    ShareActions.closePanel();
    assert.deepEqual(share.state, { status: "closed" });
  });
});