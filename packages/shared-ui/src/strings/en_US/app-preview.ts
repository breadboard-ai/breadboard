/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LanguagePackEntry } from "../../types/types";

export default {
  // Commands.
  COMMAND_CONTINUE: {
    str: "Continue",
  },

  // Statuses.
  STATUS_GENERATING_EXPORT: {
    str: "Generating export...",
  },
  STATUS_RETRIEVING_VALUES: {
    str: "Retrieving values...",
  },
  STATUS_LOADING_APP_PREVIEW: {
    str: "Loading App Preview...",
  },

  // Labels.
  LABEL_WAITING_MESSAGE: {
    str: "Tap Start to begin",
  },
  LABEL_DETAILS: {
    str: "Details",
  },
  LABEL_START: {
    str: "Start",
  },
  LABEL_INITIAL_MESSAGE: {
    str: "Tap Start to begin",
  },
  LABEL_FOOTER: {
    str: "Made with",
  },
  LABEL_UNTITLED_APP: {
    str: "Untitled App",
  },

  // Queries.
  QUERY_RESTART: {
    str: "Would you like to restart?",
  },

  // Errors.
} as LanguagePackEntry;
