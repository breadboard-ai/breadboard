/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export { time, timeEnd };

const times = new Map<string, number>();
function time(label: string) {
  times.set(label, performance.now());
}

function timeEnd(label: string) {
  if (!times.has(label)) return 0;
  const duration = performance.now() - (times.get(label) ?? 0);
  times.delete(label);
  return duration;
}
