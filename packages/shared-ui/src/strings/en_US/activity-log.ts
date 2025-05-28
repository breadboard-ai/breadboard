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
  COMMAND_RE_RUN: {
    str: "Re-run",
  },
  COMMAND_STEP_TO_NEXT: {
    str: "Step to next",
  },
  COMMAND_CLEAR: {
    str: "Clear",
  },
  COMMAND_DOWNLOAD: {
    str: "Download",
  },
  COMMAND_CREATE_EXPORT: {
    str: "Create export",
  },
  COMMAND_START: {
    str: "Start",
  },

  // Statuses.
  STATUS_GENERATING_EXPORT: {
    str: "Generating export...",
  },
  STATUS_RETRIEVING_VALUES: {
    str: "Retrieving values...",
  },

  // Labels.
  LABEL_WAITING_MESSAGE: {
    str: "Start the Flow to see outputs",
  },
  LABEL_DETAILS: {
    str: "Details",
  },

  // Queries.
  // Errors.
} as LanguagePackEntry;
