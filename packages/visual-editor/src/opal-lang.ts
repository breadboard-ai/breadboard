/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import DefaultLangPack from "@breadboard-ai/shared-ui/strings/en_US";

export default {
  ...DefaultLangPack,
  ActivityLog: {
    ...DefaultLangPack.ActivityLog,
    LABEL_WAITING_MESSAGE: {
      str: "Start the opal to see outputs",
    },
  },
  Global: {
    ...DefaultLangPack.Global,
    APP_NAME: "Opal",
    PROVIDER_NAME: "Google",
    STATUS_GENERIC_RUN_STOPPED: {
      str: "Opal stopped",
    },
    STATUS_SAVING_PROJECT: {
      str: "Saving opal",
    },
    STATUS_CREATING_PROJECT: {
      str: "Creating opal",
    },
    STATUS_PROJECT_SAVED: {
      str: "Opal saved",
    },
    STATUS_PROJECT_CONFIGURATION_SAVED: {
      str: "Opal and configuration saved",
    },
    STATUS_PROJECT_DELETED: {
      str: "Opal deleted",
    },
    STATUS_PROJECTS_REFRESHED: {
      str: "Opals refreshed",
    },
    STATUS_PROJECT_CONTENTS_COPIED: {
      str: "Opal contents copied to clipboard",
    },
    STATUS_PROJECT_URL_COPIED: {
      str: "Opal URL copied to clipboard",
    },
    ERROR_UNABLE_TO_CREATE_PROJECT: {
      str: "Unable to create an opal",
    },
    ERROR_UNABLE_TO_LOAD_PROJECT: {
      str: "Unable to load opal",
    },
    ERROR_NO_PROJECT: {
      str: "Unable to edit; no opal found",
    },
    ERROR_UNABLE_TO_REFRESH_PROJECTS: {
      str: "Unable to refresh opals",
    },
    TITLE_CREATE_PROJECT: {
      str: "Create new opal",
    },
    STATUS_DELETING_PROJECT: {
      str: "Deleting opal",
    },
    TITLE_UNTITLED_PROJECT: {
      str: "Untitled Opal",
    },
    QUERY_SAVE_PROJECT: {
      str: "The current Flow isn't saved - would you like to save first?",
    },
    LABEL_READONLY_PROJECT: {
      str: "This opal is not editable. Please Remix it to make changes.",
    },
    LABEL_DISCLAIMER: {
      str: "Opal can make mistakes, so double-check it",
    },
  },
  ProjectListing: {
    ...DefaultLangPack.ProjectListing,
    LABEL_WELCOME_MESSAGE_A: {
      str: "Opals",
    },
    LABEL_TEAM_NAME: {
      str: "Opals Team",
    },
    LABEL_TABLE_DESCRIPTION_YOUR_PROJECTS: {
      str: "Your opals",
    },
    LABEL_NO_PROJECTS_FOUND: {
      str: "No opals found",
    },
    LABEL_SEARCH_BOARDS: {
      str: "Search opals",
    },
    ERROR_LOADING_PROJECTS: {
      str: "Error loading opal server",
    },
  },
};
