/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Asset } from "@breadboard-ai/types";
import { GoogleDriveClient } from "@breadboard-ai/utils/google-drive/google-drive-client.js";
import assert from "node:assert";
import { after, before, beforeEach, suite, test } from "node:test";
import { GoogleDriveBoardServer } from "../../../../src/board-server/server.js";
import * as ShareActions from "../../../../src/sca/actions/share/share-actions.js";
import type * as Editor from "../../../../src/sca/controller/subcontrollers/editor/editor.js";
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
  let share: Editor.Share.ShareController;
  /** Utility to get state without TypeScript narrowing over-firing from prior assertions */
  const getState = () => share.state;

  before(async () => {
    fakeDriveApi = await FakeGoogleDriveApi.start();
  });

  after(async () => {
    await fakeDriveApi.stop();
  });

  beforeEach(() => {
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
    const { controller } = makeTestController();
    const { services } = makeTestServices({
      googleDriveClient,
      signinAdapter: {
        domain: Promise.resolve("example.com"),
      },
      googleDriveBoardServer,
    });
    ShareActions.bind({ controller, services });
    share = controller.editor.share;
  });

  test("open -> load -> close", async () => {
    const createdFile = await googleDriveClient.createFile(
      new Blob(["{}"], { type: "application/json" }),
      { name: "test-board.bgl.json", mimeType: "application/json" }
    );

    // Panel is initially closed
    assert.deepEqual(share.state, { status: "closed" });

    // User opens panel
    ShareActions.openPanel();
    assert.deepEqual(share.state, { status: "opening" });

    // Panel starts loading
    const loaded = ShareActions.readPublishedState(
      { edges: [], nodes: [], url: `drive:/${createdFile.id}` },
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
    // Create a file for publishing
    const createdFile = await googleDriveClient.createFile(
      new Blob(["{}"], { type: "application/json" }),
      { name: "test-board.bgl.json", mimeType: "application/json" }
    );

    // Open and load to get to writable state
    ShareActions.openPanel();
    await ShareActions.readPublishedState(
      { edges: [], nodes: [], url: `drive:/${createdFile.id}` },
      []
    );
    const unpublishedState = getState();
    assert.strictEqual(unpublishedState.status, "writable");
    assert.strictEqual(unpublishedState.published, false);

    // Publish
    const graph = { edges: [], nodes: [], url: `drive:/${createdFile.id}` };
    const publishPermissions = [{ type: "domain", domain: "example.com" }];
    const publishPromise = ShareActions.publish(
      graph,
      publishPermissions,
      undefined
    );

    // Verify intermediate updating state
    assert.strictEqual(share.panel, "updating");
    assert.strictEqual(share.state.status, "updating");

    await publishPromise;

    // Verify state is now published
    const publishedState = getState();
    assert.strictEqual(publishedState.status, "writable");
    assert.strictEqual(publishedState.published, true);
    const shareableFileId = publishedState.shareableFile.id;

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
      createdFile.id,
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
      createdFile.id,
      { fields: ["properties"] }
    );
    assert.strictEqual(
      mainFileProps.properties?.mainToShareableCopy,
      shareableFileId,
      "Main file should point to the shareable copy"
    );
  });

  test("unpublish", async () => {
    // Create a file for publishing
    const createdFile = await googleDriveClient.createFile(
      new Blob(["{}"], { type: "application/json" }),
      { name: "test-board.bgl.json", mimeType: "application/json" }
    );

    // Open, load, and publish to get to published state
    ShareActions.openPanel();
    await ShareActions.readPublishedState(
      { edges: [], nodes: [], url: `drive:/${createdFile.id}` },
      []
    );
    const graph = { edges: [], nodes: [], url: `drive:/${createdFile.id}` };
    const publishPermissions = [{ type: "domain", domain: "example.com" }];
    await ShareActions.publish(graph, publishPermissions, undefined);
    const publishedState = getState();
    assert.strictEqual(publishedState.status, "writable");
    assert.strictEqual(publishedState.published, true);
    const shareableFileId = publishedState.shareableFile.id;

    // Verify there's a permission before unpublishing
    const beforeMetadata = await googleDriveClient.getFileMetadata(
      shareableFileId,
      { fields: ["permissions"] }
    );
    assert.ok(beforeMetadata.permissions?.length, "Should have permissions");

    // Unpublish
    await ShareActions.unpublish(graph);

    // Verify state is now unpublished
    assert.strictEqual(share.state.status, "writable");
    assert.strictEqual(share.panel, "writable");
    assert.strictEqual(share.access, "writable");
    assert.strictEqual(share.state.published, false);

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

    ShareActions.openPanel();
    await ShareActions.readPublishedState(
      { edges: [], nodes: [], url: `drive:/${createdFile.id}` },
      []
    );

    assert.strictEqual(share.state.status, "readonly");
    assert.strictEqual(share.panel, "readonly");
    assert.strictEqual(share.access, "readonly");
    assert.strictEqual(share.state.shareableFile?.id, createdFile.id);
    // resourceKey is auto-generated by fake, verify it exists
    assert.ok(
      share.state.shareableFile?.resourceKey,
      "resourceKey should be set"
    );
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

    ShareActions.openPanel();
    await ShareActions.readPublishedState(
      { edges: [], nodes: [], url: `drive:/${mainFile.id}` },
      []
    );

    assert.strictEqual(share.state.status, "readonly");
    assert.strictEqual(share.panel, "readonly");
    assert.strictEqual(share.access, "readonly");
    // Should use the shareable copy's id and resourceKey, not the main file's
    assert.strictEqual(share.state.shareableFile?.id, shareableCopy.id);
    assert.ok(
      share.state.shareableFile?.resourceKey,
      "resourceKey should be set"
    );
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

    ShareActions.openPanel();
    await ShareActions.readPublishedState(
      { edges: [], nodes: [], url: `drive:/${createdFile.id}` },
      []
    );

    assert.strictEqual(share.state.status, "readonly");
    assert.strictEqual(share.panel, "readonly");
    assert.strictEqual(share.access, "readonly");
    assert.strictEqual(share.state.shareableFile?.id, createdFile.id);
    // resourceKey is auto-generated by fake, verify it exists
    assert.ok(
      share.state.shareableFile?.resourceKey,
      "resourceKey should be set"
    );
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
    ShareActions.openPanel();
    await ShareActions.readPublishedState(
      { edges: [], nodes: [], url: `drive:/${mainFile.id}` },
      [{ type: "domain", domain: "example.com" }]
    );
    const staleState = getState();
    assert.strictEqual(staleState.status, "writable");
    assert.strictEqual(staleState.shareableFile?.stale, true);
    assert.strictEqual(
      staleState.latestVersion,
      "5",
      "latestVersion should be 5 from main file"
    );

    // Publish stale with a graph that has identifiable content
    const graph = {
      edges: [],
      nodes: [{ id: "updated-node", type: "test" }],
      url: `drive:/${mainFile.id}`,
    };
    await ShareActions.publishStale(graph);

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
    assert.strictEqual(share.state.status, "writable");
    assert.strictEqual(share.panel, "writable");
    assert.strictEqual(share.access, "writable");
    assert.strictEqual(share.state.shareableFile?.stale, false);
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
    const publishPermissions = [{ type: "domain", domain: "example.com" }];

    // Open and load - initially not published
    ShareActions.openPanel();
    await ShareActions.readPublishedState(graph, publishPermissions);
    assert.strictEqual(share.state.status, "writable");
    assert.strictEqual(share.panel, "writable");
    assert.strictEqual(share.access, "writable");
    assert.strictEqual(share.state.published, false);
    assert.strictEqual(share.state.granularlyShared, false);

    // User opens granular sharing dialog
    await ShareActions.viewSharePermissions(graph, undefined);
    assert.strictEqual(share.state.status, "granular");
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
    await ShareActions.onGoogleDriveSharePanelClose(graph);
    await ShareActions.readPublishedState(graph, publishPermissions);

    // We should now be granularly shared, but not published
    const granularState1 = getState();
    assert.strictEqual(granularState1.status, "writable");
    assert.strictEqual(granularState1.granularlyShared, true);
    assert.strictEqual(granularState1.published, false);

    // User opens granular sharing again
    await ShareActions.viewSharePermissions(graph, undefined);
    assert.strictEqual(getState().status, "granular");

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
    await ShareActions.onGoogleDriveSharePanelClose(graph);
    await ShareActions.readPublishedState(graph, publishPermissions);

    // We should now be granularly shared and published
    const granularState2 = getState();
    assert.strictEqual(granularState2.status, "writable");
    assert.strictEqual(granularState2.granularlyShared, true);
    assert.strictEqual(granularState2.published, true);
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
    const publishPermissions = [{ type: "domain", domain: "example.com" }];

    // Open and load
    ShareActions.openPanel();
    await ShareActions.readPublishedState(graph, publishPermissions);
    assert.strictEqual(share.state.status, "writable");
    assert.strictEqual(share.panel, "writable");
    assert.strictEqual(share.access, "writable");
    assert.strictEqual(share.state.published, false);

    // Publish
    await ShareActions.publish(graph, publishPermissions, undefined);

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
    const publishPermissions = [{ type: "domain", domain: "example.com" }];

    // Open and load
    ShareActions.openPanel();
    await ShareActions.readPublishedState(graph, publishPermissions);
    assert.strictEqual(share.state.status, "writable");
    assert.strictEqual(share.panel, "writable");
    assert.strictEqual(share.access, "writable");

    // Start publish - this will detect the unmanaged asset and pause
    const publishPromise = ShareActions.publish(
      graph,
      publishPermissions,
      undefined
    );

    // Wait for the state to transition to unmanaged-assets (polling to avoid race condition)
    for (let i = 0; i < 100; i++) {
      if (getState().status === "unmanaged-assets") break;
      await new Promise((r) => setTimeout(r, 10));
    }
    assert.strictEqual(getState().status, "unmanaged-assets");

    // Verify we have both problems - one missing, one cant-share
    const unmanagedState = getState();
    assert.strictEqual(unmanagedState.status, "unmanaged-assets");
    const missingProblem = unmanagedState.problems.find(
      (p) => p.problem === "missing"
    );
    const cantShareProblem = unmanagedState.problems.find(
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
});
