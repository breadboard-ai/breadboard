/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LanguagePackEntry } from "../../types/types";

export default {
  // Commands.

  // Statuses.
  STATUS_GENERATING_EXPORT: {
    str: "Generating export...",
  },
  STATUS_RETRIEVING_VALUES: {
    str: "Retrieving values...",
  },

  // Labels.
  LABEL_WAITING_MESSAGE: {
    str: "Click 'Run' to get started",
  },
  LABEL_DETAILS: {
    str: "Details",
  },
  LABEL_START: {
    str: "Start",
  },
  LABEL_INITIAL_MESSAGE: {
    str: "Please start the conversation",
  },

  // Queries.
  QUERY_RESTART: {
    str: "Would you like to restart?",
  },

  // Errors.
} as LanguagePackEntry;
