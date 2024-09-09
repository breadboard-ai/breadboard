/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export const eventIdFromEntryId = (entryId?: string): string => {
  return `e-${entryId || "0"}`;
};

export const entryIdFromEventId = (eventId?: string): string | null => {
  return eventId?.startsWith("e-") ? eventId.substring(2) : null;
};

export const idFromPath = (path: number[]): string => {
  return path.join("-");
};

export const pathFromId = (id: string): number[] => {
  return id.length ? id.split("-").map((s) => parseInt(s, 10)) : [];
};
