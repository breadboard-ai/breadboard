/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SerializedStoredData } from "@google-labs/breadboard";
import type { JSONSchema7 } from "json-schema";
import type { GeminiFunctionDeclaration } from "../llm/gemini.js";
import type { Result } from "../util/result.js";

export type BBRTInvokeResult<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  O extends Record<string, any> = Record<string, any>,
> = {
  readonly artifacts: SerializedStoredData[];
  readonly output: O;
};

export interface BBRTTool<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  I = any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  O extends Record<string, any> = Record<string, any>,
> {
  displayName: string;
  // TODO(aomarks) Use Result type.
  declaration: () =>
    | GeminiFunctionDeclaration
    | Promise<GeminiFunctionDeclaration>;
  icon: string;
  invoke: (args: I) => Promise<Result<BBRTInvokeResult<O>>>;
  renderCard(args: I): unknown;
  renderResult(args: I, result: O): unknown;
  describe: () => Result<BBRTToolAPI> | Promise<Result<BBRTToolAPI>>;
}

export type BBRTToolAPI = {
  inputSchema: JSONSchema7;
  outputSchema: JSONSchema7;
};
