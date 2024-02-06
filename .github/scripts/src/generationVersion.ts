import { getDate, getTime, runId, runNumber } from "src";

export function generationVersion() {
  const now: Date = new Date();
  const timestamp = now.getTime();

  if (!runId || !runNumber) {
    return `0.0.0-${getDate(now)}.${getTime(now)}`;
  } else {
    return `0.0.0-${runId}.${runNumber}.${timestamp}`;
  }
}
