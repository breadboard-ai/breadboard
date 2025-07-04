/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

type Namespace = "board";

export interface Load {
  readonly eventType: `${Namespace}.load`;
  readonly url: string;
}

export interface Run {
  readonly eventType: `${Namespace}.run`;
}

export interface Stop {
  readonly eventType: `${Namespace}.stop`;
  readonly clearLastRun: boolean;
}
