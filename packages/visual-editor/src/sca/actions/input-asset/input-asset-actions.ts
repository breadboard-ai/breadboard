/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview
 *
 * Actions for ephemeral input assets — the scratch pad of files attached
 * to a message before submission.
 *
 * These actions coordinate the InputAssetController with asset capture
 * sources (upload modal, NotebookLM picker, etc.). The controller itself
 * handles simple add/remove/drain; these actions handle the orchestration
 * that requires Services or cross-controller coordination.
 */

import type { AssetMetadata, LLMContent } from "@breadboard-ai/types";
import { NOTEBOOKLM_MIMETYPE, toNotebookLmUrl } from "@breadboard-ai/utils";

import { makeAction } from "../binder.js";
import { asAction, ActionMode } from "../../coordination.js";
import type { NotebookPickedValue } from "../../controller/subcontrollers/editor/notebooklm-picker-controller.js";
import type { GraphAssetDescriptor } from "../../types.js";

export { bind, addFromModal, addFromNotebookLm };

const bind = makeAction();

/**
 * Add an asset from the add-asset modal (upload, YouTube, drawable, etc.).
 *
 * Coordinates depositing a `GraphAssetDescriptor` into the input asset
 * controller. Accepts either a complete `GraphAssetDescriptor` or lifts
 * a plain `LLMContent` into a descriptor with synthesized metadata and path.
 */
const addFromModal = asAction(
  "InputAsset.addFromModal",
  { mode: ActionMode.Immediate },
  async (
    assetOrContent: GraphAssetDescriptor | LLMContent,
    metadata?: AssetMetadata
  ): Promise<void> => {
    const { controller } = bind;

    let descriptor: GraphAssetDescriptor;
    if ("data" in assetOrContent && "path" in assetOrContent) {
      descriptor = assetOrContent as GraphAssetDescriptor;
    } else {
      if (!metadata) {
        throw new Error("Metadata is required when adding raw LLMContent assets");
      }
      const content = assetOrContent as LLMContent;

      // Infer extension from subType or title
      let ext = "webp";
      const mime = (metadata.subType || "").toLowerCase();
      if (mime.includes("png")) ext = "png";
      else if (mime.includes("jpeg") || mime.includes("jpg")) ext = "jpg";
      else if (mime.includes("pdf")) ext = "pdf";
      else if (mime.includes("mp4")) ext = "mp4";
      else if (mime.includes("webm")) ext = "webm";
      else if (mime.includes("csv")) ext = "csv";
      else if (mime.includes("html")) ext = "html";
      else if (mime.includes("json")) ext = "json";
      else if (mime.includes("text/plain") || mime.includes("text/"))
        ext = "txt";

      if (metadata.title && metadata.title.includes(".")) {
        const parts = metadata.title.split(".");
        const last = parts[parts.length - 1].toLowerCase();
        if (last.length >= 1 && last.length <= 4) {
          ext = last;
        }
      }

      descriptor = {
        metadata,
        path: `asset-${globalThis.crypto.randomUUID().slice(0, 8)}.${ext}`,
        data: [content],
      };
    }

    controller.editor.inputAssets.add(descriptor);
  }
);

/**
 * Add notebooks from the NotebookLM picker result.
 *
 * Converts each `NotebookPickedValue` into a `GraphAssetDescriptor` and deposits
 * it into the input asset controller.
 */
const addFromNotebookLm = asAction(
  "InputAsset.addFromNotebookLm",
  { mode: ActionMode.Immediate },
  async (notebooks: NotebookPickedValue[]): Promise<void> => {
    const { controller } = bind;
    const inputAssets = controller.editor.inputAssets;

    for (const notebook of notebooks) {
      const descriptor: GraphAssetDescriptor = {
        metadata: {
          title: notebook.preview || notebook.name || "Notebook",
          type: "file",
        },
        path: `asset-${globalThis.crypto.randomUUID().slice(0, 8)}.webp`,
        data: [
          {
            role: "user",
            parts: [
              {
                storedData: {
                  handle: toNotebookLmUrl(notebook.id),
                  mimeType: NOTEBOOKLM_MIMETYPE,
                },
              },
            ],
          },
        ],
      };
      inputAssets.add(descriptor);
    }
  }
);
