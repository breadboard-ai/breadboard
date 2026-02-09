/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { OutputValues } from "@breadboard-ai/types";
import type { GoogleDriveClient } from "@breadboard-ai/utils/google-drive/google-drive-client.js";
import { getLogger, Formatter } from "../../../utils/logging/logger.js";

/**
 * Structure of run results stored in Google Drive.
 */
export interface RunResults {
  finalOutputValues?: OutputValues;
}

/**
 * Result of loading run results.
 */
export type LoadResultsResult =
  | { success: true; finalOutputValues: OutputValues }
  | { success: false; reason: "no-client" | "no-results" | "load-failed" };

/**
 * Loads run results from Google Drive.
 *
 * Run results contain the final output values from a previous execution,
 * which can be used to pre-populate the UI when loading a shared board.
 *
 * @param resultsFileId The Google Drive file ID containing the results
 * @param googleDriveClient The Google Drive client to use for fetching
 * @returns The loaded output values, or an error result
 */
export async function loadResults(
  resultsFileId: string,
  googleDriveClient: GoogleDriveClient | undefined
): Promise<LoadResultsResult> {
  if (!googleDriveClient) {
    getLogger().log(
      Formatter.error("No GoogleDriveClient provided. Cannot fetch results."),
      "loadResults"
    );
    return { success: false, reason: "no-client" };
  }

  try {
    const response = await googleDriveClient.getFileMedia(resultsFileId);
    const runResults = (await response.json()) as RunResults;

    if (!runResults.finalOutputValues) {
      return { success: false, reason: "no-results" };
    }

    return {
      success: true,
      finalOutputValues: runResults.finalOutputValues,
    };
  } catch (error) {
    getLogger().log(
      Formatter.error("Failed to load run results:", error),
      "loadResults"
    );
    return { success: false, reason: "load-failed" };
  }
}
