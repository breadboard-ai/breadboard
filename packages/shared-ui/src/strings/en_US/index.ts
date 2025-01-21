/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LanguagePack } from "../../types/types";
import ActivityLog from "./activity-log.js";
import AppPreview from "./app-preview.js";
import CommandPalette from "./command-palette.js";
import ComponentSelector from "./component-selector.js";
import Editor from "./editor.js";
import Global from "./global.js";
import KitSelector from "./kit-selector.js";
import ProjectListing from "./project-listing.js";
import UIController from "./ui-controller.js";
import WorkspaceOutline from "./workspace-outline.js";

const lang: LanguagePack = {
  ActivityLog,
  AppPreview,
  CommandPalette,
  ComponentSelector,
  Editor,
  Global,
  KitSelector,
  ProjectListing,
  UIController,
  WorkspaceOutline,
};

export default lang;
