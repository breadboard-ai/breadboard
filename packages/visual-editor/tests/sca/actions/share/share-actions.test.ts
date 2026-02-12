/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Asset, GraphDescriptor } from "@breadboard-ai/types";
import { GoogleDriveClient } from "@breadboard-ai/utils/google-drive/google-drive-client.js";
import type { DriveFileId } from "@breadboard-ai/utils/google-drive/google-drive-client.js";
import assert from "node:assert";
import { after, before, beforeEach, suite, test } from "node:test";
import { GoogleDriveBoardServer } from "../../../../src/board-server/server.js";
import * as ShareActions from "../../../../src/sca/actions/share/share-actions.js";
import type * as Editor from "../../../../src/sca/controller/subcontrollers/editor/editor.js";
import {
  ShareController,
  type SharePanelStatus,
} from "../../../../src/sca/controller/subcontrollers/editor/share-controller.js";
import { FakeGoogleDriveApi } from "../../helpers/fake-google-drive-api.js";
import { makeTestController, makeTestServices } from "../../helpers/index.js";

function makeAsset(handle: string, managed: boolean, title: string): Asset {
  return {
    data: [{ parts: [{ storedData: { handle, mimeType: "image/png" } }] }],
    metadata: { managed, title, type: "file" },
  };
}

