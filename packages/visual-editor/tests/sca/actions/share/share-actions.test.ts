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
      { edges: [], nodes: [], url: "drive:/test-drive-id" },
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

  test("publish", async () => {
    const { controller } = makeTestController();
    const createdPermissions: gapi.client.drive.Permission[] = [];
    const createdBoards: Array<{ url: string }> = [];
    const { services } = makeTestServices({
      googleDriveClient: {
        getFileMetadata: async () => ({
          id: "test-drive-id",
          properties: {},
          ownedByMe: true,
          version: "1",
        }),
        updateFileMetadata: async () => ({ version: "2" }),
        createPermission: async (
          _fileId: string,
          permission: gapi.client.drive.Permission
        ) => {
          createdPermissions.push(permission);
          return { ...permission, id: "permission-id" };
        },
      } as object as Partial<GoogleDriveClient>,
      signinAdapter: {
        domain: Promise.resolve("example.com"),
      },
      googleDriveBoardServer: {
        create: async (url: URL) => {
          createdBoards.push({ url: url.toString() });
          return {
            result: true,
            url: "drive:/shareable-copy-id",
          };
        },
        flushSaveQueue: async () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
      },
    });
    ShareActions.bind({ controller, services });
    const share = controller.editor.share;

    // Open and load to get to writable state
    ShareActions.openPanel();
    await ShareActions.readPublishedState(
      { edges: [], nodes: [], url: "drive:/test-drive-id" },
      []
    );
    assert.strictEqual(share.state.status, "writable");
    assert.strictEqual(share.state.published, false);

    // Publish
    const graph = { edges: [], nodes: [], url: "drive:/test-drive-id" };
    const publishPermissions = [{ type: "domain", domain: "example.com" }];
    await ShareActions.publish(graph, publishPermissions, undefined);

    // Verify shareable copy was created via boardServer.create()
    assert.strictEqual(createdBoards.length, 1);
    assert.strictEqual(
      createdBoards[0].url,
      "drive:/test-drive-id-shared.bgl.json"
    );

    // Verify state is now published
    assert.strictEqual(share.state.status, "writable");
    assert.strictEqual(share.state.published, true);

    // Verify permission was created with role: "reader"
    assert.strictEqual(createdPermissions.length, 1);
    assert.deepEqual(createdPermissions[0], {
      type: "domain",
      domain: "example.com",
      role: "reader",
    });
  });

  test("unpublish", async () => {
    const { controller } = makeTestController();
    const deletedPermissionIds: string[] = [];
    const { services } = makeTestServices({
      googleDriveClient: {
        getFileMetadata: async () => ({
          id: "test-drive-id",
          properties: {},
          ownedByMe: true,
          version: "1",
        }),
        updateFileMetadata: async () => ({ version: "2" }),
        createPermission: async (
          _fileId: string,
          permission: gapi.client.drive.Permission
        ) => ({ ...permission, id: "permission-123" }),
        deletePermission: async (_fileId: string, permissionId: string) => {
          deletedPermissionIds.push(permissionId);
        },
      } as object as Partial<GoogleDriveClient>,
      signinAdapter: {
        domain: Promise.resolve("example.com"),
      },
      googleDriveBoardServer: {
        create: async () => ({
          result: true,
          url: "drive:/shareable-copy-id",
        }),
        flushSaveQueue: async () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
      },
    });
    ShareActions.bind({ controller, services });
    const share = controller.editor.share;

    // Open, load, and publish to get to published state
    ShareActions.openPanel();
    await ShareActions.readPublishedState(
      { edges: [], nodes: [], url: "drive:/test-drive-id" },
      []
    );
    const graph = { edges: [], nodes: [], url: "drive:/test-drive-id" };
    const publishPermissions = [{ type: "domain", domain: "example.com" }];
    await ShareActions.publish(graph, publishPermissions, undefined);
    assert.strictEqual(share.state.status, "writable");
    assert.strictEqual(share.state.published, true);

    // Unpublish
    await ShareActions.unpublish(graph);

    // Verify state is now unpublished
    assert.strictEqual(share.state.status, "writable");
    assert.strictEqual(share.state.published, false);

    // Verify permission was deleted
    assert.strictEqual(deletedPermissionIds.length, 1);
    assert.strictEqual(deletedPermissionIds[0], "permission-123");
  });

  test("readonly when not owned by me", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices({
      googleDriveClient: {
        getFileMetadata: async () => ({
          id: "test-drive-id",
          properties: {},
          ownedByMe: false,
          resourceKey: "resource-key-123",
        }),
      } as object as Partial<GoogleDriveClient>,
    });
    ShareActions.bind({ controller, services });
    const share = controller.editor.share;

    ShareActions.openPanel();
    await ShareActions.readPublishedState(
      { edges: [], nodes: [], url: "drive:/test-drive-id" },
      []
    );

    assert.strictEqual(share.state.status, "readonly");
    assert.deepEqual(share.state.shareableFile, {
      id: "test-drive-id",
      resourceKey: "resource-key-123",
    });
  });

  test("readonly when file is a shareable copy", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices({
      googleDriveClient: {
        getFileMetadata: async () => ({
          id: "shareable-copy-id",
          properties: {
            // This property indicates the file is a shareable copy
            shareableCopyToMain: "main-file-id",
          },
          ownedByMe: true,
          resourceKey: "shareable-resource-key",
        }),
      } as object as Partial<GoogleDriveClient>,
    });
    ShareActions.bind({ controller, services });
    const share = controller.editor.share;

    ShareActions.openPanel();
    await ShareActions.readPublishedState(
      { edges: [], nodes: [], url: "drive:/shareable-copy-id" },
      []
    );

    assert.strictEqual(share.state.status, "readonly");
    assert.deepEqual(share.state.shareableFile, {
      id: "shareable-copy-id",
      resourceKey: "shareable-resource-key",
    });
  });

  test("publishStale updates shareable copy and clears stale flag", async () => {
    const { controller } = makeTestController();
    const writtenUrls: string[] = [];
    const updatedMetadataFileIds: string[] = [];
    const { services } = makeTestServices({
      googleDriveClient: {
        getFileMetadata: async (fileId: string) => {
          if (fileId === "test-drive-id") {
            return {
              id: "test-drive-id",
              properties: {
                mainToShareableCopy: "shareable-copy-id",
              },
              ownedByMe: true,
              version: "5",
            };
          }
          // shareable copy metadata
          return {
            id: "shareable-copy-id",
            resourceKey: "shareable-resource-key",
            properties: {
              latestSharedVersion: "3", // older version, so stale
            },
            permissions: [
              { type: "domain", domain: "example.com", role: "reader" },
            ],
          };
        },
        updateFileMetadata: async (fileId: string) => {
          updatedMetadataFileIds.push(fileId);
          return { version: "5" };
        },
      } as object as Partial<GoogleDriveClient>,
      signinAdapter: {
        domain: Promise.resolve("example.com"),
      },
      googleDriveBoardServer: {
        flushSaveQueue: async () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        ops: {
          writeGraphToDrive: async (url: URL) => {
            writtenUrls.push(url.toString());
          },
        },
      },
    });
    ShareActions.bind({ controller, services });
    const share = controller.editor.share;

    // Open and load to get to writable state with stale shareable copy
    ShareActions.openPanel();
    await ShareActions.readPublishedState(
      { edges: [], nodes: [], url: "drive:/test-drive-id" },
      [{ type: "domain", domain: "example.com" }]
    );
    assert.strictEqual(share.state.status, "writable");
    assert.strictEqual(share.state.shareableFile?.stale, true);

    // Publish stale
    const graph = { edges: [], nodes: [], url: "drive:/test-drive-id" };
    await ShareActions.publishStale(graph);

    // Verify shareable copy was updated
    assert.deepEqual(writtenUrls, ["drive:/shareable-copy-id"]);

    // Verify metadata was updated
    assert.strictEqual(
      updatedMetadataFileIds.includes("shareable-copy-id"),
      true
    );

    // Verify stale flag is now false
    assert.strictEqual(share.state.status, "writable");
    assert.strictEqual(share.state.shareableFile?.stale, false);
  });

  test("granular sharing", async () => {
    const { controller } = makeTestController();
    // Track the permissions on the shareable copy - starts empty
    let shareableCopyPermissions: gapi.client.drive.Permission[] = [];
    const { services } = makeTestServices({
      googleDriveClient: {
        getFileMetadata: async (fileId: string) => {
          if (fileId === "test-drive-id") {
            return {
              id: "test-drive-id",
              properties: {
                mainToShareableCopy: "shareable-copy-id",
              },
              ownedByMe: true,
              version: "1",
            };
          }
          // shareable copy metadata
          return {
            id: "shareable-copy-id",
            resourceKey: "shareable-resource-key",
            properties: {},
            permissions: shareableCopyPermissions,
          };
        },
        updateFileMetadata: async () => ({ version: "1" }),
      } as object as Partial<GoogleDriveClient>,
      signinAdapter: {
        domain: Promise.resolve("example.com"),
      },
      googleDriveBoardServer: {
        flushSaveQueue: async () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
      },
    });
    ShareActions.bind({ controller, services });
    const share = controller.editor.share;
    const graph = { edges: [], nodes: [], url: "drive:/test-drive-id" };
    const publishPermissions = [{ type: "domain", domain: "example.com" }];

    // Open and load - initially not published
    ShareActions.openPanel();
    await ShareActions.readPublishedState(graph, publishPermissions);
    assert.strictEqual(share.state.status, "writable");
    assert.strictEqual(share.state.published, false);
    assert.strictEqual(share.state.granularlyShared, false);

    // User opens granular sharing dialog
    await ShareActions.viewSharePermissions(graph, undefined);
    assert.deepEqual(share.state, {
      status: "granular",
      shareableFile: { id: "shareable-copy-id" },
    });

    // User adds individual permission
    shareableCopyPermissions = [
      { type: "user", emailAddress: "somebody@example.com", role: "reader" },
    ];

    // User closes granular sharing dialog
    await ShareActions.onGoogleDriveSharePanelClose(graph);
    await ShareActions.readPublishedState(graph, publishPermissions);

    // We should now be granularly shared, but not published
    assert.strictEqual(share.state.status, "writable");
    assert.strictEqual(share.state.granularlyShared, true);
    assert.strictEqual(share.state.published, false);

    // User opens granular sharing again
    await ShareActions.viewSharePermissions(graph, undefined);
    assert.deepEqual(share.state, {
      status: "granular",
      shareableFile: { id: "shareable-copy-id" },
    });

    // User adds domain permission
    shareableCopyPermissions = [
      { type: "user", emailAddress: "somebody@example.com", role: "reader" },
      { type: "domain", domain: "example.com", role: "reader" },
    ];

    // User closes the dialog
    await ShareActions.onGoogleDriveSharePanelClose(graph);
    await ShareActions.readPublishedState(graph, publishPermissions);

    // We should now be granularly shared and published
    assert.strictEqual(share.state.status, "writable");
    assert.strictEqual(share.state.granularlyShared, true);
    assert.strictEqual(share.state.published, true);
  });
});
