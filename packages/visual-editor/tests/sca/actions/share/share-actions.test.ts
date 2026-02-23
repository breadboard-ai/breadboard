/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Asset, GraphDescriptor } from "@breadboard-ai/types";
import { GoogleDriveClient } from "@breadboard-ai/utils/google-drive/google-drive-client.js";
import type { DriveFileId } from "@breadboard-ai/utils/google-drive/google-drive-client.js";
import { DRIVE_PROPERTY_VIEWER_MODE } from "@breadboard-ai/utils/google-drive/operations.js";
import assert from "node:assert";
import { after, before, beforeEach, suite, test } from "node:test";
import { GoogleDriveBoardServer } from "../../../../src/board-server/server.js";
import { SaveCompleteEvent } from "../../../../src/board-server/events.js";
import * as ShareActions from "../../../../src/sca/actions/share/share-actions.js";
import type * as Editor from "../../../../src/sca/controller/subcontrollers/editor/editor.js";
import {
  ShareController,
  type ShareStatus,
} from "../../../../src/sca/controller/subcontrollers/editor/share-controller.js";
import { reactive } from "../../../../src/sca/reactive.js";
import { FakeGoogleDriveApi } from "@breadboard-ai/utils/google-drive/fake-google-drive-api.js";
import { makeTestController, makeTestServices } from "../../helpers/index.js";
import { makeUrl } from "../../../../src/ui/navigation/urls.js";

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
    controller.editor.graph.url = graph?.url ?? null;
  }

  /** Returns a promise that resolves when share.status becomes the target. */
  function waitForShareStatus(target: ShareStatus): Promise<void> {
    if (share.status === target) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      const dispose = reactive(() => {
        if (share.status === target) {
          queueMicrotask(() => {
            dispose();
            resolve();
          });
        }
      });
    });
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
      apiBaseUrl: fakeDriveApi.apiBaseUrl,
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

  test("initialize fetches data, open sets panel", async () => {
    // Panel is initially closed, status is initializing
    assert.strictEqual(share.panel, "closed");
    assert.strictEqual(share.status, "initializing");

    // Initialize fetches data (does not open panel)
    await ShareActions.initialize();
    assert.strictEqual(share.panel, "closed");
    assert.strictEqual(share.status, "ready");
    assert.strictEqual(share.ownership, "owner");
    assert.strictEqual(share.hasPublicPermissions, false);
    assert.strictEqual(share.hasOtherPermissions, false);
    assert.strictEqual(share.editableVersion, "1");
    assert.strictEqual(share.shareableFile, null);
    assert.strictEqual(share.userDomain, "example.com");

    // User opens panel
    await ShareActions.open();
    assert.strictEqual(share.panel, "open");

    // User closes panel
    ShareActions.closePanel();
    assert.strictEqual(share.panel, "closed");
  });

  suite("updateEditableVersion", () => {
    test("updates editableVersion when save event URL matches", async () => {
      await ShareActions.initialize();
      assert.strictEqual(share.editableVersion, "1");

      const event = new SaveCompleteEvent(`drive:/${graphDriveFile.id}`, "42");
      await ShareActions.updateEditableVersion(event);
      assert.strictEqual(share.editableVersion, "42");
    });

    test("ignores save event for a different graph", async () => {
      await ShareActions.initialize();
      assert.strictEqual(share.editableVersion, "1");

      const event = new SaveCompleteEvent("drive:/some-other-file", "99");
      await ShareActions.updateEditableVersion(event);
      assert.strictEqual(share.editableVersion, "1");
    });

    test("ignores save event when no graph URL is set", async () => {
      // Don't initialize — no graph URL is set on the controller
      const event = new SaveCompleteEvent("drive:/anything", "99");
      await ShareActions.updateEditableVersion(event);
      assert.strictEqual(share.editableVersion, "");
    });
  });

  test("initialize fires automatically via onGraphUrl trigger", async () => {
    // Status is initializing before trigger is activated
    assert.strictEqual(share.status, "initializing");

    // In production, bootstrap calls activate() on all actions once at startup.
    // Here we call it manually to set up the signal watcher that makes the
    // trigger listen for url changes — it doesn't fire the action by itself.
    const dispose = ShareActions.initialize.activate();

    // setGraph (called in beforeEach) already set the url signal.
    // The reactive effect evaluates on the next microtask, sees the drive: URL,
    // and fires initialize().
    await waitForShareStatus("ready");

    assert.strictEqual(share.status, "ready");
    assert.strictEqual(share.ownership, "owner");
    assert.strictEqual(share.panel, "closed");

    // --- Board swap: load a second board (not owned by us) ---
    const secondFile = await googleDriveClient.createFile(
      new Blob(["{}"], { type: "application/json" }),
      { name: "second-board.bgl.json", mimeType: "application/json" }
    );
    fakeDriveApi.forceSetFileMetadata(secondFile.id, { ownedByMe: false });

    // Pause the API so we can assert intermediate state before initialize
    // completes.
    fakeDriveApi.pause();

    setGraph({
      edges: [],
      nodes: [],
      url: `drive:/${secondFile.id}`,
    });

    // Wait for the trigger to fire — status transitions to "initializing"
    // while the API is paused.
    await waitForShareStatus("initializing");

    assert.strictEqual(share.status, "initializing");

    // Unpause the API — initialize completes and sets final state.
    fakeDriveApi.unpause();
    await waitForShareStatus("ready");

    assert.strictEqual(share.status, "ready");
    assert.strictEqual(share.ownership, "non-owner");
    assert.strictEqual(share.panel, "closed");

    dispose();
  });

  test("publish", async () => {
    // Initialize and open
    await ShareActions.initialize();
    await ShareActions.open();
    assert.strictEqual(share.panel, "open");
    assert.strictEqual(share.hasPublicPermissions, false);

    // Publish
    const publishPromise = ShareActions.publish();

    // Verify intermediate changing-visibility state
    assert.strictEqual(share.status, "changing-visibility");
    assert.strictEqual(share.hasPublicPermissions, true);

    await publishPromise;

    // Verify state is now published
    assert.strictEqual(share.status, "ready");
    assert.strictEqual(share.hasPublicPermissions, true);
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

    // Verify lastPublishedIso is set and is after the graph file was created
    const publishedAt = Date.parse(share.lastPublishedIso);
    const graphCreatedAt = Date.parse(
      (
        await googleDriveClient.getFileMetadata(graphDriveFile.id, {
          fields: ["createdTime"],
        })
      ).createdTime!
    );
    assert.ok(
      publishedAt > graphCreatedAt,
      "lastPublishedIso should be after the graph file was created"
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

    // Initialize
    setGraph(graph);
    await ShareActions.initialize();

    // Verify publicPublishingAllowed is false
    assert.strictEqual(share.publicPublishingAllowed, false);
    assert.strictEqual(share.ownership, "owner");

    // Attempt to publish — should be a no-op
    await ShareActions.publish();
    assert.strictEqual(share.status, "ready");
    assert.strictEqual(share.hasPublicPermissions, false);
  });

  test("unpublish", async () => {
    // Initialize and publish to get to published state
    await ShareActions.initialize();
    await ShareActions.publish();
    assert.strictEqual(share.status, "ready");
    assert.strictEqual(share.hasPublicPermissions, true);
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
    assert.strictEqual(share.status, "ready");
    assert.strictEqual(share.ownership, "owner");
    assert.strictEqual(share.hasPublicPermissions, false);

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
    await ShareActions.initialize();

    assert.strictEqual(share.status, "ready");
    assert.strictEqual(share.ownership, "non-owner");
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
    await ShareActions.initialize();

    assert.strictEqual(share.status, "ready");
    assert.strictEqual(share.ownership, "non-owner");
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
    await ShareActions.initialize();

    assert.strictEqual(share.status, "ready");
    assert.strictEqual(share.ownership, "non-owner");
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

    // Bump the main file's version organically via content updates.
    // createFile starts at version "1", and each updateFile increments it.
    // Combined with the updateFileMetadata below (which also increments),
    // we reach version "5": create("1") + 3 updates("2","3","4") + metadata("5").
    for (let i = 0; i < 3; i++) {
      await googleDriveClient.updateFile(
        mainFile.id,
        new Blob([`{"v":${i}}`], { type: "application/json" }),
        undefined,
        { fields: ["version"] }
      );
    }

    // Link the main file to the shareable copy
    await googleDriveClient.updateFileMetadata(mainFile.id, {
      properties: { mainToShareableCopy: shareableFile.id },
    });

    // Shareable copy has older version (stale)
    await googleDriveClient.updateFileMetadata(shareableFile.id, {
      properties: {
        latestSharedVersion: "3", // older than main's version
      },
    });
    // Pre-populate permissions (simulates a prior publish)
    await googleDriveClient.createPermission(
      shareableFile.id,
      {
        type: "domain",
        domain: "example.com",
        role: "reader",
      },
      { sendNotificationEmail: false }
    );
    fakeDriveApi.createFileGeneratesResourceKey(true);

    // Open and load to get to writable state with stale shareable copy
    setGraph({
      edges: [],
      nodes: [],
      url: `drive:/${mainFile.id}`,
    });
    await ShareActions.initialize();
    assert.strictEqual(share.ownership, "owner");
    assert.strictEqual(share.stale, true);
    assert.strictEqual(share.editableVersion, "5");
    const lastPublishedBefore = share.lastPublishedIso;
    assert.ok(
      lastPublishedBefore,
      "lastPublishedIso should be set from shareable copy"
    );

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
    assert.strictEqual(share.status, "ready");
    assert.strictEqual(share.ownership, "owner");
    assert.strictEqual(share.stale, false);

    // Verify lastPublishedIso was updated to a later time
    const publishedAfter = Date.parse(share.lastPublishedIso);
    const publishedBefore = Date.parse(lastPublishedBefore);
    assert.ok(
      publishedAfter > publishedBefore,
      "lastPublishedIso should advance after publishStale"
    );
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
    await ShareActions.initialize();
    await ShareActions.open();
    assert.strictEqual(share.panel, "open");
    assert.strictEqual(share.ownership, "owner");
    assert.strictEqual(share.hasPublicPermissions, false);
    assert.strictEqual(share.hasOtherPermissions, false);

    // User opens granular sharing dialog
    await ShareActions.viewSharePermissions();
    assert.strictEqual(share.panel, "native-share");

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
    assert.strictEqual(share.panel, "open");
    assert.strictEqual(share.hasOtherPermissions, true);
    assert.strictEqual(share.hasPublicPermissions, false);

    // User opens granular sharing again
    await ShareActions.viewSharePermissions();
    assert.strictEqual(share.panel, "native-share");

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
    assert.strictEqual(share.panel, "open");
    assert.strictEqual(share.hasOtherPermissions, true);
    assert.strictEqual(share.hasPublicPermissions, true);
  });

  test("closing native share dialog shows updating indicator, not initializing flash", async () => {
    // Set up an initialized board with share panel open.
    await ShareActions.initialize();
    await ShareActions.open();
    assert.strictEqual(share.panel, "open");
    assert.strictEqual(share.status, "ready");

    // Open the native sharing dialog.
    await ShareActions.viewSharePermissions();
    assert.strictEqual(share.panel, "native-share");

    // Pause the API so we can observe intermediate state.
    fakeDriveApi.pause();

    const closePromise = ShareActions.onGoogleDriveSharePanelClose();

    // While API is paused, status should be "syncing-native-share".
    assert.strictEqual(share.status, "syncing-native-share");
    assert.strictEqual(share.panel, "open");

    // Let the API respond.
    fakeDriveApi.unpause();
    await closePromise;

    // Back to idle after completion.
    assert.strictEqual(share.status, "ready");
    assert.strictEqual(share.panel, "open");
  });

  test("viewSharePermissions shows syncing-native-share while creating shareable copy", async () => {
    await ShareActions.initialize();
    await ShareActions.open();
    assert.strictEqual(share.status, "ready");
    assert.strictEqual(share.shareableFile, null);

    // Pause the API so we can observe the intermediate "syncing-native-share" status
    // while makeShareableCopy is in-flight.
    fakeDriveApi.pause();

    const viewPromise = ShareActions.viewSharePermissions();

    // While the shareable copy is being created, status should be "syncing-native-share".
    assert.strictEqual(share.status, "syncing-native-share");

    // Let the API respond and finish creation.
    fakeDriveApi.unpause();
    await viewPromise;

    // After completion, status is idle and the native dialog is shown.
    assert.strictEqual(share.status, "ready");
    assert.strictEqual(share.panel, "native-share");
    assert.ok(
      share.shareableFile !== null,
      "shareableFile should be populated"
    );

    // Close and re-open — this time the copy already exists, so no loading.
    await ShareActions.onGoogleDriveSharePanelClose();
    assert.strictEqual(share.status, "ready");

    // Second viewSharePermissions should NOT show "syncing-native-share" since copy exists.
    await ShareActions.viewSharePermissions();
    assert.strictEqual(share.panel, "native-share");
    // Status stayed idle the whole time (no create needed).
    assert.strictEqual(share.status, "ready");
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

    // Initialize
    setGraph(graph);
    await ShareActions.initialize();
    assert.strictEqual(share.ownership, "owner");
    assert.strictEqual(share.hasPublicPermissions, false);

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

    // Initialize and open
    setGraph(graph);
    await ShareActions.initialize();
    await ShareActions.open();
    assert.strictEqual(share.panel, "open");
    assert.strictEqual(share.ownership, "owner");

    // Start publish - this will detect the unmanaged asset and pause
    const publishPromise = ShareActions.publish();

    // Wait for the unmanaged asset problems to be populated
    for (let i = 0; i < 100; i++) {
      if (share.unmanagedAssetProblems.length > 0) break;
      await new Promise((r) => setTimeout(r, 10));
    }
    // Panel stays in "changing-visibility" state; unmanaged-assets view is driven by
    // the problems array, not panel state.
    assert.strictEqual(share.status, "changing-visibility");
    assert.ok(share.unmanagedAssetProblems.length > 0);

    // Verify we have both problems - one missing, one cant-share
    const missingProblem = share.unmanagedAssetProblems.find(
      (p) => p.problem === "missing"
    );
    const cantShareProblem = share.unmanagedAssetProblems.find(
      (p) => p.problem === "cant-share"
    );
    assert.ok(missingProblem, "Should have a missing permission problem");
    assert.ok(cantShareProblem, "Should have a cant-share problem");
    assert.strictEqual(
      missingProblem.type === "drive" ? missingProblem.asset.id : undefined,
      unmanagedAsset.id
    );
    assert.strictEqual(
      cantShareProblem.type === "drive" ? cantShareProblem.asset.id : undefined,
      cantShareAsset.id
    );

    // Fix the unmanaged asset problems — status transitions to syncing-assets.
    const fixPromise = ShareActions.fixUnmanagedAssetProblems();
    assert.strictEqual(
      share.status,
      "syncing-assets",
      "Status should be syncing-assets while asset permissions are being fixed"
    );
    await fixPromise;

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

  test("closePanel is blocked while unmanaged asset problems are pending", async () => {
    // Create the main file
    const mainFile = await googleDriveClient.createFile(
      new Blob(["{}"], { type: "application/json" }),
      { name: "main-file.bgl.json", mimeType: "application/json" }
    );

    // Create an unmanaged asset
    const unmanagedAsset = await googleDriveClient.createFile(
      new Blob(["asset data"]),
      { name: "unmanaged-asset.bin", mimeType: "application/octet-stream" }
    );
    fakeDriveApi.forceSetFileMetadata(unmanagedAsset.id, {
      name: "My Unmanaged File",
      iconLink: "https://example.com/icon.png",
      capabilities: { canShare: true },
    });

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
      },
    };

    setGraph(graph);
    await ShareActions.initialize();
    await ShareActions.open();
    assert.strictEqual(share.panel, "open");

    // Start publish — will pause on unmanaged assets
    const publishPromise = ShareActions.publish();

    // Wait for problems to appear
    for (let i = 0; i < 100; i++) {
      if (share.unmanagedAssetProblems.length > 0) break;
      await new Promise((r) => setTimeout(r, 10));
    }
    assert.ok(share.unmanagedAssetProblems.length > 0);

    // Try to close panel — should be blocked
    await ShareActions.closePanel();
    assert.strictEqual(
      share.status,
      "changing-visibility",
      "Status should still be changing-visibility (close blocked)"
    );

    // Dismiss to unblock publish.
    await ShareActions.dismissUnmanagedAssetProblems();
    await publishPromise;
  });

  test("closePanel is blocked while status is changing-visibility", async () => {
    await ShareActions.initialize();
    await ShareActions.open();
    assert.strictEqual(share.panel, "open");

    // Pause the fake API so changeVisibility hangs mid-flight
    fakeDriveApi.pause();
    const changePromise = ShareActions.changeVisibility("anyone");

    // Wait for status to flip to changing-visibility
    for (let i = 0; i < 100; i++) {
      if (share.status === "changing-visibility") break;
      await new Promise((r) => setTimeout(r, 10));
    }
    assert.strictEqual(share.status, "changing-visibility");

    // Try to close — should be blocked
    await ShareActions.closePanel();
    assert.strictEqual(share.panel, "open", "Panel should remain open");

    // Unblock and let changeVisibility finish
    fakeDriveApi.unpause();
    await changePromise;
    assert.strictEqual(share.status, "ready");

    // Now close should work
    await ShareActions.closePanel();
    assert.strictEqual(share.panel, "closed");
  });

  test("dismissUnmanagedAssetProblems resolves without fixing permissions", async () => {
    // Create the main file
    const mainFile = await googleDriveClient.createFile(
      new Blob(["{}"], { type: "application/json" }),
      { name: "main-file.bgl.json", mimeType: "application/json" }
    );

    // Create an unmanaged asset with missing permissions
    const unmanagedAsset = await googleDriveClient.createFile(
      new Blob(["asset data"]),
      { name: "unmanaged-asset.bin", mimeType: "application/octet-stream" }
    );
    fakeDriveApi.forceSetFileMetadata(unmanagedAsset.id, {
      name: "My Unmanaged File",
      iconLink: "https://example.com/icon.png",
      capabilities: { canShare: true },
    });

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
      },
    };

    setGraph(graph);
    await ShareActions.initialize();

    // Start publish — will pause on unmanaged assets
    const publishPromise = ShareActions.publish();

    // Wait for problems to appear
    for (let i = 0; i < 100; i++) {
      if (share.unmanagedAssetProblems.length > 0) break;
      await new Promise((r) => setTimeout(r, 10));
    }
    assert.ok(share.unmanagedAssetProblems.length > 0);

    // Dismiss (ignore) instead of fixing
    await ShareActions.dismissUnmanagedAssetProblems();
    await publishPromise;

    // After publish completes, problems are cleared. Dismiss is per-publish-
    // attempt — the same problems will be re-detected on the next publish.
    assert.strictEqual(share.unmanagedAssetProblems.length, 0);

    // The unmanaged asset should NOT have received permissions
    const assetMeta = await googleDriveClient.getFileMetadata(
      unmanagedAsset.id,
      { fields: ["permissions"] }
    );
    const domainPerm = assetMeta.permissions?.find(
      (p) => p.type === "domain" && p.domain === "example.com"
    );
    assert.strictEqual(
      domainPerm,
      undefined,
      "Dismissed asset should NOT have received domain permission"
    );
  });

  suite("changeVisibility transitions", () => {
    async function getNonOwnerPermissions(
      fileId: string
    ): Promise<gapi.client.drive.Permission[]> {
      const meta = await googleDriveClient.getFileMetadata(fileId, {
        fields: ["permissions"],
      });
      return (meta.permissions ?? []).filter((p) => p.role !== "owner");
    }

    test("only-you → anyone", async () => {
      await ShareActions.initialize();
      assert.strictEqual(share.visibility, "only-you");

      await ShareActions.changeVisibility("anyone");

      assert.strictEqual(share.status, "ready");
      assert.strictEqual(share.visibility, "anyone");
      assert.strictEqual(share.hasPublicPermissions, true);
      assert.strictEqual(share.hasOtherPermissions, false);
      assert.ok(share.shareableFile, "shareableFile should exist");

      // Verify actual Drive permissions
      const perms = await getNonOwnerPermissions(share.shareableFile.id);
      assert.strictEqual(perms.length, 1);
      assert.strictEqual(perms[0].type, "domain");
      assert.strictEqual(perms[0].domain, "example.com");
      assert.strictEqual(perms[0].role, "reader");
    });

    suite("only-you → restricted", () => {
      test("opens native share dialog", async () => {
        await ShareActions.initialize();
        assert.strictEqual(share.visibility, "only-you");

        await ShareActions.changeVisibility("restricted");

        // "restricted" opens the native share dialog instead of going to "ready"
        assert.strictEqual(share.panel, "native-share");
        // The visibility is still "only-you" because no granular permissions
        // have been added yet (the native dialog is where the user adds them).
        assert.strictEqual(share.visibility, "only-you");
        assert.strictEqual(share.hasPublicPermissions, false);
        assert.strictEqual(share.hasOtherPermissions, false);
        assert.ok(share.shareableFile, "shareableFile should exist");

        // Verify no permissions were added
        const perms = await getNonOwnerPermissions(share.shareableFile.id);
        assert.strictEqual(perms.length, 0);
      });

      test("user adds a person via native dialog → restricted", async () => {
        await ShareActions.initialize();
        await ShareActions.changeVisibility("restricted");
        assert.ok(share.shareableFile);

        // User adds someone via the native Drive share dialog
        await googleDriveClient.createPermission(
          share.shareableFile.id,
          {
            type: "user",
            emailAddress: "colleague@example.com",
            role: "writer",
          },
          { sendNotificationEmail: false }
        );

        // User closes the native dialog — triggers re-sync
        await ShareActions.onGoogleDriveSharePanelClose();

        assert.strictEqual(share.panel, "open");
        assert.strictEqual(share.status, "ready");
        assert.strictEqual(share.visibility, "restricted");
        assert.strictEqual(share.hasPublicPermissions, false);
        assert.strictEqual(share.hasOtherPermissions, true);
      });

      test("user adds domain permission via native dialog → anyone", async () => {
        await ShareActions.initialize();
        await ShareActions.changeVisibility("restricted");
        assert.ok(share.shareableFile);

        // User adds the domain permission (same as "publish") via native dialog
        await googleDriveClient.createPermission(
          share.shareableFile.id,
          {
            type: "domain",
            domain: "example.com",
            role: "reader",
          },
          { sendNotificationEmail: false }
        );

        await ShareActions.onGoogleDriveSharePanelClose();

        assert.strictEqual(share.panel, "open");
        assert.strictEqual(share.status, "ready");
        // The domain permission matches the publish permissions → "anyone"
        assert.strictEqual(share.visibility, "anyone");
        assert.strictEqual(share.hasPublicPermissions, true);
        assert.strictEqual(share.hasOtherPermissions, false);
      });

      test("user adds nothing and closes → only-you", async () => {
        await ShareActions.initialize();
        await ShareActions.changeVisibility("restricted");
        assert.ok(share.shareableFile);

        // User closes without adding anyone
        await ShareActions.onGoogleDriveSharePanelClose();

        assert.strictEqual(share.panel, "open");
        assert.strictEqual(share.status, "ready");
        assert.strictEqual(share.visibility, "only-you");
        assert.strictEqual(share.hasPublicPermissions, false);
        assert.strictEqual(share.hasOtherPermissions, false);
      });

      test("user removes a previously shared person → only-you", async () => {
        await ShareActions.initialize();
        await ShareActions.changeVisibility("restricted");
        assert.ok(share.shareableFile);

        // Add a person first
        const perm = await googleDriveClient.createPermission(
          share.shareableFile.id,
          {
            type: "user",
            emailAddress: "colleague@example.com",
            role: "reader",
          },
          { sendNotificationEmail: false }
        );
        await ShareActions.onGoogleDriveSharePanelClose();
        assert.strictEqual(share.visibility, "restricted");

        // Re-open native dialog and remove the person
        await ShareActions.viewSharePermissions();
        await googleDriveClient.deletePermission(
          share.shareableFile.id,
          perm.id!
        );
        await ShareActions.onGoogleDriveSharePanelClose();

        assert.strictEqual(share.panel, "open");
        assert.strictEqual(share.status, "ready");
        assert.strictEqual(share.visibility, "only-you");
        assert.strictEqual(share.hasOtherPermissions, false);
      });
    });

    test("anyone → only-you", async () => {
      // Set up published state
      await ShareActions.initialize();
      await ShareActions.changeVisibility("anyone");
      assert.strictEqual(share.visibility, "anyone");

      await ShareActions.changeVisibility("only-you");

      assert.strictEqual(share.status, "ready");
      assert.strictEqual(share.visibility, "only-you");
      assert.strictEqual(share.hasPublicPermissions, false);
      assert.strictEqual(share.hasOtherPermissions, false);

      // Verify all permissions removed from Drive
      const perms = await getNonOwnerPermissions(share.shareableFile!.id);
      assert.strictEqual(perms.length, 0);
    });

    test("anyone → restricted", async () => {
      // Set up published state
      await ShareActions.initialize();
      await ShareActions.changeVisibility("anyone");
      assert.strictEqual(share.visibility, "anyone");

      await ShareActions.changeVisibility("restricted");

      // Opens the native share dialog
      assert.strictEqual(share.panel, "native-share");
      // Publish permissions were stripped, so visibility drops to "only-you"
      // because no granular permissions remain. The native dialog is where
      // the user will add specific people.
      assert.strictEqual(share.hasPublicPermissions, false);
      assert.strictEqual(share.hasOtherPermissions, false);

      // Verify publish permissions were removed from Drive
      const perms = await getNonOwnerPermissions(share.shareableFile!.id);
      assert.strictEqual(perms.length, 0);
    });

    test("restricted → only-you", async () => {
      // Set up: initialize, create shareable copy, add a granular permission
      await ShareActions.initialize();
      await ShareActions.changeVisibility("restricted");
      assert.ok(share.shareableFile);
      // Simulate user adding a person via the native dialog
      await googleDriveClient.createPermission(
        share.shareableFile.id,
        {
          type: "user",
          emailAddress: "colleague@example.com",
          role: "reader",
        },
        { sendNotificationEmail: false }
      );
      // Sync state by closing the native dialog
      await ShareActions.onGoogleDriveSharePanelClose();
      assert.strictEqual(share.visibility, "restricted");
      assert.strictEqual(share.hasOtherPermissions, true);

      await ShareActions.changeVisibility("only-you");

      assert.strictEqual(share.status, "ready");
      assert.strictEqual(share.visibility, "only-you");
      assert.strictEqual(share.hasPublicPermissions, false);
      assert.strictEqual(share.hasOtherPermissions, false);

      // Verify all permissions removed
      const perms = await getNonOwnerPermissions(share.shareableFile.id);
      assert.strictEqual(perms.length, 0);
    });

    test("restricted → anyone", async () => {
      // Set up: initialize, create shareable copy, add a granular permission
      await ShareActions.initialize();
      await ShareActions.changeVisibility("restricted");
      assert.ok(share.shareableFile);
      // Simulate user adding a person
      await googleDriveClient.createPermission(
        share.shareableFile.id,
        {
          type: "user",
          emailAddress: "colleague@example.com",
          role: "reader",
        },
        { sendNotificationEmail: false }
      );
      await ShareActions.onGoogleDriveSharePanelClose();
      assert.strictEqual(share.visibility, "restricted");

      await ShareActions.changeVisibility("anyone");

      assert.strictEqual(share.status, "ready");
      assert.strictEqual(share.visibility, "anyone");
      assert.strictEqual(share.hasPublicPermissions, true);
      // The granular user permission is removed because "anyone" sets desired
      // permissions to only the publish permissions. The diff treats the
      // user permission as excess.
      assert.strictEqual(share.hasOtherPermissions, false);

      // Verify Drive: only the domain perm exists
      const perms = await getNonOwnerPermissions(share.shareableFile.id);
      assert.strictEqual(perms.length, 1);
      const domainPerm = perms.find(
        (p) => p.type === "domain" && p.domain === "example.com"
      );
      assert.ok(domainPerm, "Domain publish permission should exist");
    });

    test("no-op when target matches current visibility", async () => {
      await ShareActions.initialize();
      assert.strictEqual(share.visibility, "only-you");

      // Should not create a shareable copy or change anything
      await ShareActions.changeVisibility("only-you");
      assert.strictEqual(share.status, "ready");
      assert.strictEqual(share.shareableFile, null);
    });

    test("no-op: anyone → anyone", async () => {
      await ShareActions.initialize();
      await ShareActions.changeVisibility("anyone");
      assert.strictEqual(share.visibility, "anyone");

      await ShareActions.changeVisibility("anyone");
      assert.strictEqual(share.status, "ready");
      assert.strictEqual(share.visibility, "anyone");
    });

    test("no-op: restricted → restricted", async () => {
      await ShareActions.initialize();
      await ShareActions.changeVisibility("restricted");
      assert.ok(share.shareableFile);
      // Add a user so we're actually in "restricted" state
      await googleDriveClient.createPermission(
        share.shareableFile.id,
        {
          type: "user",
          emailAddress: "colleague@example.com",
          role: "reader",
        },
        { sendNotificationEmail: false }
      );
      await ShareActions.onGoogleDriveSharePanelClose();
      assert.strictEqual(share.visibility, "restricted");

      await ShareActions.changeVisibility("restricted");
      // No-op: panel stays open, visibility unchanged
      assert.strictEqual(share.panel, "open");
      assert.strictEqual(share.visibility, "restricted");
    });

    test("managed assets get permissions synced on only-you → anyone", async () => {
      const mainFile = await googleDriveClient.createFile(
        new Blob(["{}"], { type: "application/json" }),
        { name: "main-board.bgl.json", mimeType: "application/json" }
      );
      const managedAsset = await googleDriveClient.createFile(
        new Blob(["asset data"]),
        { name: "managed-asset.bin", mimeType: "application/octet-stream" }
      );
      fakeDriveApi.forceSetFileMetadata(managedAsset.id, {
        capabilities: { canShare: true },
      });

      setGraph({
        edges: [],
        nodes: [],
        url: `drive:/${mainFile.id}`,
        assets: {
          "asset-1": makeAsset(`drive:/${managedAsset.id}`, true, "test-asset"),
        },
      });
      await ShareActions.initialize();

      await ShareActions.changeVisibility("anyone");

      assert.strictEqual(share.status, "ready");
      assert.strictEqual(share.visibility, "anyone");

      // Verify asset got the domain permission
      const assetMeta = await googleDriveClient.getFileMetadata(
        managedAsset.id,
        { fields: ["permissions"] }
      );
      const domainPerm = assetMeta.permissions?.find(
        (p) => p.type === "domain" && p.domain === "example.com"
      );
      assert.ok(
        domainPerm,
        "Managed asset should have received domain permission"
      );
    });

    test("managed asset permissions stripped on anyone → only-you", async () => {
      const mainFile = await googleDriveClient.createFile(
        new Blob(["{}"], { type: "application/json" }),
        { name: "main-board.bgl.json", mimeType: "application/json" }
      );
      const managedAsset = await googleDriveClient.createFile(
        new Blob(["asset data"]),
        { name: "managed-asset.bin", mimeType: "application/octet-stream" }
      );
      fakeDriveApi.forceSetFileMetadata(managedAsset.id, {
        capabilities: { canShare: true },
      });

      setGraph({
        edges: [],
        nodes: [],
        url: `drive:/${mainFile.id}`,
        assets: {
          "asset-1": makeAsset(`drive:/${managedAsset.id}`, true, "test-asset"),
        },
      });
      await ShareActions.initialize();

      // First go to "anyone" so asset gets the permission
      await ShareActions.changeVisibility("anyone");
      const midMeta = await googleDriveClient.getFileMetadata(managedAsset.id, {
        fields: ["permissions"],
      });
      assert.ok(
        midMeta.permissions?.some(
          (p) => p.type === "domain" && p.domain === "example.com"
        ),
        "Asset should have domain permission after publishing"
      );

      // Now go back to "only-you" — asset permission should be removed
      await ShareActions.changeVisibility("only-you");
      assert.strictEqual(share.visibility, "only-you");

      const afterMeta = await googleDriveClient.getFileMetadata(
        managedAsset.id,
        { fields: ["permissions"] }
      );
      const remaining = (afterMeta.permissions ?? []).filter(
        (p) => p.role !== "owner"
      );
      assert.strictEqual(
        remaining.length,
        0,
        "Managed asset should have no non-owner permissions after only-you"
      );
    });

    test("unmanaged assets prompt during changeVisibility to anyone", async () => {
      const mainFile = await googleDriveClient.createFile(
        new Blob(["{}"], { type: "application/json" }),
        { name: "main-file.bgl.json", mimeType: "application/json" }
      );
      const unmanagedAsset = await googleDriveClient.createFile(
        new Blob(["asset data"]),
        { name: "unmanaged-asset.bin", mimeType: "application/octet-stream" }
      );
      fakeDriveApi.forceSetFileMetadata(unmanagedAsset.id, {
        name: "Unmanaged File",
        iconLink: "https://example.com/icon.png",
        capabilities: { canShare: true },
      });

      setGraph({
        edges: [],
        nodes: [],
        url: `drive:/${mainFile.id}`,
        assets: {
          "asset-1": makeAsset(
            `drive:/${unmanagedAsset.id}`,
            false,
            "unmanaged-asset"
          ),
        },
      });
      await ShareActions.initialize();
      await ShareActions.open();

      // changeVisibility to "anyone" — should pause for unmanaged assets
      const visibilityPromise = ShareActions.changeVisibility("anyone");

      // Wait for unmanaged asset problems to appear
      for (let i = 0; i < 100; i++) {
        if (share.unmanagedAssetProblems.length > 0) break;
        await new Promise((r) => setTimeout(r, 10));
      }
      assert.ok(share.unmanagedAssetProblems.length > 0);
      assert.strictEqual(share.status, "changing-visibility");

      // Fix the problems
      await ShareActions.fixUnmanagedAssetProblems();
      await visibilityPromise;

      assert.strictEqual(share.status, "ready");
      assert.strictEqual(share.visibility, "anyone");

      // Verify the unmanaged asset got the permission
      const assetMeta = await googleDriveClient.getFileMetadata(
        unmanagedAsset.id,
        { fields: ["permissions"] }
      );
      const domainPerm = assetMeta.permissions?.find(
        (p) => p.type === "domain" && p.domain === "example.com"
      );
      assert.ok(
        domainPerm,
        "Unmanaged asset should have received domain permission"
      );
    });

    test("anyone blocked when public publishing disallowed", async () => {
      // Re-bind with domain config that disallows public publishing.
      // Must include googleDriveBoardServer since changeVisibility may
      // create a shareable copy before checking the domain restriction.
      const googleDriveBoardServer = new GoogleDriveBoardServer(
        "FakeGoogleDrive",
        { state: Promise.resolve("signedin") },
        googleDriveClient,
        [{ type: "domain", domain: "example.com", role: "reader" }],
        "Breadboard",
        async () => ({ ok: true, id: "fake-folder-id" }),
        async () => ({ ok: true as const, files: [] }),
        {
          loading: false,
          loaded: Promise.resolve(),
          error: undefined,
          size: 0,
          entries: () => [][Symbol.iterator](),
          has: () => false,
        },
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
      const { services } = makeTestServices({
        googleDriveClient,
        googleDriveBoardServer,
        signinAdapter: { domain: Promise.resolve("example.com") },
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

      await ShareActions.initialize();
      assert.strictEqual(share.publicPublishingAllowed, false);

      await ShareActions.changeVisibility("anyone");

      assert.strictEqual(share.status, "ready");
      assert.strictEqual(share.visibility, "only-you");
      assert.strictEqual(share.hasPublicPermissions, false);
    });
  });

  test("reset() restores all fields to their defaults", () => {
    const share = new ShareController("test", "test");

    // Dirty every field
    share.panel = "open";
    share.status = "ready";
    share.ownership = "owner";
    share.hasPublicPermissions = true;
    share.editableVersion = "42";
    share.sharedVersion = "1";
    share.hasOtherPermissions = true;
    share.userDomain = "example.com";
    share.publicPublishingAllowed = false;
    share.actualPermissions = [{ type: "anyone", role: "reader" }];
    share.shareableFile = "file-id" as unknown as DriveFileId;
    share.unmanagedAssetProblems = [
      {
        type: "drive",
        asset: {
          id: "a",
          resourceKey: "k",
          name: "n",
          iconLink: "i",
        },
        problem: "cant-share",
      },
    ];
    share.notebookDomainSharingLimited = true;
    share.viewerMode = "app-only";
    share.lastPublishedIso = "2025-01-01T00:00:00Z";
    share.error = "some error";

    share.reset();

    assert.strictEqual(share.panel, "closed");
    assert.strictEqual(share.status, "initializing");
    assert.strictEqual(share.ownership, "unknown");
    assert.strictEqual(share.hasPublicPermissions, false);
    assert.strictEqual(share.stale, false);
    assert.strictEqual(share.editableVersion, "");
    assert.strictEqual(share.sharedVersion, "");
    assert.strictEqual(share.hasOtherPermissions, false);
    assert.strictEqual(share.userDomain, "");
    assert.strictEqual(share.publicPublishingAllowed, true);
    assert.deepStrictEqual(share.actualPermissions, []);
    assert.strictEqual(share.shareableFile, null);
    assert.deepStrictEqual(share.unmanagedAssetProblems, []);
    assert.strictEqual(share.notebookDomainSharingLimited, false);
    assert.strictEqual(share.viewerMode, "full");
    assert.strictEqual(share.lastPublishedIso, "");
    assert.strictEqual(share.error, "");
  });

  suite("error recovery", () => {
    test("initialize sets error on Drive failure", async () => {
      fakeDriveApi.forceNextError(403);
      await ShareActions.initialize();
      assert.ok(share.error);
    });

    test("publish sets error on Drive failure", async () => {
      await ShareActions.initialize();
      fakeDriveApi.forceNextError(400);
      await ShareActions.publish();
      assert.ok(share.error);
    });

    test("publishStale sets error on Drive failure", async () => {
      const mainFile = await googleDriveClient.createFile(
        new Blob(["{}"], { type: "application/json" }),
        { name: "main.bgl.json", mimeType: "application/json" }
      );
      const shareableFile = await googleDriveClient.createFile(
        new Blob(["{}"], { type: "application/json" }),
        { name: "shareable.bgl.json", mimeType: "application/json" }
      );
      await googleDriveClient.updateFileMetadata(mainFile.id, {
        properties: { mainToShareableCopy: shareableFile.id },
      });
      await googleDriveClient.updateFileMetadata(shareableFile.id, {
        properties: { latestSharedVersion: "1" },
      });
      await googleDriveClient.createPermission(
        shareableFile.id,
        { type: "domain", domain: "example.com", role: "reader" },
        { sendNotificationEmail: false }
      );

      setGraph({ edges: [], nodes: [], url: `drive:/${mainFile.id}` });
      await ShareActions.initialize();
      assert.strictEqual(share.stale, true);

      fakeDriveApi.forceNextError(400);
      await ShareActions.publishStale();
      assert.ok(share.error);
    });

    test("unpublish sets error on Drive failure", async () => {
      await ShareActions.initialize();
      await ShareActions.publish();
      assert.strictEqual(share.hasPublicPermissions, true);

      fakeDriveApi.forceNextError(403);
      await ShareActions.unpublish();
      assert.ok(share.error);
    });

    test("changeVisibility sets error on Drive failure", async () => {
      await ShareActions.initialize();
      fakeDriveApi.forceNextError(400);
      await ShareActions.changeVisibility("anyone");
      assert.ok(share.error);
    });

    test("setViewerAccess sets error on Drive failure", async () => {
      await ShareActions.initialize();
      await ShareActions.publish();
      fakeDriveApi.forceNextError(403);
      await ShareActions.setViewerAccess("app-only");
      assert.ok(share.error);
    });

    test("open sets error on Drive failure", async () => {
      await ShareActions.initialize();
      share.panel = "closed";
      fakeDriveApi.forceNextError(400);
      await ShareActions.open();
      assert.ok(share.error);
    });

    test("fixUnmanagedAssetProblems sets error on Drive failure", async () => {
      await ShareActions.initialize();
      share.unmanagedAssetProblems = [
        {
          type: "drive",
          asset: { id: "a", resourceKey: "k", name: "n", iconLink: "i" },
          problem: "missing",
          missing: [{ type: "anyone", role: "reader" }],
        },
      ];
      fakeDriveApi.forceNextError(403);
      await ShareActions.fixUnmanagedAssetProblems();
      assert.ok(share.error);
    });

    test("viewSharePermissions sets error on Drive failure", async () => {
      await ShareActions.initialize();
      share.shareableFile = null;
      fakeDriveApi.forceNextError(400);
      await ShareActions.viewSharePermissions();
      assert.ok(share.error);
    });

    test("onGoogleDriveSharePanelClose sets error on Drive failure", async () => {
      await ShareActions.initialize();
      await ShareActions.publish();
      share.panel = "native-share";
      fakeDriveApi.forceNextError(403);
      await ShareActions.onGoogleDriveSharePanelClose();
      assert.ok(share.error);
    });
  });

  suite("viewerMode", () => {
    test("initialize defaults viewerMode to 'full' when property is absent", async () => {
      await ShareActions.initialize();
      assert.strictEqual(share.viewerMode, "full");
    });

    test("initialize reads viewerMode from shareable copy (shareable copy file)", async () => {
      // Create a file that IS a shareable copy with viewerMode=app
      const shareableCopy = await googleDriveClient.createFile(
        new Blob(["{}"], { type: "application/json" }),
        {
          name: "shareable-copy.bgl.json",
          mimeType: "application/json",
          properties: {
            shareableCopyToMain: "main-file-id",
            [DRIVE_PROPERTY_VIEWER_MODE]: "app-only",
          },
        }
      );

      setGraph({
        edges: [],
        nodes: [],
        url: `drive:/${shareableCopy.id}`,
      });
      await ShareActions.initialize();

      // Any file with a shareableCopyToMain property is treated as a shareable
      // copy viewer (non-owner), regardless of Drive ownership.
      assert.strictEqual(share.ownership, "non-owner");
      assert.strictEqual(share.viewerMode, "app-only");
    });

    test("initialize reads viewerMode from shareable copy (non-owner with link)", async () => {
      // Create the main file owned by someone else
      const mainFile = await googleDriveClient.createFile(
        new Blob(["{}"], { type: "application/json" }),
        { name: "main-file.bgl.json", mimeType: "application/json" }
      );

      // Create the shareable copy with viewerMode=app
      const shareableCopy = await googleDriveClient.createFile(
        new Blob(["{}"], { type: "application/json" }),
        {
          name: "shareable-copy.bgl.json",
          mimeType: "application/json",
          properties: {
            [DRIVE_PROPERTY_VIEWER_MODE]: "app-only",
          },
        }
      );

      // Link main → shareable copy and mark as not owned
      fakeDriveApi.forceSetFileMetadata(mainFile.id, {
        ownedByMe: false,
        properties: { mainToShareableCopy: shareableCopy.id },
      });

      setGraph({
        edges: [],
        nodes: [],
        url: `drive:/${mainFile.id}`,
      });
      await ShareActions.initialize();

      assert.strictEqual(share.ownership, "non-owner");
      assert.strictEqual(share.viewerMode, "app-only");
    });

    test("initialize reads viewerMode from shareable copy (owner)", async () => {
      // Create the main file
      const mainFile = await googleDriveClient.createFile(
        new Blob(["{}"], { type: "application/json" }),
        { name: "main-file.bgl.json", mimeType: "application/json" }
      );

      // Create the shareable copy with viewerMode=app
      const shareableCopy = await googleDriveClient.createFile(
        new Blob(["{}"], { type: "application/json" }),
        {
          name: "shareable-copy.bgl.json",
          mimeType: "application/json",
          properties: {
            [DRIVE_PROPERTY_VIEWER_MODE]: "app-only",
          },
        }
      );

      // Link main → shareable copy (owner)
      fakeDriveApi.forceSetFileMetadata(mainFile.id, {
        properties: { mainToShareableCopy: shareableCopy.id },
      });

      setGraph({
        edges: [],
        nodes: [],
        url: `drive:/${mainFile.id}`,
      });
      await ShareActions.initialize();

      assert.strictEqual(share.ownership, "owner");
      assert.strictEqual(share.viewerMode, "app-only");
    });

    test("setViewerAccess creates shareable copy and writes property", async () => {
      await ShareActions.initialize();
      assert.strictEqual(share.viewerMode, "full");
      assert.strictEqual(share.shareableFile, null);

      // Set to app — should create shareable copy and write property
      await ShareActions.setViewerAccess("app-only");

      assert.strictEqual(share.viewerMode, "app-only");
      assert.ok(share.shareableFile, "shareableFile should be set");
      const shareableFile = share.shareableFile as DriveFileId;

      // Verify property was written to Drive
      const meta = await googleDriveClient.getFileMetadata(shareableFile.id, {
        fields: ["properties"],
      });
      assert.strictEqual(
        meta.properties?.[DRIVE_PROPERTY_VIEWER_MODE],
        "app-only",
        "Property should be 'app' on the shareable copy"
      );
    });

    test("setViewerAccess to 'full' clears the property", async () => {
      await ShareActions.initialize();

      // First set to app
      await ShareActions.setViewerAccess("app-only");
      assert.strictEqual(share.viewerMode, "app-only");
      assert.ok(share.shareableFile);

      // Then set back to full — should clear the property
      await ShareActions.setViewerAccess("full");
      assert.strictEqual(share.viewerMode, "full");

      const meta = await googleDriveClient.getFileMetadata(
        share.shareableFile!.id,
        { fields: ["properties"] }
      );
      // Property should be empty string (cleared)
      assert.strictEqual(
        meta.properties?.[DRIVE_PROPERTY_VIEWER_MODE],
        "",
        "Property should be cleared when set to full"
      );
    });

    test("publish includes viewerMode on new shareable copy", async () => {
      await ShareActions.initialize();

      // Set viewerMode before publishing
      share.viewerMode = "app-only";
      await ShareActions.publish();

      assert.ok(share.shareableFile);
      const shareableFileId = (share.shareableFile as DriveFileId).id;
      const meta = await googleDriveClient.getFileMetadata(shareableFileId, {
        fields: ["properties"],
      });
      assert.strictEqual(
        meta.properties?.[DRIVE_PROPERTY_VIEWER_MODE],
        "app-only",
        "Shareable copy should have viewerMode=app"
      );
    });

    test("publishStale preserves viewerMode", async () => {
      // Create the main file
      const mainFile = await googleDriveClient.createFile(
        new Blob(["{}"], { type: "application/json" }),
        { name: "main-file.bgl.json", mimeType: "application/json" }
      );

      // Create a shareable copy with viewerMode=app
      const shareableFile = await googleDriveClient.createFile(
        new Blob(["{}"], { type: "application/json" }),
        { name: "shareable-copy.bgl.json", mimeType: "application/json" }
      );

      // Bump version
      await googleDriveClient.updateFile(
        mainFile.id,
        new Blob([`{"v":1}`], { type: "application/json" }),
        undefined,
        { fields: ["version"] }
      );

      // Link and set stale version
      await googleDriveClient.updateFileMetadata(mainFile.id, {
        properties: { mainToShareableCopy: shareableFile.id },
      });
      await googleDriveClient.updateFileMetadata(shareableFile.id, {
        properties: {
          latestSharedVersion: "1",
          [DRIVE_PROPERTY_VIEWER_MODE]: "app-only",
        },
      });
      // Pre-populate permissions
      await googleDriveClient.createPermission(
        shareableFile.id,
        { type: "domain", domain: "example.com", role: "reader" },
        { sendNotificationEmail: false }
      );

      setGraph({
        edges: [],
        nodes: [],
        url: `drive:/${mainFile.id}`,
      });
      await ShareActions.initialize();
      assert.strictEqual(share.viewerMode, "app-only");
      assert.strictEqual(share.stale, true);

      // Publish stale
      await ShareActions.publishStale();

      // Verify viewerMode is still written on the shareable copy
      const meta = await googleDriveClient.getFileMetadata(shareableFile.id, {
        fields: ["properties"],
      });
      assert.strictEqual(
        meta.properties?.[DRIVE_PROPERTY_VIEWER_MODE],
        "app-only",
        "viewerMode should be preserved after publishStale"
      );
    });
  });
});

suite("computeAppUrl", () => {
  let controller: ReturnType<typeof makeTestController>["controller"];

  function bindWith(opts: {
    guestConfig?: Partial<
      import("@breadboard-ai/types/opal-shell-protocol.js").GuestConfiguration
    >;
    globalConfig?: Partial<
      import("../../../../src/ui/contexts/global-config.js").GlobalConfig
    >;
  }) {
    ({ controller } = makeTestController());
    const { services } = makeTestServices({
      guestConfig: opts.guestConfig ?? {},
      globalConfig: opts.globalConfig ?? {},
    });
    ShareActions.bind({ controller, services });
  }

  test("returns empty string when shareableFile is null", () => {
    bindWith({});
    assert.strictEqual(ShareActions.computeAppUrl(null), "");
  });

  // ── shareSurface template branch ──

  test("uses shareSurface URL template when configured", () => {
    bindWith({
      guestConfig: {
        shareSurface: "myapp",
        shareSurfaceUrlTemplates: {
          myapp: "https://myapp.example.com/view?id={fileId}&rk={resourceKey}",
        },
      },
    });
    const url = ShareActions.computeAppUrl({
      id: "abc123",
      resourceKey: "rk456",
    });
    assert.strictEqual(
      url,
      "https://myapp.example.com/view?id=abc123&rk=rk456"
    );
  });

  test("shareSurface template omits empty resourceKey param", () => {
    bindWith({
      guestConfig: {
        shareSurface: "myapp",
        shareSurfaceUrlTemplates: {
          myapp: "https://myapp.example.com/view?id={fileId}&rk={resourceKey}",
        },
      },
    });
    const url = ShareActions.computeAppUrl({
      id: "abc123",
      resourceKey: undefined,
    });
    assert.strictEqual(url, "https://myapp.example.com/view?id=abc123");
  });

  // ── hostOrigin / makeUrl branch ──

  test("falls back to makeUrl with hostOrigin when no shareSurface", () => {
    const hostOrigin = new URL("https://breadboard.example.com");
    bindWith({
      globalConfig: { hostOrigin },
    });
    const file = { id: "file-xyz", resourceKey: undefined };
    const url = ShareActions.computeAppUrl(file);
    assert.strictEqual(
      url,
      makeUrl(
        {
          page: "graph",
          mode: "app",
          flow: `drive:/${file.id}`,
          resourceKey: file.resourceKey,
          guestPrefixed: false,
        },
        hostOrigin
      )
    );
  });

  test("makeUrl branch includes resourceKey when present", () => {
    const hostOrigin = new URL("https://breadboard.example.com");
    bindWith({
      globalConfig: { hostOrigin },
    });
    const file = { id: "file-xyz", resourceKey: "rk789" };
    const url = ShareActions.computeAppUrl(file);
    assert.strictEqual(
      url,
      makeUrl(
        {
          page: "graph",
          mode: "app",
          flow: `drive:/${file.id}`,
          resourceKey: file.resourceKey,
          guestPrefixed: false,
        },
        hostOrigin
      )
    );
  });

  // ── edge cases ──

  test("returns empty string when no hostOrigin and no shareSurface", () => {
    bindWith({});
    assert.strictEqual(
      ShareActions.computeAppUrl({ id: "file-xyz", resourceKey: undefined }),
      ""
    );
  });

  test("shareSurface takes precedence over hostOrigin", () => {
    bindWith({
      guestConfig: {
        shareSurface: "myapp",
        shareSurfaceUrlTemplates: {
          myapp: "https://myapp.example.com/view?id={fileId}",
        },
      },
      globalConfig: {
        hostOrigin: new URL("https://breadboard.example.com"),
      },
    });
    const url = ShareActions.computeAppUrl({
      id: "abc123",
      resourceKey: undefined,
    });
    assert.ok(url.startsWith("https://myapp.example.com"), url);
  });

  test("ignores shareSurface when template map is missing", () => {
    const hostOrigin = new URL("https://breadboard.example.com");
    bindWith({
      guestConfig: {
        shareSurface: "myapp",
        // no shareSurfaceUrlTemplates
      },
      globalConfig: { hostOrigin },
    });
    const file = { id: "abc123", resourceKey: undefined };
    const url = ShareActions.computeAppUrl(file);
    // Should fall through to makeUrl
    assert.strictEqual(
      url,
      makeUrl(
        {
          page: "graph",
          mode: "app",
          flow: `drive:/${file.id}`,
          resourceKey: file.resourceKey,
          guestPrefixed: false,
        },
        hostOrigin
      )
    );
  });

  test("ignores shareSurface when key not found in template map", () => {
    const hostOrigin = new URL("https://breadboard.example.com");
    bindWith({
      guestConfig: {
        shareSurface: "unknown-surface",
        shareSurfaceUrlTemplates: {
          myapp: "https://myapp.example.com/view?id={fileId}",
        },
      },
      globalConfig: { hostOrigin },
    });
    const file = { id: "abc123", resourceKey: undefined };
    const url = ShareActions.computeAppUrl(file);
    // Should fall through to makeUrl since "unknown-surface" isn't in the map
    assert.strictEqual(
      url,
      makeUrl(
        {
          page: "graph",
          mode: "app",
          flow: `drive:/${file.id}`,
          resourceKey: file.resourceKey,
          guestPrefixed: false,
        },
        hostOrigin
      )
    );
  });
});
