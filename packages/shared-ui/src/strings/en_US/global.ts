/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LanguagePackEntry } from "../../types/types";

export default {
  APP_NAME: {
    str: "Breadboard",
  },
  SUB_APP_NAME: {
    str: "Visual Editor",
  },

  // Commands.
  COMMAND_OPEN_PROJECT: {
    str: "Open Project...",
  },
  COMMAND_SAVE_PROJECT: {
    str: "Save Project",
  },
  COMMAND_COPY_PROJECT_URL: {
    str: "Copy Project URL",
  },
  COMMAND_SAVE_PROJECT_AS: {
    str: "Save Project as...",
  },
  COMMAND_COPY_FULL_URL: {
    str: "Copy full URL",
  },
  COMMAND_COPY_APP_PREVIEW_URL: {
    str: "Copy App Preview URL",
  },
  COMMAND_EDIT_PROJECT_INFORMATION: {
    str: "Edit Project information...",
  },
  COMMAND_OPEN_MODULE: {
    str: "Open Module...",
  },
  COMMAND_OPEN: {
    str: "Open",
  },
  COMMAND_CREATE_MODULE: {
    str: "Create Module...",
  },
  COMMAND_COPY_PROJECT_CONTENTS: {
    str: "Copy Project Contents",
  },
  COMMAND_DELETE_PROJECT: {
    str: "Delete Project",
  },
  COMMAND_EXPORT_PROJECT: {
    str: "Export Project",
  },
  COMMAND_EDIT_SETTINGS: {
    str: "Edit Settings",
  },
  COMMAND_ADDITIONAL_ITEMS: {
    str: "See additional items",
  },

  // Labels.
  LABEL_RUN: {
    str: "Start",
  },
  LABEL_STOP: {
    str: "Stop",
  },
  LABEL_RUN_PROJECT: {
    str: "Run this Project",
  },
  LABEL_UNDO: {
    str: "Undo",
  },
  LABEL_REDO: {
    str: "Redo",
  },
  LABEL_SAVE_STATUS_SAVED: {
    str: "Saved",
  },
  LABEL_SAVE_STATUS_SAVING: {
    str: "Saving",
  },
  LABEL_SAVE_STATUS_READ_ONLY: {
    str: "Read Only",
  },
  LABEL_SAVE_ERROR: {
    str: "Error",
  },
  LABEL_SAVE_UNSAVED: {
    str: "Unsaved",
  },
  LABEL_MAIN_PROJECT: {
    str: "Main Project...",
  },

  // Statuses.
  STATUS_SAVING_PROJECT: {
    str: "Saving Project",
  },
  STATUS_DELETING_PROJECT: {
    str: "Deleting Project",
  },
  STATUS_GENERIC_WORKING: {
    str: "Working...",
  },
  STATUS_GENERIC_LOADING: {
    str: "Loading...",
  },
  STATUS_GENERIC_DONE: {
    str: "Done",
  },
  STATUS_GENERIC_RUN_STOPPED: {
    str: "Run stopped",
  },
  STATUS_PROJECT_SAVED: {
    str: "Project saved",
  },
  STATUS_PROJECT_CONFIGURATION_SAVED: {
    str: "Project and configuration saved",
  },
  STATUS_PROJECT_DELETED: {
    str: "Project deleted",
  },
  STATUS_SAVED_SETTINGS: {
    str: "Saved settings",
  },
  STATUS_PROJECTS_REFRESHED: {
    str: "Projects refreshed",
  },
  STATUS_PROJECT_CONTENTS_COPIED: {
    str: "Projects contents copied to clipboard",
  },
  STATUS_PROJECT_URL_COPIED: {
    str: "Project URL copied to clipboard",
  },
  STATUS_FULL_URL_COPIED: {
    str: "Full URL copied to clipboard",
  },
  STATUS_APP_PREVIEW_URL_COPIED: {
    str: "App Preview URL copied to clipboard",
  },

  // Errors.
  ERROR_UNABLE_TO_CREATE_PROJECT: {
    str: "Unable to create Project",
  },
  ERROR_UNABLE_TO_LOAD_PROJECT: {
    str: "Unable to load Project",
  },
  ERROR_NO_PROJECT: {
    str: "Unable to edit; no Project found",
  },
  ERROR_GENERIC: {
    str: "An error occurred",
  },
  ERROR_RUN_LOAD_DATA_FAILED: {
    str: "Unable to load run data",
  },
  ERROR_LOAD_FAILED: {
    str: "Unable to load data",
  },
  ERROR_SAVE_SETTINGS: {
    str: "Unable to save settings",
  },
  ERROR_UNABLE_TO_REFRESH_PROJECTS: {
    str: "Unable to refresh Projects",
  },
  ERROR_UNABLE_TO_RETRIEVE_TYPE_INFO: {
    str: "Error retrieving type information; try adding it again",
  },

  // Titles.
  TITLE_CREATE_PROJECT: {
    str: "Create new Project",
  },
  TITLE_UNTITLED_PROJECT: {
    str: "Untitled Project",
  },

  // Queries
  QUERY_DELETE_PROJECT: {
    str: "Are you sure you want to delete this Project? This cannot be undone",
  },
  QUERY_SAVE_PROJECT: {
    str: "The current Project isn't saved - would you like to save first?",
  },
} as LanguagePackEntry;
