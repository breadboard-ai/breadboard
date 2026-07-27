/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { after, before, beforeEach, suite, test } from "node:test";
import { FakeGoogleDriveApi } from "@breadboard-ai/utils/google-drive/fake-google-drive-api.js";
import { GoogleDriveClient } from "@breadboard-ai/utils/google-drive/google-drive-client.js";
import { findUserOpalFolder } from "../../src/ui/utils/google-drive-host-operations.js";

suite("findUserOpalFolder", () => {
  let fakeApi: FakeGoogleDriveApi;

  before(async () => {
    fakeApi = await FakeGoogleDriveApi.start();
  });

  after(async () => {
    await fakeApi.stop();
  });

  beforeEach(() => {
    fakeApi.reset();
  });

  test("queries for root folder owned by user and filters out shared folders", async () => {
    const fetchWithCreds: typeof globalThis.fetch = (input, init) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      // Redirect requests to fakeApi base URL
      const relative = url.replace(/^https:\/\/www\.googleapis\.com/, "");
      return globalThis.fetch(`${fakeApi.apiBaseUrl}${relative}`, init);
    };

    const client = new GoogleDriveClient({ fetchWithCreds });

    // Create a shared folder (should be filtered out)
    const sharedFolder = await client.createFileMetadata({
      name: "Breadboard",
      mimeType: "application/vnd.google-apps.folder",
    });
    fakeApi.forceSetFileMetadata(sharedFolder.id, { shared: true });

    // Create an unshared folder (should be matched)
    const unsharedFolder = await client.createFileMetadata({
      name: "Breadboard",
      mimeType: "application/vnd.google-apps.folder",
    });
    fakeApi.forceSetFileMetadata(unsharedFolder.id, { shared: false });

    fakeApi.setMatchingFilesForNextListRequest([
      sharedFolder.id,
      unsharedFolder.id,
    ]);

    const result = await findUserOpalFolder({
      userFolderName: "Breadboard",
      fetchWithCreds,
    });

    assert.deepStrictEqual(result, { ok: true, id: unsharedFolder.id });

    // Verify query parameters sent to Drive API
    const listReq = fakeApi.requests.find((r) =>
      r.url.includes("/drive/v3/files?")
    );
    assert.ok(listReq, "Should have called listFiles");
    const reqUrl = new URL(listReq.url, fakeApi.apiBaseUrl);
    const q = reqUrl.searchParams.get("q");

    assert.ok(q, "Query parameter 'q' should be present");
    assert.ok(
      q.includes("name='Breadboard'"),
      "Query should search for user folder name"
    );
    assert.ok(
      q.includes("mimeType=\"application/vnd.google-apps.folder\""),
      "Query should search for folder mimeType"
    );
    assert.ok(
      q.includes("'me' in owners"),
      "Query should require folder to be owned by user"
    );
    assert.ok(
      q.includes("visibility = 'limited'"),
      "Query should require visibility = 'limited'"
    );
    assert.ok(
      !q.includes("shared="),
      "Query string parameter 'q' should NOT include shared= (as 'shared' is not a queryable parameter in Drive API 'q')"
    );
    assert.ok(
      q.includes("trashed=false"),
      "Query should exclude trashed folders"
    );
  });
});
