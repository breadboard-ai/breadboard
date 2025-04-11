/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LanguagePackEntry } from "../../types/types";

export default {
  // Commands.
  COMMAND_NEW_PROJECT: {
    str: "Start from blank canvas",
  },
  COMMAND_DESCRIBE_FLOW: {
    str: "Describe your flow",
  },
  COMMAND_ADD_NEW_PROJECT_SERVER: {
    str: "Add new Flow Server",
  },
  COMMAND_REFRESH_PROJECT_SERVER: {
    str: "Refresh Flow Server",
  },
  COMMAND_REMOVE_PROJECT_SERVER: {
    str: "Remove Flow Server",
  },
  COMMAND_RENEW_ACCESS: {
    str: "Renew Access",
  },
  COMMAND_GET_STARTED: {
    str: "Add a new Flow to get started",
  },
  COMMAND_PREVIOUS: {
    str: "Previous",
  },
  COMMAND_NEXT: {
    str: "Next",
  },

  // Statuses.
  STATUS_LOADING: {
    str: "Loading...",
  },

  // Labels.
  LABEL_SORT_BY: {
    str: "Sort by",
  },
  LABEL_WELCOME_MESSAGE_A: {
    str: "Make a",
  },
  LABEL_WELCOME_MESSAGE_B: {
    str: "Flow",
  },
  LABEL_WELCOME_CTA: {
    str: "Describe what you want to build or remix from the gallery",
  },
  LABEL_PLACEHOLDER_DESCRIPTION: {
    str: "Describe what you want to make in 1-2 sentences",
  },
  LABEL_FEATURED_GUIDES: {
    str: "Guides and Tutorials",
  },
  LABEL_PROJECT_SERVER_SETTINGS: {
    str: "Flow Server Settings",
  },
  LABEL_LIST_OTHERS_PROJECTS: {
    str: "List others' Flows",
  },
  LABEL_NO_VERSION: {
    str: "(no version)",
  },
  LABEL_NO_DESCRIPTION: {
    str: "(no description)",
  },
  LABEL_NO_OWNER: {
    str: "(no owner)",
  },
  LABEL_TABLE_HEADER_NAME: {
    str: "Name",
  },
  LABEL_TABLE_HEADER_VERSION: {
    str: "Version",
  },
  LABEL_TABLE_HEADER_DESCRIPTION: {
    str: "Description",
  },
  LABEL_TABLE_HEADER_TAGS: {
    str: "Tags",
  },
  LABEL_TABLE_HEADER_OWNER: {
    str: "Owner",
  },
  LABEL_TABLE_DESCRIPTION_YOUR_PROJECTS: {
    str: "Your Flow",
  },
  LABEL_TABLE_DESCRIPTION_OTHER_PEOPLES_PROJECTS: {
    str: "Other people's Flows",
  },
  LABEL_NO_PROJECTS_FOUND: {
    str: "You don't have any Flows",
  },
  LABEL_ACCESS_EXPIRED_PROJECT_SERVER: {
    str: "Access has expired for this Flow Server",
  },
  LABEL_APP_VERSION: {
    str: "Version",
  },
  LABEL_SEARCH_BOARDS: {
    str: "Search Flows",
  },
  LABEL_GENERATING_FLOW: {
    str: "Generating your flow ...",
  },
  LABEL_GENERATING_FLOW_DETAIL: {
    str: "Your flow will open automatically when ready",
  },
  LABEL_SAMPLE_GALLERY_TITLE: {
    str: "Sample gallery",
  },
  LABEL_SAMPLE_GALLERY_DESCRIPTION: {
    str: "Get inspired by exploring some sample flows and apps",
  },

  // Queries.
  QUERY_CONFIRM_REMOVE_SERVER: {
    str: "Are you sure you want to remove this Flow Server?",
  },

  // Errors.
  ERROR_LOADING_PROJECTS: {
    str: "Error loading Flow Server",
  },
} as LanguagePackEntry;
