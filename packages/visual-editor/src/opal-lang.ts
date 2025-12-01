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
    SUB_APP_NAME: "Experiment",
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
      str: "Opal app and configuration saved",
    },
    STATUS_PROJECT_DELETED: {
      str: "Opal app deleted",
    },
    STATUS_PROJECTS_REFRESHED: {
      str: "Opal apps refreshed",
    },
    STATUS_PROJECT_CONTENTS_COPIED: {
      str: "Opal app contents copied to clipboard",
    },
    STATUS_PROJECT_URL_COPIED: {
      str: "Opal app URL copied to clipboard",
    },
    ERROR_UNABLE_TO_CREATE_PROJECT: {
      str: "Unable to create an Opal app",
    },
    ERROR_UNABLE_TO_LOAD_PROJECT: {
      str: "Unable to load Opal app",
    },
    ERROR_NO_PROJECT: {
      str: "Unable to edit; no Opal app found",
    },
    ERROR_UNABLE_TO_REFRESH_PROJECTS: {
      str: "Unable to refresh Opal apps",
    },
    TITLE_CREATE_PROJECT: {
      str: "Create new Opal app",
    },
    STATUS_DELETING_PROJECT: {
      str: "Deleting Opal app",
    },
    TITLE_UNTITLED_PROJECT: {
      str: "Untitled Opal app",
    },
    QUERY_SAVE_PROJECT: {
      str: "The current Flow isn't saved - would you like to save first?",
    },
    LABEL_READONLY_PROJECT: {
      str: "This Opal app is not editable. Please Remix it to make changes.",
    },
    LABEL_DISCLAIMER: {
      str: "Opal can make mistakes, so double-check it",
    },
    LABEL_DISCLAIMER_LITE: {
      str: "Content submitted here is processed by Opal, not Gemini. Opal can make mistakes, so double-check it. [Learn more](https://ai.google.com/).",
    },
    LABEL_SHARE: {
      str: "An Opal mini-app has been shared with you",
    },
  },
  ProjectListing: {
    ...DefaultLangPack.ProjectListing,
    LABEL_WELCOME_MESSAGE_A: {
      str: "Opal apps",
    },
    LABEL_TEAM_NAME: {
      str: "Opal Team",
    },
    LABEL_TABLE_DESCRIPTION_YOUR_PROJECTS: {
      str: "Your Opal apps",
    },
    LABEL_NO_PROJECTS_FOUND: {
      str: "No Opal apps found",
    },
    LABEL_SEARCH_BOARDS: {
      str: "Search opals",
    },
    LABEL_WELCOME_MESSAGE_LITE: {
      str: "Build mini-apps and workflows with Opal",
    },
    LABEL_SAMPLE_GALLERY_TITLE_LITE: {
      str: "Opal apps made by Google",
    },
    LABEL_TABLE_DESCRIPTION_YOUR_PROJECTS_LITE: {
      str: "My Opal apps",
    },
    LABEL_NO_OPALS_LITE: {
      str: "The Opal apps you create will appear here",
    },
    ERROR_LOADING_PROJECTS: {
      str: "Error loading Opal app server",
    },
  },
};
