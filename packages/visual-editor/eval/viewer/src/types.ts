/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export type NoteLocation =
  | { type: "node-config"; nodeId: string; fieldName: string }
  | { type: "rater"; dimension?: string; fieldName?: string }
  | { type: "transcript"; turn: number; eventIndex: number; fieldName?: string };

export type UserNote = {
  id: string;
  location: NoteLocation;
  text: string;
  timestamp: string;
  reaction?: "good" | "bad";
};

export type RunNotes = {
  notes: UserNote[];
};
