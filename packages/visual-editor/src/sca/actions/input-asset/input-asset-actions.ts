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

import type { LLMContent } from "@breadboard-ai/types";
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
  async (assetOrContent: GraphAssetDescriptor | LLMContent): Promise<void> => {
    const { controller } = bind;

    let descriptor: GraphAssetDescriptor;
    if ("data" in assetOrContent && "path" in assetOrContent) {
      descriptor = assetOrContent as GraphAssetDescriptor;
    } else {
      const content = assetOrContent as LLMContent;
      let title = "Attachment";
      
      // Attempt to infer a friendly title from the parts
      for (const part of content.parts) {
        if ("inlineData" in part && part.inlineData.mimeType) {
          if (part.inlineData.mimeType.startsWith("image/")) title = "Image Attachment";
          else if (part.inlineData.mimeType.startsWith("audio/")) title = "Audio Attachment";
          else if (part.inlineData.mimeType.startsWith("video/")) title = "Video Attachment";
          else if (part.inlineData.mimeType.includes("pdf")) title = "PDF Document";
          else if (part.inlineData.mimeType.startsWith("text/")) title = "Text File";
          break;
        } else if ("storedData" in part) {
          title = "Stored Attachment";
          break;
        }
      }

      descriptor = {
        metadata: {
          title,
          type: "file",
        },
        path: `asset-${globalThis.crypto.randomUUID().slice(0, 8)}.webp`,
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
