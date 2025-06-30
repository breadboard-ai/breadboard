/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  FileSystemPath,
  FileSystemReadResult,
  FileSystemWriteResult,
  LLMContent,
} from "@breadboard-ai/types";
import { err } from "@breadboard-ai/utils";

export { noStreams, readFromStart };

function readFromStart(
  path: FileSystemPath,
  data: LLMContent[] | undefined,
  start: number
): FileSystemReadResult {
  if (!data) {
    return err(`File at "${path}" is empty`);
  }

  if (start >= data.length) {
    return err(`Length of file is lesser than start "${start}"`);
  }
  return {
    data: data.slice(start),
    last: data.length - 1,
  };
}

function noStreams(done: boolean, receipt?: boolean): FileSystemWriteResult {
  if (done || receipt) {
    return err("Can't close the file that isn't a stream");
  }
}
