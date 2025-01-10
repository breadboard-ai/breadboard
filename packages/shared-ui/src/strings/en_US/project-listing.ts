/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LanguagePackEntry } from "../../types/types";

export default {
  // Commands.
  COMMAND_NEW_PROJECT: {
    str: "New Project",
  },
  COMMAND_ADD_NEW_PROJECT_SERVER: {
    str: "Add new Project Server",
  },
  COMMAND_REFRESH_PROJECT_SERVER: {
    str: "Refresh Project Server",
  },
  COMMAND_REMOVE_PROJECT_SERVER: {
    str: "Remove Project Server",
  },
  COMMAND_RENEW_ACCESS: {
    str: "Renew Access",
  },

  // Statuses.
  STATUS_LOADING: {
    str: "Loading...",
  },

  // Labels.
  LABEL_FEATURED_GUIDES: {
    str: "Featured Guides",
  },
  LABEL_PROJECT_SERVER_SETTINGS: {
    str: "Board Server Settings",
  },
  LABEL_LIST_OTHERS_PROJECTS: {
    str: "List others' boards",
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
    str: "Your Project",
  },
  LABEL_TABLE_DESCRIPTION_OTHER_PEOPLES_PROJECTS: {
    str: "Other people's Projects",
  },
  LABEL_NO_PROJECTS_FOUND: {
    str: "No Projects found",
  },
  LABEL_ACCESS_EXPIRED_PROJECT_SERVER: {
    str: "Access has expired for this Project Server",
  },
  LABEL_APP_VERSION: {
    str: "Version",
  },
  LABEL_SEARCH_BOARDS: {
    str: "Search boards",
  },

  // Queries.
  QUERY_CONFIRM_REMOVE_SERVER: {
    str: "Are you sure you want to remove this Board Server?",
  },

  // Errors.
  ERROR_LOADING_PROJECTS: {
    str: "Error loading Board Server",
  },
} as LanguagePackEntry;
