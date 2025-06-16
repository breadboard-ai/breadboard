/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LLMContent } from "@breadboard-ai/types";
import {
  FileSystemPath,
  FileSystemReadResult,
  FileSystemWriteResult,
  Outcome,
} from "../types.js";

export { ok, err, readFromStart, noStreams };

function ok<T>(o: Outcome<Awaited<T>>): o is Awaited<T> {
  return !(o && typeof o === "object" && "$error" in o);
}

function err($error: string) {
  return { $error };
}

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
