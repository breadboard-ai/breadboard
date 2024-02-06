import * as github from "@actions/github";
import { getDate } from "./getDate";
import { getTime } from "./getTime";

/**
 * A unique number for each workflow run within a repository. This number does not change if you re-run the workflow run.
 */
export const runId: number = github.context.runId;

/**
 * A unique number for each run of a particular workflow in a repository. This number begins at 1 for the workflow's first run, and increments with each new run. This number does not change if you re-run the workflow run.
 */
export const runNumber: number = github.context.runNumber;

export function generationVersion() {
  const now: Date = new Date();
  const timestamp = now.getTime();

  if (!runId || !runNumber) {
    return `0.0.0-${getDate(now)}.${getTime(now)}`;
  } else {
    return `0.0.0-${runId}.${runNumber}.${timestamp}`;
  }
}
