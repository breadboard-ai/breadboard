/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GoogleDriveClient,
  normalizeFileId,
} from "@breadboard-ai/utils/google-drive/google-drive-client.js";
import assert from "node:assert";
import { after, before, beforeEach, suite, test } from "node:test";
import { FakeGoogleDriveApi } from "@breadboard-ai/utils/google-drive/fake-google-drive-api.js";

suite("GoogleDriveClient", () => {
  let fakeApi: FakeGoogleDriveApi;
  let client: GoogleDriveClient;

  before(async () => {
    fakeApi = await FakeGoogleDriveApi.start();
    client = new GoogleDriveClient({
      apiBaseUrl: fakeApi.apiBaseUrl,
      proxyBaseUrl: fakeApi.proxyBaseUrl,
      fetchWithCreds: globalThis.fetch,
    });
  });

  after(async () => {
    await fakeApi.stop();
  });

  beforeEach(() => {
    fakeApi.reset();
  });

  suite("createFile", () => {
    test("returns file with fAkE- prefixed ID", async () => {
      const result = await client.createFile(
        new Blob(["test content"], { type: "text/plain" }),
        { name: "new-file.txt", mimeType: "text/plain" }
      );

      assert.ok(
        result.id?.startsWith("fAkE-"),
        `Expected ID to start with 'fAkE-', got: ${result.id}`
      );
    });
  });

  suite("createFileMetadata", () => {
    test("creates file with metadata only (no content)", async () => {
      const result = await client.createFileMetadata(
        { name: "my-folder", mimeType: "application/vnd.google-apps.folder" },
        { fields: ["id", "name", "mimeType"] }
      );

      assert.ok(result.id?.startsWith("fAkE-"));
      const expected = {
        id: result.id,
        name: "my-folder",
        mimeType: "application/vnd.google-apps.folder",
      };
      assert.deepStrictEqual(result, expected);

      const fetched = await client.getFileMetadata(result.id!, {
        fields: ["id", "name", "mimeType"],
      });
      assert.deepStrictEqual(fetched, expected);
    });

    test("filters fields when requested", async () => {
      const result = await client.createFileMetadata(
        { name: "test-file", mimeType: "text/plain" },
        { fields: ["id", "name"] }
      );

      assert.ok(result.id);
      assert.strictEqual(result.name, "test-file");
      assert.strictEqual("mimeType" in result, false);
    });
  });

  suite("getFileMetadata", () => {
    test("returns metadata for a created file", async () => {
      const created = await client.createFile(
        new Blob(["test content"], { type: "application/json" }),
        { name: "test-board.json", mimeType: "application/json" }
      );

      const result = await client.getFileMetadata(created.id!);

      assert.strictEqual(result.id, created.id);
      assert.strictEqual(result.name, "test-board.json");
      assert.strictEqual(result.mimeType, "application/json");
    });

    test("throws error for nonexistent file", async () => {
      await assert.rejects(
        () => client.getFileMetadata("nonexistent-file"),
        /404/
      );
    });

    test("filters fields when requested", async () => {
      const created = await client.createFile(
        new Blob(["test"], { type: "application/json" }),
        { name: "test.json", mimeType: "application/json" }
      );

      const result = await client.getFileMetadata(created.id!, {
        fields: ["id", "name"],
      });

      assert.strictEqual(result.id, created.id);
      assert.strictEqual(result.name, "test.json");
      // mimeType should not be present since it wasn't requested
      assert.strictEqual("mimeType" in result, false);
    });
  });

  suite("updateFile", () => {
    test("updates existing file metadata", async () => {
      const created = await client.createFile(
        new Blob(["old content"], { type: "text/plain" }),
        { name: "old-name.txt", mimeType: "text/plain" }
      );

      await client.updateFile(
        created.id!,
        new Blob(["new content"], { type: "text/plain" }),
        { name: "new-name.txt", mimeType: "text/plain" }
      );

      const updated = await client.getFileMetadata(created.id!);
      assert.strictEqual(updated.name, "new-name.txt");
      assert.strictEqual(updated.id, created.id);
    });

    test("throws 404 when updating non-existent file", async () => {
      await assert.rejects(
        () =>
          client.updateFile(
            "non-existent-file-id",
            new Blob(["data"], { type: "text/plain" }),
            { name: "test.txt", mimeType: "text/plain" }
          ),
        /404/
      );
    });
  });

  suite("updateFileMetadata", () => {
    test("updates metadata without changing content", async () => {
      const created = await client.createFileMetadata(
        { name: "original-name.txt", mimeType: "text/plain" },
        { fields: ["id", "name", "mimeType"] }
      );

      const result = await client.updateFileMetadata(
        created.id!,
        { name: "updated-name.txt" },
        { fields: ["id", "name", "mimeType"] }
      );

      const expected = {
        id: created.id,
        name: "updated-name.txt",
        mimeType: "text/plain",
      };
      assert.deepStrictEqual(result, expected);

      const fetched = await client.getFileMetadata(created.id!, {
        fields: ["id", "name", "mimeType"],
      });
      assert.deepStrictEqual(fetched, expected);
    });

    test("throws 404 when updating non-existent file", async () => {
      await assert.rejects(
        () => client.updateFileMetadata("non-existent-id", { name: "test" }),
        /404/
      );
    });
  });

  suite("generateIds", () => {
    test("generates requested number of unique IDs", async () => {
      const ids = await client.generateIds(3);

      assert.strictEqual(ids.length, 3);
      assert.ok(ids[0]!.startsWith("fAkE-"));
      assert.ok(ids[1]!.startsWith("fAkE-"));
      assert.ok(ids[2]!.startsWith("fAkE-"));
      // All IDs should be unique
      assert.strictEqual(new Set(ids).size, 3);
    });

    test("generated IDs can be used when creating files", async () => {
      const [preGeneratedId] = await client.generateIds(1);

      const created = await client.createFile(
        new Blob(["content"], { type: "text/plain" }),
        { id: preGeneratedId, name: "pre-id-file.txt", mimeType: "text/plain" },
        { fields: ["id", "name"] }
      );

      assert.strictEqual(created.id, preGeneratedId);

      const fetched = await client.getFileMetadata(preGeneratedId!, {
        fields: ["id", "name"],
      });
      assert.deepStrictEqual(fetched, {
        id: preGeneratedId,
        name: "pre-id-file.txt",
      });
    });
  });

  suite("createPermission", () => {
    test("adds permission to file", async () => {
      const file = await client.createFileMetadata(
        { name: "shared-file.txt", mimeType: "text/plain" },
        { fields: ["id"] }
      );

      const permission = await client.createPermission(
        file.id!,
        { type: "user", role: "reader", emailAddress: "user@example.com" },
        { sendNotificationEmail: false }
      );

      assert.ok(permission.id?.startsWith("12345"));
      assert.strictEqual(permission.type, "user");
      assert.strictEqual(permission.role, "reader");
      assert.strictEqual(permission.emailAddress, "user@example.com");
    });

    test("permission is visible when fetching file metadata", async () => {
      const file = await client.createFileMetadata(
        { name: "shared-file.txt", mimeType: "text/plain" },
        { fields: ["id"] }
      );

      await client.createPermission(
        file.id!,
        { type: "domain", role: "reader", domain: "example.com" },
        { sendNotificationEmail: false }
      );

      const fetched = await client.getFileMetadata(file.id!, {
        fields: ["id", "permissions"],
      });

      assert.strictEqual(fetched.permissions?.length, 1);
      assert.strictEqual(fetched.permissions![0]!.type, "domain");
      assert.strictEqual(fetched.permissions![0]!.domain, "example.com");
    });
  });

  suite("deletePermission", () => {
    test("removes permission from file", async () => {
      const file = await client.createFileMetadata(
        { name: "shared-file.txt", mimeType: "text/plain" },
        { fields: ["id"] }
      );

      const permission = await client.createPermission(
        file.id!,
        { type: "user", role: "reader", emailAddress: "user@example.com" },
        { sendNotificationEmail: false }
      );

      await client.deletePermission(file.id!, permission.id!);

      const fetched = await client.getFileMetadata(file.id!, {
        fields: ["id", "permissions"],
      });
      assert.strictEqual(fetched.permissions?.length, 0);
    });

    test("throws 404 for non-existent permission", async () => {
      const file = await client.createFileMetadata(
        { name: "test-file.txt", mimeType: "text/plain" },
        { fields: ["id"] }
      );

      await assert.rejects(
        () => client.deletePermission(file.id!, "non-existent-perm-id"),
        /404/
      );
    });
  });

  suite("isReadable", () => {
    test("returns true for existing file", async () => {
      const file = await client.createFileMetadata(
        { name: "readable-file.txt", mimeType: "text/plain" },
        { fields: ["id"] }
      );

      const result = await client.isReadable(file.id!);
      assert.strictEqual(result, true);
    });

    test("returns false for non-existent file", async () => {
      const result = await client.isReadable("non-existent-file-id");
      assert.strictEqual(result, false);
    });
  });

  suite("deleteFile", () => {
    test("deletes existing file", async () => {
      const file = await client.createFileMetadata(
        { name: "to-delete.txt", mimeType: "text/plain" },
        { fields: ["id"] }
      );

      await client.deleteFile(file.id!);

      await assert.rejects(() => client.getFileMetadata(file.id!), /404/);
    });

    test("throws 404 for non-existent file", async () => {
      await assert.rejects(
        () => client.deleteFile("non-existent-file-id"),
        /404/
      );
    });
  });

  suite("getFileMedia", () => {
    test("returns text content", async () => {
      const content = "Hello, World!";
      const file = await client.createFile(
        new Blob([content], { type: "text/plain" }),
        { name: "test.txt", mimeType: "text/plain" },
        { fields: ["id"] }
      );

      const response = await client.getFileMedia(file.id!);
      const data = await response.text();

      assert.strictEqual(data, content);
    });

    test("returns binary content", async () => {
      // Non-printable and non-ASCII bytes to verify binary data isn't corrupted
      const binaryData = new Uint8Array([0x00, 0x01, 0x02, 0xff, 0xfe, 0xfd]);
      const file = await client.createFile(
        new Blob([binaryData], { type: "application/octet-stream" }),
        { name: "test.bin", mimeType: "application/octet-stream" },
        { fields: ["id"] }
      );

      const response = await client.getFileMedia(file.id!);
      const data = new Uint8Array(await response.arrayBuffer());

      assert.deepStrictEqual(data, binaryData);
    });

    test("returns empty content for metadata-only file", async () => {
      // Real Google Drive API returns 200 OK with empty body for files created
      // with metadata only (no content uploaded)
      const file = await client.createFileMetadata(
        { name: "metadata-only.txt", mimeType: "text/plain" },
        { fields: ["id"] }
      );

      const response = await client.getFileMedia(file.id!);
      assert.ok(response.ok);
      const data = await response.arrayBuffer();

      assert.strictEqual(data.byteLength, 0);
    });

    test("throws 404 for non-existent file", async () => {
      await assert.rejects(async () => {
        const response = await client.getFileMedia("non-existent-file-id");
        if (!response.ok) {
          throw new Error(`${response.status}`);
        }
      }, /404/);
    });
  });

  suite("copyFile", () => {
    test("copies file with new metadata and preserves content", async () => {
      const content = "original content to copy";
      const original = await client.createFile(
        new Blob([content], { type: "text/plain" }),
        { name: "original.txt", mimeType: "text/plain" },
        { fields: ["id", "name"] }
      );

      const result = await client.copyFile(
        original.id!,
        { name: "copied.txt" },
        { fields: ["id", "name"] }
      );

      assert.strictEqual(result.ok, true);
      assert.strictEqual(result.value.name, "copied.txt");
      assert.notStrictEqual(result.value.id, original.id);

      // Verify content was copied
      const response = await client.getFileMedia(result.value.id!);
      const copiedContent = await response.text();
      assert.strictEqual(copiedContent, content);
    });

    test("returns error for non-existent file", async () => {
      const result = await client.copyFile("non-existent-file-id");

      assert.strictEqual(result.ok, false);
      if (!result.ok) {
        assert.strictEqual(result.error.status, 404);
      }
    });
  });

  suite("exportFile", () => {
    test("exports file to specified mimeType", async () => {
      // Create a Google Docs file (simulated)
      const docContent = JSON.stringify({ title: "My Doc", body: "Content" });
      const file = await client.createFile(
        new Blob([docContent], {
          type: "application/vnd.google-apps.document",
        }),
        {
          name: "test.gdoc",
          mimeType: "application/vnd.google-apps.document",
        },
        { fields: ["id"] }
      );

      const response = await client.exportFile(file.id!, {
        mimeType: "text/plain",
      });

      assert.ok(response.ok);
      // The fake just returns the original content for now
      const exported = await response.text();
      assert.strictEqual(exported, docContent);
    });

    test("throws 404 for non-existent file", async () => {
      const response = await client.exportFile("non-existent-file-id", {
        mimeType: "text/plain",
      });

      assert.strictEqual(response.ok, false);
      assert.strictEqual(response.status, 404);
    });
  });

  suite("listFiles", () => {
    test("returns configured files", async () => {
      const a = await client.createFileMetadata(
        { name: "a.json", mimeType: "application/json" },
        { fields: ["id"] }
      );
      const b = await client.createFileMetadata(
        { name: "b.json", mimeType: "application/json" },
        { fields: ["id"] }
      );
      fakeApi.setMatchingFilesForNextListRequest([a.id, b.id]);

      const result = await client.listFiles("not a real query");

      assert.strictEqual(result.files.length, 2);
      assert.strictEqual(result.files[0]!.name, "a.json");
      assert.strictEqual(result.files[1]!.name, "b.json");
    });

    test("returns empty array by default", async () => {
      const result = await client.listFiles("not a real query");
      assert.deepStrictEqual(result.files, []);
    });

    test("iterates through all pages automatically", async () => {
      const names = ["a.json", "b.json", "c.json", "d.json", "e.json"];
      const ids: string[] = [];
      for (const name of names) {
        const file = await client.createFileMetadata(
          { name, mimeType: "application/json" },
          { fields: ["id"] }
        );
        ids.push(file.id);
      }
      fakeApi.setMatchingFilesForNextListRequest(ids);

      // Use a pageSize of 2 so pagination triggers multiple pages
      const result = await client.listFiles("not a real query", {
        pageSize: 2,
      });

      // All 5 files should be returned despite the small page size
      assert.strictEqual(result.files.length, 5);
      const returnedNames = result.files.map((f) => f.name);
      assert.deepStrictEqual(returnedNames, names);
    });

    test("result resets after being claimed", async () => {
      const file = await client.createFileMetadata(
        { name: "once.json", mimeType: "application/json" },
        { fields: ["id"] }
      );
      fakeApi.setMatchingFilesForNextListRequest([file.id]);

      const first = await client.listFiles("not a real query");
      assert.strictEqual(first.files.length, 1);

      // Second call without re-configuring should return empty
      const second = await client.listFiles("not a real query");
      assert.deepStrictEqual(second.files, []);
    });

    test("throws when configuring non-existent file", () => {
      assert.throws(
        () => fakeApi.setMatchingFilesForNextListRequest(["does-not-exist"]),
        /not found in fake store/
      );
    });

    test("throws error for empty query", async () => {
      await assert.rejects(() => client.listFiles(""), /400/);
    });
  });

  suite("public proxy marking", () => {
    test("marked files are fetched via proxy path", async () => {
      // Create a file
      const file = await client.createFile(new Blob(["content"]), {
        name: "test-file.txt",
        mimeType: "text/plain",
      });
      const fileId = file.id!;

      // Request metadata - should NOT be proxied
      await client.getFileMetadata(fileId);
      assert.strictEqual(fakeApi.requests[1]?.wasProxied, false);

      // Mark file for proxying and request again - should be proxied
      client.markFileForReadingWithPublicProxy(fileId);
      await client.getFileMetadata(fileId);
      assert.strictEqual(fakeApi.requests[2]?.wasProxied, true);
    });

    test("fileIsMarkedForReadingWithPublicProxy returns false for unmarked files", () => {
      assert.strictEqual(
        client.fileIsMarkedForReadingWithPublicProxy("unmarked-file"),
        false
      );
    });
  });

  suite("reset", () => {
    test("clears all configured data", async () => {
      const created = await client.createFile(new Blob(["content"]), {
        name: "file1.json",
      });
      await client.getFileMetadata(created.id!);

      fakeApi.reset();

      assert.strictEqual(fakeApi.requests.length, 0);
      await assert.rejects(() => client.getFileMetadata(created.id!), /404/);
    });
  });

  suite("normalizeFileId", () => {
    test("converts string to DriveFileId object", () => {
      const result = normalizeFileId("abc123");
      assert.deepStrictEqual(result, { id: "abc123" });
    });

    test("passes through DriveFileId object unchanged", () => {
      const input = { id: "abc123", resourceKey: "key123" };
      const result = normalizeFileId(input);
      assert.deepStrictEqual(result, input);
    });

    test("passes through DriveFileId without resourceKey", () => {
      const input = { id: "abc123" };
      const result = normalizeFileId(input);
      assert.deepStrictEqual(result, { id: "abc123" });
    });
  });

  suite("version tracking", () => {
    test("createFile starts at version 1", async () => {
      const file = await client.createFile(
        new Blob(["{}"], { type: "application/json" }),
        { name: "test.json", mimeType: "application/json" }
      );
      const meta = await client.getFileMetadata(file.id, {
        fields: ["version"],
      });
      assert.strictEqual(meta.version, "1");
    });

    test("updateFileMetadata increments version", async () => {
      const file = await client.createFile(
        new Blob(["{}"], { type: "application/json" }),
        { name: "test.json", mimeType: "application/json" }
      );

      await client.updateFileMetadata(file.id, { name: "renamed.json" });
      const meta1 = await client.getFileMetadata(file.id, {
        fields: ["version"],
      });
      assert.strictEqual(meta1.version, "2");

      await client.updateFileMetadata(file.id, { name: "renamed-again.json" });
      const meta2 = await client.getFileMetadata(file.id, {
        fields: ["version"],
      });
      assert.strictEqual(meta2.version, "3");
    });

    test("updateFile (media upload) increments version", async () => {
      const file = await client.createFile(
        new Blob(["v1"], { type: "application/json" }),
        { name: "test.json", mimeType: "application/json" }
      );

      await client.updateFile(
        file.id,
        new Blob(["v2"], { type: "application/json" })
      );
      const meta1 = await client.getFileMetadata(file.id, {
        fields: ["version"],
      });
      assert.strictEqual(meta1.version, "2");

      await client.updateFile(
        file.id,
        new Blob(["v3"], { type: "application/json" })
      );
      const meta2 = await client.getFileMetadata(file.id, {
        fields: ["version"],
      });
      assert.strictEqual(meta2.version, "3");
    });

    test("copyFile starts at version 1", async () => {
      const original = await client.createFile(
        new Blob(["data"], { type: "application/json" }),
        { name: "original.json", mimeType: "application/json" }
      );

      // Bump the original to version 3
      await client.updateFileMetadata(original.id, { name: "bump1.json" });
      await client.updateFileMetadata(original.id, { name: "bump2.json" });

      const copyResult = await client.copyFile(original.id, {
        name: "copy.json",
      });
      assert.ok(copyResult.ok);
      const copyMeta = await client.getFileMetadata(copyResult.value.id, {
        fields: ["version"],
      });
      assert.strictEqual(copyMeta.version, "1", "Copy should start fresh at 1");
    });

    test("mixed content and metadata updates track version correctly", async () => {
      const file = await client.createFile(
        new Blob(["start"], { type: "application/json" }),
        { name: "test.json", mimeType: "application/json" }
      );

      // 3 content updates + 1 metadata update = version 5
      for (let i = 0; i < 3; i++) {
        await client.updateFile(
          file.id,
          new Blob([`v${i}`], { type: "application/json" })
        );
      }
      await client.updateFileMetadata(file.id, { name: "final.json" });

      const meta = await client.getFileMetadata(file.id, {
        fields: ["version"],
      });
      assert.strictEqual(meta.version, "5");
    });
  });
});
