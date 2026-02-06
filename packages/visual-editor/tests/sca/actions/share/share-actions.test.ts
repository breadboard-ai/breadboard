/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Asset } from "@breadboard-ai/types";
import type { GoogleDriveClient } from "@breadboard-ai/utils/google-drive/google-drive-client.js";
import assert from "node:assert";
import { describe, test } from "node:test";
import * as ShareActions from "../../../../src/sca/actions/share/share-actions.js";
import { makeTestController, makeTestServices } from "../../helpers/index.js";

function makeAsset(handle: string, managed: boolean, title: string): Asset {
  return {
    data: [{ parts: [{ storedData: { handle, mimeType: "image/png" } }] }],
    metadata: { managed, title, type: "file" },
  };
}

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

  test("readonly when not owned by me but has shareable copy", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices({
      googleDriveClient: {
        getFileMetadata: async (
          fileId: string | { id: string },
          _options?: { fields?: string[] }
        ) => {
          const id = typeof fileId === "string" ? fileId : fileId.id;
          if (id === "test-drive-id") {
            return {
              id: "test-drive-id",
              properties: {
                mainToShareableCopy: "shareable-copy-id",
              },
              ownedByMe: false,
              resourceKey: "main-resource-key",
            };
          }
          if (id === "shareable-copy-id") {
            return {
              id: "shareable-copy-id",
              resourceKey: "shareable-resource-key",
            };
          }
          return { id };
        },
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
    // Should use the shareable copy's id and resourceKey, not the main file's
    assert.deepEqual(share.state.shareableFile, {
      id: "shareable-copy-id",
      resourceKey: "shareable-resource-key",
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
            return { result: true };
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

  test("managed assets get permissions synced during publish", async () => {
    const { controller } = makeTestController();
    const createdPermissions: Array<{
      fileId: string;
      permission: gapi.client.drive.Permission;
    }> = [];
    const deletedPermissions: Array<{
      fileId: string;
      permissionId: string;
    }> = [];
    const { services } = makeTestServices({
      googleDriveClient: {
        getFileMetadata: async (
          fileId: string | { id: string },
          options?: { fields?: string[] }
        ) => {
          const id = typeof fileId === "string" ? fileId : fileId.id;
          if (id === "test-drive-id") {
            // Main file - no shareable copy yet
            return {
              id: "test-drive-id",
              properties: {},
              ownedByMe: true,
              version: "1",
            };
          }
          if (id === "shareable-copy-id") {
            // If asking for permissions, return the shareable copy's permissions
            if (options?.fields?.includes("permissions")) {
              return {
                permissions: [
                  { type: "domain", domain: "example.com", role: "reader" },
                ],
              };
            }
            return {
              id: "shareable-copy-id",
              resourceKey: "shareable-resource-key",
              properties: {},
              permissions: [
                { type: "domain", domain: "example.com", role: "reader" },
              ],
            };
          }
          if (id === "managed-asset-id") {
            // Managed asset has no permissions yet - needs domain permission added
            return {
              id: "managed-asset-id",
              capabilities: { canShare: true },
              permissions: [],
            };
          }
          if (id === "cant-share-asset-id") {
            // Managed asset that can't be shared - should be skipped
            return {
              id: "cant-share-asset-id",
              capabilities: { canShare: false },
              permissions: [],
            };
          }
          if (id === "excess-perms-asset-id") {
            // Managed asset has an extra permission that needs to be removed
            return {
              id: "excess-perms-asset-id",
              capabilities: { canShare: true },
              permissions: [
                {
                  id: "excess-perm-id",
                  type: "domain",
                  domain: "example.com",
                  role: "reader",
                },
                {
                  id: "old-perm-id",
                  type: "user",
                  emailAddress: "old@example.com",
                  role: "reader",
                },
              ],
            };
          }
          return { id };
        },
        updateFileMetadata: async () => ({ version: "2" }),
        createPermission: async (
          fileId: string,
          permission: gapi.client.drive.Permission
        ) => {
          createdPermissions.push({ fileId, permission });
          return { id: "new-permission-id" };
        },
        deletePermission: async (fileId: string, permissionId: string) => {
          deletedPermissions.push({ fileId, permissionId });
        },
      } as object as Partial<GoogleDriveClient>,
      signinAdapter: {
        domain: Promise.resolve("example.com"),
      },
      googleDriveBoardServer: {
        flushSaveQueue: async () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        create: async () => ({
          result: true,
          url: "drive:/shareable-copy-id",
        }),
        ops: {
          writeGraphToDrive: async () => ({ result: true }),
        },
      },
    });
    ShareActions.bind({ controller, services });
    const share = controller.editor.share;

    // Graph with multiple managed assets
    const graph = {
      edges: [],
      nodes: [],
      url: "drive:/test-drive-id",
      assets: {
        "asset-1": makeAsset("drive:/managed-asset-id", true, "test-asset"),
        "asset-2": makeAsset(
          "drive:/cant-share-asset-id",
          true,
          "cant-share-asset"
        ),
        "asset-3": makeAsset(
          "drive:/excess-perms-asset-id",
          true,
          "excess-perms-asset"
        ),
      },
    };
    const publishPermissions = [{ type: "domain", domain: "example.com" }];

    // Open and load
    ShareActions.openPanel();
    await ShareActions.readPublishedState(graph, publishPermissions);
    assert.strictEqual(share.state.status, "writable");
    assert.strictEqual(share.state.published, false);

    // Publish
    await ShareActions.publish(graph, publishPermissions, undefined);

    // Verify managed-asset-id got the domain permission added
    const assetPermission = createdPermissions.find(
      (p) => p.fileId === "managed-asset-id"
    );
    assert.ok(assetPermission, "Managed asset should have received permission");
    assert.strictEqual(assetPermission.permission.type, "domain");
    assert.strictEqual(assetPermission.permission.domain, "example.com");

    // Verify cant-share-asset-id did NOT receive any permissions (skipped)
    const cantSharePermission = createdPermissions.find(
      (p) => p.fileId === "cant-share-asset-id"
    );
    assert.strictEqual(
      cantSharePermission,
      undefined,
      "Cant-share asset should NOT have received permission"
    );

    // Verify excess-perms-asset-id had the old permission deleted
    const deletedPerm = deletedPermissions.find(
      (p) => p.fileId === "excess-perms-asset-id"
    );
    assert.ok(deletedPerm, "Excess permission should have been deleted");
    assert.strictEqual(deletedPerm.permissionId, "old-perm-id");
  });

  test("fixUnmanagedAssetProblems adds missing permissions", async () => {
    const { controller } = makeTestController();
    const createdPermissions: Array<{
      fileId: string;
      permission: gapi.client.drive.Permission;
    }> = [];
    const { services } = makeTestServices({
      googleDriveClient: {
        getFileMetadata: async (
          fileId: string | { id: string },
          options?: { fields?: string[] }
        ) => {
          const id = typeof fileId === "string" ? fileId : fileId.id;
          if (id === "test-drive-id") {
            // Main file - no shareable copy yet
            return {
              id: "test-drive-id",
              properties: {},
              ownedByMe: true,
              version: "1",
            };
          }
          if (id === "shareable-copy-id") {
            // If asking for permissions, return the shareable copy's permissions
            if (options?.fields?.includes("permissions")) {
              return {
                permissions: [
                  { type: "domain", domain: "example.com", role: "reader" },
                ],
              };
            }
            return {
              id: "shareable-copy-id",
              resourceKey: "shareable-resource-key",
              properties: {},
              permissions: [
                { type: "domain", domain: "example.com", role: "reader" },
              ],
            };
          }
          if (id === "unmanaged-asset-id") {
            // Unmanaged asset - has share capability but no permissions
            return {
              id: "unmanaged-asset-id",
              name: "My Unmanaged File",
              iconLink: "https://example.com/icon.png",
              capabilities: { canShare: true },
              permissions: [],
            };
          }
          if (id === "cant-share-asset-id") {
            // Unmanaged asset - cannot be shared (no canShare capability)
            return {
              id: "cant-share-asset-id",
              name: "Someone Elses File",
              iconLink: "https://example.com/icon2.png",
              capabilities: { canShare: false },
              permissions: [],
            };
          }
          return { id };
        },
        updateFileMetadata: async () => ({ version: "2" }),
        createPermission: async (
          fileId: string,
          permission: gapi.client.drive.Permission
        ) => {
          createdPermissions.push({ fileId, permission });
          return { id: "new-permission-id" };
        },
      } as object as Partial<GoogleDriveClient>,
      signinAdapter: {
        domain: Promise.resolve("example.com"),
      },
      googleDriveBoardServer: {
        flushSaveQueue: async () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        create: async () => ({
          result: true,
          url: "drive:/shareable-copy-id",
        }),
        ops: {
          writeGraphToDrive: async () => ({ result: true }),
        },
      },
    });
    ShareActions.bind({ controller, services });
    const share = controller.editor.share;

    // Graph with unmanaged assets (managed: false or undefined)
    const graph = {
      edges: [],
      nodes: [],
      url: "drive:/test-drive-id",
      assets: {
        "asset-1": makeAsset(
          "drive:/unmanaged-asset-id",
          false,
          "unmanaged-asset"
        ),
        "asset-2": makeAsset(
          "drive:/cant-share-asset-id",
          false,
          "cant-share-asset"
        ),
      },
    };
    const publishPermissions = [{ type: "domain", domain: "example.com" }];

    // Open and load
    ShareActions.openPanel();
    await ShareActions.readPublishedState(graph, publishPermissions);
    assert.strictEqual(share.state.status, "writable");

    // Start publish - this will detect the unmanaged asset and pause
    const publishPromise = ShareActions.publish(
      graph,
      publishPermissions,
      undefined
    );

    // Wait a tick for the state to transition to unmanaged-assets
    await new Promise((r) => setTimeout(r, 10));
    assert.strictEqual(share.state.status, "unmanaged-assets");

    // Verify we have both problems - one missing, one cant-share
    // Re-read state after assertion to get proper type narrowing
    const unmanagedState = share.state as {
      status: "unmanaged-assets";
      problems: Array<{ asset: { id: string }; problem: string }>;
    };
    const missingProblem = unmanagedState.problems.find(
      (p) => p.problem === "missing"
    );
    const cantShareProblem = unmanagedState.problems.find(
      (p) => p.problem === "cant-share"
    );
    assert.ok(missingProblem, "Should have a missing permission problem");
    assert.ok(cantShareProblem, "Should have a cant-share problem");
    assert.strictEqual(missingProblem.asset.id, "unmanaged-asset-id");
    assert.strictEqual(cantShareProblem.asset.id, "cant-share-asset-id");

    // Fix the unmanaged asset problems
    await ShareActions.fixUnmanagedAssetProblems();

    // Wait for publish to complete
    await publishPromise;

    // Verify permission was created only on the shareable asset
    const assetPermission = createdPermissions.find(
      (p) => p.fileId === "unmanaged-asset-id"
    );
    assert.ok(
      assetPermission,
      "Unmanaged asset should have received permission"
    );
    assert.strictEqual(assetPermission.permission.type, "domain");
    assert.strictEqual(assetPermission.permission.domain, "example.com");

    // Verify cant-share asset did NOT receive any permissions
    const cantSharePermission = createdPermissions.find(
      (p) => p.fileId === "cant-share-asset-id"
    );
    assert.strictEqual(
      cantSharePermission,
      undefined,
      "Cant-share asset should NOT have received permission"
    );
  });
});