suite("Share Actions", () => {
  let fakeDriveApi: FakeGoogleDriveApi;
  let googleDriveClient: GoogleDriveClient;
  let controller: ReturnType<typeof makeTestController>["controller"];
  let share: Editor.Share.ShareController;
  let graphDriveFile: { id: string };

  function setGraph(graph: GraphDescriptor | null): void {
    (controller.editor.graph as { graph: GraphDescriptor | null }).graph =
      graph;
  }

  before(async () => {
    fakeDriveApi = await FakeGoogleDriveApi.start();
  });

  after(async () => {
    await fakeDriveApi.stop();
  });

  beforeEach(async () => {
    fakeDriveApi.reset();
    googleDriveClient = new GoogleDriveClient({
      apiBaseUrl: fakeDriveApi.filesApiUrl,
      uploadApiBaseUrl: fakeDriveApi.uploadApiUrl,
      fetchWithCreds: globalThis.fetch,
    });
    const googleDriveBoardServer = new GoogleDriveBoardServer(
      "FakeGoogleDrive",
      { state: Promise.resolve("signedin") },
      googleDriveClient,
      [{ type: "domain", domain: "example.com", role: "reader" }],
      "Breadboard",
      // findUserOpalFolder stub
      async () => ({ ok: true, id: "fake-folder-id" }),
      // listUserOpals stub
      async () => ({ ok: true as const, files: [] }),
      // GalleryGraphCollection stub
      {
        loading: false,
        loaded: Promise.resolve(),
        error: undefined,
        size: 0,
        entries: () => [][Symbol.iterator](),
        has: () => false,
      },
      // UserGraphCollection stub
      {
        loading: false,
        loaded: Promise.resolve(),
        error: undefined,
        size: 0,
        entries: () => [][Symbol.iterator](),
        has: () => false,
        put: () => {},
        delete: () => false,
      }
    );
    ({ controller } = makeTestController());
    const { services } = makeTestServices({
      googleDriveClient,
      signinAdapter: {
        domain: Promise.resolve("example.com"),
      },
      googleDriveBoardServer,
      globalConfig: {
        googleDrive: {
          publishPermissions: [
            { id: "123", type: "domain", domain: "example.com" },
          ],
        },
      },
    });
    ShareActions.bind({ controller, services });
    share = controller.editor.share;

    // Create a default file and set graph for most tests.
    // Tests that need special files can override with their own setGraph call.
    graphDriveFile = await googleDriveClient.createFile(
      new Blob(["{}"], { type: "application/json" }),
      { name: "test-board.bgl.json", mimeType: "application/json" }
    );
    setGraph({
      edges: [],
      nodes: [],
      url: `drive:/${graphDriveFile.id}`,
    });
  });

  test("open -> load -> close", async () => {
    // Panel is initially closed
    assert.strictEqual(share.panel, "closed");

    // User opens panel
    const loaded = ShareActions.open();
    assert.strictEqual(share.panel, "loading");
    ShareActions.closePanel();
    assert.strictEqual(share.panel, "loading");

    // Finish loading
    await loaded;
    assert.strictEqual(share.panel, "writable");
    assert.strictEqual(share.published, false);
    assert.strictEqual(share.granularlyShared, false);
    assert.strictEqual(share.latestVersion, "1");
    assert.strictEqual(share.shareableFile, null);
    assert.strictEqual(share.userDomain, "example.com");

    // User closes panel
    ShareActions.closePanel();
    assert.strictEqual(share.panel, "closed");
  });

  test("publish", async () => {
    // Open and load to get to writable state
    await ShareActions.open();
    assert.strictEqual(share.panel, "writable");
    assert.strictEqual(share.published, false);

    // Publish
    const publishPromise = ShareActions.publish();

    // Verify intermediate updating state
    assert.strictEqual(share.panel, "updating");
    assert.strictEqual(share.published, true);

    await publishPromise;

    // Verify state is now published
    assert.strictEqual(share.panel, "writable");
    assert.strictEqual(share.published, true);
    assert.ok(share.shareableFile, "shareableFile should be set after publish");
    const shareableFileId = share.shareableFile.id;

    // Get the shareable copy's metadata to verify permissions
    const shareableMetadata = await googleDriveClient.getFileMetadata(
      shareableFileId,
      { fields: ["permissions"] }
    );
    assert.ok(shareableMetadata.permissions, "Permissions should exist");
    assert.strictEqual(shareableMetadata.permissions.length, 1);
    assert.strictEqual(shareableMetadata.permissions[0].type, "domain");
    assert.strictEqual(shareableMetadata.permissions[0].domain, "example.com");
    assert.strictEqual(shareableMetadata.permissions[0].role, "reader");

    // Verify shareable copy app properties
    const shareableCopyProps = await googleDriveClient.getFileMetadata(
      shareableFileId,
      { fields: ["properties"] }
    );
    assert.strictEqual(
      shareableCopyProps.properties?.shareableCopyToMain,
      graphDriveFile.id,
      "Shareable copy should point back to the main file"
    );
    assert.strictEqual(
      shareableCopyProps.properties?.isShareableCopy,
      "true",
      "Shareable copy should be marked as a shareable copy"
    );
    assert.ok(
      shareableCopyProps.properties?.latestSharedVersion,
      "Shareable copy should have latestSharedVersion set"
    );

    // Verify main file has mainToShareableCopy pointing to the shareable copy
    const mainFileProps = await googleDriveClient.getFileMetadata(
      graphDriveFile.id,
      { fields: ["properties"] }
    );
    assert.strictEqual(
      mainFileProps.properties?.mainToShareableCopy,
      shareableFileId,
      "Main file should point to the shareable copy"
    );
  });

  test("publish blocked by domain config", async () => {
    const graph = { edges: [], nodes: [], url: `drive:/${graphDriveFile.id}` };

    // Re-bind with domain config that disallows public publishing
    const { services } = makeTestServices({
      googleDriveClient,
      signinAdapter: {
        domain: Promise.resolve("example.com"),
      },
      globalConfig: {
        googleDrive: {
          publishPermissions: [
            { id: "123", type: "domain", domain: "example.com" },
          ],
        },
        domains: {
          "example.com": { disallowPublicPublishing: true },
        },
      },
    });
    ShareActions.bind({ controller, services });

    // Open and load
    setGraph(graph);
    await ShareActions.open();

    // Verify publicPublishingAllowed is false
    assert.strictEqual(share.publicPublishingAllowed, false);
    assert.strictEqual(share.panel, "writable");

    // Attempt to publish — should be a no-op
    await ShareActions.publish();
    assert.strictEqual(share.panel, "writable");
    assert.strictEqual(share.published, false);
  });

  test("unpublish", async () => {
    // Open, load, and publish to get to published state
    await ShareActions.open();
    await ShareActions.publish();
    assert.strictEqual(share.panel, "writable");
    assert.strictEqual(share.published, true);
    assert.ok(share.shareableFile, "shareableFile should be set after publish");
    const shareableFileId = share.shareableFile.id;

    // Verify there's a permission before unpublishing
    const beforeMetadata = await googleDriveClient.getFileMetadata(
      shareableFileId,
      { fields: ["permissions"] }
    );
    assert.ok(beforeMetadata.permissions?.length, "Should have permissions");

    // Unpublish
    await ShareActions.unpublish();

    // Verify state is now unpublished
    assert.strictEqual(share.panel, "writable");
    assert.strictEqual(share.access, "writable");
    assert.strictEqual(share.published, false);

    // Verify permission was deleted from the shareable copy
    const afterMetadata = await googleDriveClient.getFileMetadata(
      shareableFileId,
      { fields: ["permissions"] }
    );
    assert.strictEqual(
      afterMetadata.permissions?.length ?? 0,
      0,
      "Permissions should be empty after unpublish"
    );
  });

  test("readonly when not owned by me", async () => {
    // Enable resourceKey generation for this test
    fakeDriveApi.createFileGeneratesResourceKey(true);

    // Create a file owned by someone else
    const createdFile = await googleDriveClient.createFile(
      new Blob(["{}"], { type: "application/json" }),
      { name: "someone-elses-file.bgl.json", mimeType: "application/json" }
    );
    fakeDriveApi.forceSetFileMetadata(createdFile.id, { ownedByMe: false });

    setGraph({
      edges: [],
      nodes: [],
      url: `drive:/${createdFile.id}`,
    });
    await ShareActions.open();

    assert.strictEqual(share.panel, "readonly");
    assert.strictEqual(share.access, "readonly");
    assert.strictEqual(share.shareableFile?.id, createdFile.id);
    // resourceKey is auto-generated by fake, verify it exists
    assert.ok(share.shareableFile?.resourceKey, "resourceKey should be set");
  });

  test("readonly when not owned by me but has shareable copy", async () => {
    // Enable resourceKey generation for this test
    fakeDriveApi.createFileGeneratesResourceKey(true);

    // Create the main file owned by someone else
    const mainFile = await googleDriveClient.createFile(
      new Blob(["{}"], { type: "application/json" }),
      { name: "main-file.bgl.json", mimeType: "application/json" }
    );

    // Create the shareable copy
    const shareableCopy = await googleDriveClient.createFile(
      new Blob(["{}"], { type: "application/json" }),
      { name: "shareable-copy.bgl.json", mimeType: "application/json" }
    );

    // Configure the main file to point to the shareable copy and mark as not owned
    fakeDriveApi.forceSetFileMetadata(mainFile.id, {
      ownedByMe: false,
      properties: { mainToShareableCopy: shareableCopy.id },
    });

    setGraph({
      edges: [],
      nodes: [],
      url: `drive:/${mainFile.id}`,
    });
    await ShareActions.open();

    assert.strictEqual(share.panel, "readonly");
    assert.strictEqual(share.access, "readonly");
    // Should use the shareable copy's id and resourceKey, not the main file's
    assert.strictEqual(share.shareableFile?.id, shareableCopy.id);
    assert.ok(share.shareableFile?.resourceKey, "resourceKey should be set");
  });

  test("readonly when file is a shareable copy", async () => {
    // Enable resourceKey generation for this test
    fakeDriveApi.createFileGeneratesResourceKey(true);

    // Create a file that is a shareable copy (has shareableCopyToMain property)
    const createdFile = await googleDriveClient.createFile(
      new Blob(["{}"], { type: "application/json" }),
      {
        name: "shareable-copy.bgl.json",
        mimeType: "application/json",
        properties: { shareableCopyToMain: "main-file-id" },
      }
    );

    setGraph({
      edges: [],
      nodes: [],
      url: `drive:/${createdFile.id}`,
    });
    await ShareActions.open();

    assert.strictEqual(share.panel, "readonly");
    assert.strictEqual(share.access, "readonly");
    assert.strictEqual(share.shareableFile?.id, createdFile.id);
    // resourceKey is auto-generated by fake, verify it exists
    assert.ok(share.shareableFile?.resourceKey, "resourceKey should be set");
  });

  test("publishStale updates shareable copy and clears stale flag", async () => {
    // Create the main file
    const mainFile = await googleDriveClient.createFile(
      new Blob(["{}"], { type: "application/json" }),
      { name: "main-file.bgl.json", mimeType: "application/json" }
    );

    // Create a shareable copy and link it to the main file
    const shareableFile = await googleDriveClient.createFile(
      new Blob(["{}"], { type: "application/json" }),
      { name: "shareable-copy.bgl.json", mimeType: "application/json" }
    );

    // Set up the main file -> shareable copy relationship with stale version
    fakeDriveApi.forceSetFileMetadata(mainFile.id, {
      ownedByMe: true,
      version: "5",
      properties: {
        mainToShareableCopy: shareableFile.id,
      },
    });

    // Shareable copy has older version (stale)
    fakeDriveApi.forceSetFileMetadata(shareableFile.id, {
      properties: {
        latestSharedVersion: "3", // older than main's version 5
      },
      permissions: [
        {
          type: "domain",
          domain: "example.com",
          role: "reader",
          id: "existing-perm",
        },
      ],
    });
    fakeDriveApi.createFileGeneratesResourceKey(true);

    // Open and load to get to writable state with stale shareable copy
    setGraph({
      edges: [],
      nodes: [],
      url: `drive:/${mainFile.id}`,
    });
    await ShareActions.open();
    assert.strictEqual(share.panel, "writable");
    assert.strictEqual(share.stale, true);
    assert.strictEqual(share.latestVersion, "5");

    // Publish stale with a graph that has identifiable content
    setGraph({
      edges: [],
      nodes: [{ id: "updated-node", type: "test" }],
      url: `drive:/${mainFile.id}`,
    });
    await ShareActions.publishStale();

    // Verify shareable copy was updated - check the latestSharedVersion property
    const updatedShareable = await googleDriveClient.getFileMetadata(
      shareableFile.id,
      { fields: ["properties"] }
    );
    assert.strictEqual(
      updatedShareable.properties?.latestSharedVersion,
      "5",
      "Shareable copy should be updated to latest version"
    );

    // Verify file content was actually updated on the shareable copy
    const shareableContent = await googleDriveClient.getFileMedia(
      shareableFile.id
    );
    const shareableGraph = await shareableContent.json();
    assert.ok(
      shareableGraph.nodes?.some(
        (n: { id: string }) => n.id === "updated-node"
      ),
      "Shareable copy content should contain the updated graph nodes"
    );

    // Verify stale flag is now false
    assert.strictEqual(share.panel, "writable");
    assert.strictEqual(share.access, "writable");
    assert.strictEqual(share.stale, false);
  });

  test("granular sharing", async () => {
    // Create the main file
    const mainFile = await googleDriveClient.createFile(
      new Blob(["{}"], { type: "application/json" }),
      { name: "test-board.bgl.json", mimeType: "application/json" }
    );

    // Create a shareable copy (simulating an existing one)
    const shareableCopy = await googleDriveClient.createFile(
      new Blob(["{}"], { type: "application/json" }),
      { name: "shareable-copy.bgl.json", mimeType: "application/json" }
    );

    // Link main file to shareable copy
    fakeDriveApi.forceSetFileMetadata(mainFile.id, {
      properties: { mainToShareableCopy: shareableCopy.id },
    });

    const graph = { edges: [], nodes: [], url: `drive:/${mainFile.id}` };

    // Open and load - initially not published
    setGraph(graph);
    await ShareActions.open();
    assert.strictEqual(share.panel, "writable");
    assert.strictEqual(share.access, "writable");
    assert.strictEqual(share.published, false);
    assert.strictEqual(share.granularlyShared, false);

    // User opens granular sharing dialog
    await ShareActions.viewSharePermissions();
    assert.strictEqual(share.panel, "granular");

    // Simulate user adding individual permission via the native Drive share dialog
    // We add the permission directly to the fake
    await googleDriveClient.createPermission(
      shareableCopy.id,
      {
        type: "user",
        emailAddress: "somebody@example.com",
        role: "reader",
      },
      { sendNotificationEmail: false }
    );

    // User closes granular sharing dialog
    await ShareActions.onGoogleDriveSharePanelClose();

    // We should now be granularly shared, but not published
    assert.strictEqual(share.panel, "writable");
    assert.strictEqual(share.granularlyShared, true);
    assert.strictEqual(share.published, false);

    // User opens granular sharing again
    await ShareActions.viewSharePermissions();
    assert.strictEqual(share.panel, "granular");

    // User adds domain permission
    await googleDriveClient.createPermission(
      shareableCopy.id,
      {
        type: "domain",
        domain: "example.com",
        role: "reader",
      },
      { sendNotificationEmail: false }
    );

    // User closes the dialog
    await ShareActions.onGoogleDriveSharePanelClose();

    // We should now be granularly shared and published
    assert.strictEqual(share.panel, "writable");
    assert.strictEqual(share.granularlyShared, true);
    assert.strictEqual(share.published, true);
  });

  test("managed assets get permissions synced during publish", async () => {
    // Create the main file
    const mainFile = await googleDriveClient.createFile(
      new Blob(["{}"], { type: "application/json" }),
      { name: "main-board.bgl.json", mimeType: "application/json" }
    );

    // Create managed asset files with different capabilities
    const managedAsset = await googleDriveClient.createFile(
      new Blob(["asset data"]),
      { name: "managed-asset.bin", mimeType: "application/octet-stream" }
    );
    fakeDriveApi.forceSetFileMetadata(managedAsset.id, {
      capabilities: { canShare: true },
    });

    const cantShareAsset = await googleDriveClient.createFile(
      new Blob(["asset data"]),
      { name: "cant-share-asset.bin", mimeType: "application/octet-stream" }
    );
    fakeDriveApi.forceSetFileMetadata(cantShareAsset.id, {
      capabilities: { canShare: false },
    });

    const excessPermsAsset = await googleDriveClient.createFile(
      new Blob(["asset data"]),
      { name: "excess-perms-asset.bin", mimeType: "application/octet-stream" }
    );
    // Add a permission that matches the publish permission (should be kept)
    await googleDriveClient.createPermission(
      excessPermsAsset.id,
      { type: "domain", domain: "example.com", role: "reader" },
      { sendNotificationEmail: false }
    );
    // Add an extra permission that should be removed
    const oldPerm = await googleDriveClient.createPermission(
      excessPermsAsset.id,
      { type: "user", emailAddress: "old@example.com", role: "reader" },
      { sendNotificationEmail: false }
    );
    fakeDriveApi.forceSetFileMetadata(excessPermsAsset.id, {
      capabilities: { canShare: true },
    });

    // Graph with multiple managed assets
    const graph = {
      edges: [],
      nodes: [],
      url: `drive:/${mainFile.id}`,
      assets: {
        "asset-1": makeAsset(`drive:/${managedAsset.id}`, true, "test-asset"),
        "asset-2": makeAsset(
          `drive:/${cantShareAsset.id}`,
          true,
          "cant-share-asset"
        ),
        "asset-3": makeAsset(
          `drive:/${excessPermsAsset.id}`,
          true,
          "excess-perms-asset"
        ),
      },
    };

    // Open and load
    setGraph(graph);
    await ShareActions.open();
    assert.strictEqual(share.panel, "writable");
    assert.strictEqual(share.access, "writable");
    assert.strictEqual(share.published, false);

    // Publish
    await ShareActions.publish();

    // Verify managed asset got the domain permission added
    const managedAssetMeta = await googleDriveClient.getFileMetadata(
      managedAsset.id,
      { fields: ["permissions"] }
    );
    const addedPerm = managedAssetMeta.permissions?.find(
      (p) => p.type === "domain" && p.domain === "example.com"
    );
    assert.ok(
      addedPerm,
      "Managed asset should have received domain permission"
    );

    // Verify cant-share asset still has no permissions (skipped)
    const cantShareMeta = await googleDriveClient.getFileMetadata(
      cantShareAsset.id,
      { fields: ["permissions"] }
    );
    assert.strictEqual(
      cantShareMeta.permissions?.length ?? 0,
      0,
      "Cant-share asset should NOT have received permission"
    );

    // Verify excess-perms asset had the old permission deleted
    const excessMeta = await googleDriveClient.getFileMetadata(
      excessPermsAsset.id,
      { fields: ["permissions"] }
    );
    const oldPermStillExists = excessMeta.permissions?.find(
      (p) => p.id === oldPerm.id
    );
    assert.strictEqual(
      oldPermStillExists,
      undefined,
      "Old permission should have been deleted"
    );
    // The domain permission should still exist
    const domainPermExists = excessMeta.permissions?.find(
      (p) => p.type === "domain" && p.domain === "example.com"
    );
    assert.ok(domainPermExists, "Domain permission should still exist");
  });

  test("fixUnmanagedAssetProblems adds missing permissions", async () => {
    // Create the main file
    const mainFile = await googleDriveClient.createFile(
      new Blob(["{}"], { type: "application/json" }),
      { name: "main-file.bgl.json", mimeType: "application/json" }
    );

    // Create unmanaged assets - not managed by the main file's owner
    const unmanagedAsset = await googleDriveClient.createFile(
      new Blob(["asset data"]),
      { name: "unmanaged-asset.bin", mimeType: "application/octet-stream" }
    );
    fakeDriveApi.forceSetFileMetadata(unmanagedAsset.id, {
      name: "My Unmanaged File",
      iconLink: "https://example.com/icon.png",
      capabilities: { canShare: true },
    });

    const cantShareAsset = await googleDriveClient.createFile(
      new Blob(["asset data"]),
      { name: "cant-share-asset.bin", mimeType: "application/octet-stream" }
    );
    fakeDriveApi.forceSetFileMetadata(cantShareAsset.id, {
      name: "Someone Elses File",
      iconLink: "https://example.com/icon2.png",
      capabilities: { canShare: false },
    });

    // Graph with unmanaged assets (managed: false or undefined)
    const graph = {
      edges: [],
      nodes: [],
      url: `drive:/${mainFile.id}`,
      assets: {
        "asset-1": makeAsset(
          `drive:/${unmanagedAsset.id}`,
          false,
          "unmanaged-asset"
        ),
        "asset-2": makeAsset(
          `drive:/${cantShareAsset.id}`,
          false,
          "cant-share-asset"
        ),
      },
    };

    // Open and load
    setGraph(graph);
    await ShareActions.open();
    assert.strictEqual(share.panel, "writable");
    assert.strictEqual(share.access, "writable");

    // Start publish - this will detect the unmanaged asset and pause
    const publishPromise = ShareActions.publish();

    // Wait for the panel to transition to unmanaged-assets (polling to avoid race condition)
    for (let i = 0; i < 100; i++) {
      if ((share.panel as SharePanelStatus) === "unmanaged-assets") break;
      await new Promise((r) => setTimeout(r, 10));
    }
    assert.strictEqual(share.panel, "unmanaged-assets");

    // Verify we have both problems - one missing, one cant-share
    const missingProblem = share.unmanagedAssetProblems.find(
      (p) => p.problem === "missing"
    );
    const cantShareProblem = share.unmanagedAssetProblems.find(
      (p) => p.problem === "cant-share"
    );
    assert.ok(missingProblem, "Should have a missing permission problem");
    assert.ok(cantShareProblem, "Should have a cant-share problem");
    assert.strictEqual(missingProblem.asset.id, unmanagedAsset.id);
    assert.strictEqual(cantShareProblem.asset.id, cantShareAsset.id);

    // Fix the unmanaged asset problems
    await ShareActions.fixUnmanagedAssetProblems();

    // Wait for publish to complete
    await publishPromise;

    // Verify permission was created on the shareable asset (state verification)
    const unmanagedMeta = await googleDriveClient.getFileMetadata(
      unmanagedAsset.id,
      { fields: ["permissions"] }
    );
    const addedPerm = unmanagedMeta.permissions?.find(
      (p) => p.type === "domain" && p.domain === "example.com"
    );
    assert.ok(
      addedPerm,
      "Unmanaged asset should have received domain permission"
    );

    // Verify cant-share asset still has no domain permissions
    const cantShareMeta = await googleDriveClient.getFileMetadata(
      cantShareAsset.id,
      { fields: ["permissions"] }
    );
    const cantShareDomainPerm = cantShareMeta.permissions?.find(
      (p) => p.type === "domain" && p.domain === "example.com"
    );
    assert.strictEqual(
      cantShareDomainPerm,
      undefined,
      "Cant-share asset should NOT have received domain permission"
    );
  });

  test("reset() restores all fields to their defaults", () => {
    const share = new ShareController("test", "test");

    // Dirty every field
    share.panel = "writable";
    share.access = "writable";
    share.published = true;
    share.stale = true;
    share.granularlyShared = true;
    share.userDomain = "example.com";
    share.publicPublishingAllowed = false;
    share.latestVersion = "42";
    share.publishedPermissions = [{ type: "anyone", role: "reader" }];
    share.shareableFile = "file-id" as unknown as DriveFileId;
    share.unmanagedAssetProblems = [
      {
        asset: {
          id: "a",
          resourceKey: "k",
          name: "n",
          iconLink: "i",
        },
        problem: "cant-share",
      },
    ];

    share.reset();

    assert.strictEqual(share.panel, "closed");
    assert.strictEqual(share.access, "unknown");
    assert.strictEqual(share.published, false);
    assert.strictEqual(share.stale, false);
    assert.strictEqual(share.granularlyShared, false);
    assert.strictEqual(share.userDomain, "");
    assert.strictEqual(share.publicPublishingAllowed, true);
    assert.strictEqual(share.latestVersion, "");
    assert.deepStrictEqual(share.publishedPermissions, []);
    assert.strictEqual(share.shareableFile, null);
    assert.deepStrictEqual(share.unmanagedAssetProblems, []);
  });
});
