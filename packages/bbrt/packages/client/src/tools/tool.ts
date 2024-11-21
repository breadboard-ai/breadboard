/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {GeminiFunctionDeclaration} from '../llm/gemini.js';

export interface BBRTTool<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  I = any,
  O extends Record<string, unknown> = Record<string, unknown>,
> {
  displayName: string;
  declaration: () =>
    | GeminiFunctionDeclaration
    | Promise<GeminiFunctionDeclaration>;
  icon: string;
  invoke: (args: I) => Promise<O>;
  render(args: I): unknown;
}
