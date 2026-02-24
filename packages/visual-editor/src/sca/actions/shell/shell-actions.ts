/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview
 *
 * Actions for Shell management (page title, etc).
 */

import * as StringsHelper from "../../../ui/strings/helper.js";
import { makeAction } from "../binder.js";
import { asAction, ActionMode } from "../../coordination.js";
import { onTitleChange } from "./triggers.js";

const Strings = StringsHelper.forSection("Global");

export const bind = makeAction();

// =============================================================================
// Actions
// =============================================================================

/**
 * Updates the page title when the graph title changes.
 *
 * **Triggers:**
 * - `onTitleChange`: Fires when graph title changes
 */
export const updatePageTitle = asAction(
  "Shell.updatePageTitle",
  {
    mode: ActionMode.Immediate,
    triggeredBy: () => onTitleChange(bind),
  },
  async (): Promise<void> => {
    const { controller, env } = bind;
    const graphTitle = controller.editor.graph.title?.trim() ?? null;

    const appName = Strings.from("APP_NAME");
    const tag = `${appName} [Experiment]`;

    const finalTitle = graphTitle ? `${graphTitle} - ${tag}` : tag;
    env.shellHost.setTitle(finalTitle);
  }
);
