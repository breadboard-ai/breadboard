/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LanguagePackEntry } from "../../types/types";

export default {
  // Commands.
  COMMAND_TOGGLE_EXPAND: {
    str: "Toggle Expand",
  },
  COMMAND_TOGGLE_VIEWER: {
    str: "Viewer",
  },
  COMMAND_ADD_ASSET: {
    str: "Add Asset",
  },
  COMMAND_EDIT_ASSET: {
    str: "Edit Asset Content",
  },
  COMMAND_CANCEL: {
    str: "Cancel",
  },
  COMMAND_SAVE_ASSET: {
    str: "Save Asset Content",
  },
  COMMAND_EDIT_PARAMETER: {
    str: "Edit Parameter",
  },
  COMMAND_SAVE_PARAMETER: {
    str: "Save Parameter",
  },

  // Labels.
  LABEL_WAITING_MESSAGE: {
    str: "No value selected",
  },
  LABEL_TITLE: {
    str: "Assets",
  },
  LABEL_NO_ASSETS: {
    str: "There are no assets yet",
  },
  LABEL_NO_PARAMETERS: {
    str: "There are no parameters yet",
  },
  LABEL_ENTER_TITLE: {
    str: "Enter a title for this parameter",
  },
  LABEL_ENTER_DESCRIPTION: {
    str: "Enter a description for this parameter",
  },
  LABEL_ENTER_SAMPLE: {
    str: "Provide a sample value for this parameter",
  },
  LABEL_ENTER_MODALITY: {
    str: "Specify parameter value type",
  },
  LABEL_DELETE_ASSET: {
    str: "Delete asset",
  },
  LABEL_DELETE_PARAM: {
    str: "Delete parameter",
  },
  LABEL_DELETE_PARAM_UNAVAILABLE: {
    str: "Delete parameter (Unavailable as parameter is in use)",
  },

  // Queries.
  // Errors.
} as LanguagePackEntry;
