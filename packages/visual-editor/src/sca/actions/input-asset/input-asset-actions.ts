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

export { bind, addFromModal, addFromNotebookLm };

const bind = makeAction();

/**
 * Add an asset from the add-asset modal (upload, YouTube, drawable, etc.).
 *
 * The modal produces an `LLMContent` — this action simply deposits it
 * into the input asset controller. Exists as an action (rather than a
 * direct controller call) for coordination visibility and future
 * extensibility (e.g. telemetry, validation).
 */
const addFromModal = asAction(
  "InputAsset.addFromModal",
  { mode: ActionMode.Immediate },
  async (asset: LLMContent): Promise<void> => {
    const { controller } = bind;
    controller.editor.inputAssets.add(asset);
  }
);

/**
 * Add notebooks from the NotebookLM picker result.
 *
 * Converts each `NotebookPickedValue` into an `LLMContent` with a
 * `storedData` part and deposits it into the input asset controller.
 */
const addFromNotebookLm = asAction(
  "InputAsset.addFromNotebookLm",
  { mode: ActionMode.Immediate },
  async (notebooks: NotebookPickedValue[]): Promise<void> => {
    const { controller } = bind;
    const inputAssets = controller.editor.inputAssets;

    for (const notebook of notebooks) {
      const asset: LLMContent = {
        role: "user",
        parts: [
          {
            storedData: {
              handle: toNotebookLmUrl(notebook.id),
              mimeType: NOTEBOOKLM_MIMETYPE,
            },
          },
        ],
      };
      inputAssets.add(asset);
    }
  }
);
