/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export type BBRTChunk = BBRTAppendContentChunk | BBRTToolCallChunk;

export type BBRTAppendContentChunk = {
  kind: "append-content";
  content: string;
};

export type BBRTToolCallChunk = {
  kind: "tool-call";
  id: string;
  name: string;
  arguments: unknown;
};
