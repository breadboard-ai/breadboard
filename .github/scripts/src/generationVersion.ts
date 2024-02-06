import { runId, runNumber } from "src";
import { getDate } from "./getDate";
import { getTime } from "./getTime";

export function generationVersion() {
  const now: Date = new Date();
  const timestamp = now.getTime();

  if (!runId || !runNumber) {
    return `0.0.0-${getDate(now)}.${getTime(now)}`;
  } else {
    return `0.0.0-${runId}.${runNumber}.${timestamp}`;
  }
}
