/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphMetadata, GraphTheme, Outcome } from "@breadboard-ai/types";
import { err, ok } from "@breadboard-ai/utils";
import { makeAction } from "../binder.js";
import { asAction, ActionMode } from "../../coordination.js";
import {
  createThemeGenerationPrompt,
  getThemeFromIntentGenerationPrompt,
} from "../../../ui/prompts/theme-generation.js";
import { AppTheme } from "../../../ui/types/types.js";
import { ThemePromptArgs } from "../../../ui/state/types.js";
import { generateImage, persistTheme } from "./theme-utils.js";

export const bind = makeAction();

// =============================================================================
// Internal Helpers
// =============================================================================

/**
 * Applies a GraphTheme to the graph metadata, assigning it a new UUID
 * and setting it as current.
 */
async function updateGraphWithTheme(
  graphTheme: GraphTheme
): Promise<Outcome<void>> {
  const { controller } = bind;

  controller.editor.theme.status = "editing";
  try {
    const editor = controller.editor.graph.editor;
    if (!editor) {
      return err(`Unable to update theme: can't edit the graph`);
    }

    const metadata: GraphMetadata = editor.raw().metadata ?? {};
    metadata.visual ??= {};
    metadata.visual.presentation ??= {};
    metadata.visual.presentation.themes ??= {};

    const id = globalThis.crypto.randomUUID();
    metadata.visual.presentation.themes[id] = graphTheme;
    metadata.visual.presentation.theme = id;

    const edit = await editor.edit(
      [{ type: "changegraphmetadata", metadata, graphId: "" }],
      "Updating theme"
    );

    if (!edit.success) {
      return err(edit.error);
    }
  } finally {
    controller.editor.theme.status = "idle";
  }
}

// =============================================================================
// Actions
// =============================================================================

/**
 * Adds a provided theme (e.g. from an uploaded image) to the graph
 * and sets it as current.
 */
export const add = asAction(
  "Theme.add",
  { mode: ActionMode.Immediate },
  async (theme: AppTheme): Promise<Outcome<void>> => {
    const { controller } = bind;

    const editor = controller.editor.graph.editor;
    if (!editor) {
      return err(`Unable to add theme: can't edit the graph`);
    }
    if (controller.editor.theme.status !== "idle") {
      return err(
        `Unable to add theme: theming is not idle. Current status: "${controller.editor.theme.status}"`
      );
    }
    const graphTheme = await persistTheme(
      theme,
      bind.controller,
      bind.services
    );
    if (!ok(graphTheme)) return graphTheme;

    return updateGraphWithTheme(graphTheme);
  }
);

/**
 * Generates a new theme from a prompt and adds it to the graph.
 */
export const generate = asAction(
  "Theme.generate",
  { mode: ActionMode.Immediate },
  async (
    args: ThemePromptArgs,
    abortSignal: AbortSignal
  ): Promise<Outcome<void>> => {
    const theme = await generateImage(
      createThemeGenerationPrompt(args),
      abortSignal,
      bind.controller,
      bind.services
    );
    if (!ok(theme)) return theme;
    return add(theme);
  }
);

/**
 * Generates a new theme from an intent string (used by flowgen).
 * Returns the generated GraphTheme rather than applying it directly
 * to the graph, since flowgen needs to coordinate graph replacement.
 */
export const generateFromIntent = asAction(
  "Theme.generateFromIntent",
  { mode: ActionMode.Immediate },
  async (
    intent: string,
    abortSignal?: AbortSignal
  ): Promise<Outcome<GraphTheme>> => {
    const appTheme = await generateImage(
      getThemeFromIntentGenerationPrompt(intent),
      abortSignal,
      bind.controller,
      bind.services
    );
    if (!ok(appTheme)) return appTheme;
    return persistTheme(appTheme, bind.controller, bind.services);
  }
);

/**
 * Sets an existing GraphTheme on the graph (used for setting a pre-built
 * theme without going through the add/generate flow).
 */
export const setTheme = asAction(
  "Theme.setTheme",
  { mode: ActionMode.Immediate },
  async (theme: GraphTheme): Promise<Outcome<void>> => {
    const { controller } = bind;

    const editor = controller.editor.graph.editor;
    if (!editor) {
      return err(`Unable to add theme: can't edit the graph`);
    }
    if (controller.editor.theme.status !== "idle") {
      return err(
        `Unable to add theme: theming is not idle. Current status: "${controller.editor.theme.status}"`
      );
    }
    return updateGraphWithTheme(theme);
  }
);

/**
 * Deletes a theme by ID. Auto-selects the last remaining theme.
 */
export const deleteTheme = asAction(
  "Theme.delete",
  { mode: ActionMode.Immediate },
  async (themeId: string): Promise<Outcome<void>> => {
    const { controller } = bind;

    const editor = controller.editor.graph.editor;
    if (!editor) {
      return err(`Unable to delete themes: can't edit the graph`);
    }
    if (controller.editor.theme.status !== "idle") {
      return err(
        `Unable to delete a theme: theming is not idle. Current status: "${controller.editor.theme.status}"`
      );
    }
    controller.editor.theme.status = "editing";
    try {
      const metadata: GraphMetadata = editor.raw().metadata ?? {};
      metadata.visual ??= {};
      metadata.visual.presentation ??= {};
      metadata.visual.presentation.themes ??= {};

      if (!metadata.visual.presentation.themes[themeId]) {
        return err("Theme does not exist");
      }

      delete metadata.visual.presentation.themes[themeId];
      const themes = Object.keys(metadata.visual.presentation.themes);
      metadata.visual.presentation.theme = themes.at(-1);

      const editing = await editor.edit(
        [{ type: "changegraphmetadata", metadata, graphId: "" }],
        "Updating theme"
      );
      if (!editing.success) {
        return err(editing.error);
      }
    } finally {
      controller.editor.theme.status = "idle";
    }
  }
);

/**
 * Sets the current active theme to the given ID.
 */
export const setCurrent = asAction(
  "Theme.setCurrent",
  { mode: ActionMode.Immediate },
  async (themeId: string): Promise<Outcome<void>> => {
    const { controller } = bind;

    const editor = controller.editor.graph.editor;
    if (!editor) {
      return err(`Unable to set current theme: can't edit the graph`);
    }
    if (controller.editor.theme.status !== "idle") {
      return err(
        `Unable to set current theme: theming is not idle. Current status: "${controller.editor.theme.status}"`
      );
    }
    controller.editor.theme.status = "editing";
    try {
      const metadata: GraphMetadata = editor.raw().metadata ?? {};
      metadata.visual ??= {};
      metadata.visual.presentation ??= {};
      metadata.visual.presentation.themes ??= {};

      if (!metadata.visual.presentation.themes[themeId]) {
        return err("Theme does not exist");
      }

      metadata.visual.presentation.theme = themeId;

      const editing = await editor.edit(
        [{ type: "changegraphmetadata", metadata, graphId: "" }],
        "Updating theme"
      );
      if (!editing.success) {
        return err(editing.error);
      }
    } finally {
      controller.editor.theme.status = "idle";
    }
  }
);
