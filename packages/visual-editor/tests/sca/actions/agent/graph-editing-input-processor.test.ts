/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { suite, test } from "node:test";
import {
  parseGoogleDriveUrl,
  parseYouTubeUrl,
  processInputText,
} from "../../../../src/sca/actions/agent/graph-editing-input-processor.js";
import type { AppController } from "../../../../src/sca/controller/controller.js";
import type { AppServices } from "../../../../src/sca/services/services.js";

suite("graph-editing-input-processor", () => {
  // ── parseGoogleDriveUrl ───────────────────────────────────────────────────

  test("parseGoogleDriveUrl parses standard docs links with resource keys", () => {
    const res = parseGoogleDriveUrl(
      "https://docs.google.com/document/d/11bJ4QFsA5/edit?resourcekey=0-abc&tab=t.0"
    );
    assert.deepStrictEqual(res, { id: "11bJ4QFsA5", resourceKey: "0-abc" });
  });

  test("parseGoogleDriveUrl parses open paths", () => {
    const res = parseGoogleDriveUrl(
      "https://drive.google.com/open?id=folder-id-123"
    );
    assert.deepStrictEqual(res, { id: "folder-id-123", resourceKey: undefined });
  });

  test("parseGoogleDriveUrl parses folder paths", () => {
    const res = parseGoogleDriveUrl(
      "https://drive.google.com/drive/folders/folder-id-abc"
    );
    assert.deepStrictEqual(res, { id: "folder-id-abc", resourceKey: undefined });
  });

  test("parseGoogleDriveUrl returns null for non-drive hostnames", () => {
    const res = parseGoogleDriveUrl("https://example.com/d/11bJ4QFsA5/edit");
    assert.strictEqual(res, null);
  });

  // ── parseYouTubeUrl ───────────────────────────────────────────────────────

  test("parseYouTubeUrl parses watch links", () => {
    assert.strictEqual(
      parseYouTubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
      "dQw4w9WgXcQ"
    );
  });

  test("parseYouTubeUrl parses shorts links", () => {
    assert.strictEqual(
      parseYouTubeUrl("https://youtube.com/shorts/dQw4w9WgXcQ"),
      "dQw4w9WgXcQ"
    );
  });

  test("parseYouTubeUrl parses embed links", () => {
    assert.strictEqual(
      parseYouTubeUrl("https://www.youtube.com/embed/dQw4w9WgXcQ"),
      "dQw4w9WgXcQ"
    );
  });

  test("parseYouTubeUrl parses youtu.be links", () => {
    assert.strictEqual(
      parseYouTubeUrl("https://youtu.be/dQw4w9WgXcQ?t=10"),
      "dQw4w9WgXcQ"
    );
  });

  test("parseYouTubeUrl returns null for invalid links", () => {
    assert.strictEqual(
      parseYouTubeUrl("https://example.com/watch?v=dQw4w9WgXcQ"),
      null
    );
  });

  // ── processInputText ──────────────────────────────────────────────────────

  test("processInputText returns original text if no URLs match", async () => {
    const controller = {} as AppController;
    const services = {} as AppServices;

    const res = await processInputText("Hello world", { controller, services });
    assert.strictEqual(res.processedText, "Hello world");
    assert.strictEqual(res.error, undefined);
  });

  test("processInputText parses valid drive links and creates graph assets", async () => {
    let addedAsset: {
      type: string;
      path: string;
      data: unknown;
      metadata: { title?: string; type?: string; subType?: string };
    } | null = null;

    const controller = {
      editor: {
        graph: {
          graph: { assets: {} },
          editor: {
            edit: async (edits: unknown[]) => {
              const edit = edits[0] as {
                type: string;
                path: string;
                data: unknown;
                metadata: { title?: string; type?: string; subType?: string };
              };
              if (edit?.type === "addasset") {
                addedAsset = edit;
              }
              return { success: true };
            },
          },
        },
      },
    } as unknown as AppController;

    const services = {
      googleDriveClient: {
        isReadable: async (_fileId: unknown) => true,
        getFileMetadata: async (_fileId: unknown) => ({
          name: "My Drive File",
          mimeType: "application/pdf",
        }),
      },
    } as unknown as AppServices;

    const res = await processInputText(
      "Read this: https://docs.google.com/document/d/drive-id-123/edit",
      { controller, services }
    );

    assert.ok(addedAsset);
    const asset = addedAsset as unknown as {
      type: string;
      path: string;
      data: unknown;
      metadata: { title?: string; type?: string; subType?: string };
    };
    assert.strictEqual(asset.metadata.title, "My Drive File");
    assert.strictEqual(asset.metadata.subType, "application/pdf");
    assert.strictEqual(
      res.processedText,
      `Read this: <file src="${asset.path}" />`
    );
    assert.strictEqual(res.error, undefined);
  });

  test("processInputText returns error on unreadable drive link", async () => {
    const controller = {} as AppController;
    const services = {
      googleDriveClient: {
        isReadable: async (_fileId: unknown) => false,
      },
    } as unknown as AppServices;

    const res = await processInputText(
      "Read this: https://docs.google.com/document/d/drive-id-123/edit",
      { controller, services }
    );

    assert.strictEqual(
      res.error,
      "I can't seem to access the Google Drive file at https://docs.google.com/document/d/drive-id-123/edit. Please make sure you have access to it."
    );
  });
});
